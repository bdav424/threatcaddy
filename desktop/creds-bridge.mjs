// desktop/creds-bridge.mjs
//
// Credential export/import for ThreatCaddy desktop.
// Bundles all safeStorage-encrypted credentials into a single AES-256-GCM
// encrypted .tckeys file secured by a user-supplied password.
//
// Crypto spec:
//   KDF:  PBKDF2-SHA256, 310,000 iterations (NIST 2023 recommendation)
//   ENC:  AES-256-GCM, 12-byte IV (NIST SP 800-38D standard)
//   Wire: { version:1, salt:<base64-32B>, iv:<base64-12B>, data:<base64(cipher||tag)> }
//
// File format (inside data): JSON  { version:1, exportedAt:<ISO>, credentials:{[key]:string} }
//   key = "<subdir>/<ref>" where subdir is one of the KNOWN_SUBDIRS

import { ipcMain, safeStorage, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Whitelisted credential subdirectories under ~/.threatcaddy/
const TC_DIR = path.join(os.homedir(), '.threatcaddy');
const KNOWN_SUBDIRS = [
  'mail-credentials',
  'calendar-credentials',
  'slack-credentials',
];

const CRED_REF_RE = /^[a-zA-Z0-9_-]{8,128}\.bin$/;
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

// ─── Crypto helpers ────────────────────────────────────────────────────────

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(32);
  const iv   = crypto.randomBytes(GCM_IV_BYTES);
  const key  = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // always 16 bytes

  // Append auth tag to ciphertext — data = ciphertext || tag
  const data = Buffer.concat([ciphertext, tag]);

  return {
    version: 1,
    salt: salt.toString('base64'),
    iv:   iv.toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(envelope, password) {
  if (envelope.version !== 1) throw new Error('Unsupported .tckeys version');
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv   = Buffer.from(envelope.iv,   'base64');
  const data = Buffer.from(envelope.data, 'base64');

  if (data.length < GCM_TAG_BYTES) throw new Error('Invalid or corrupted file');

  const ciphertext = data.subarray(0, data.length - GCM_TAG_BYTES);
  const tag        = data.subarray(data.length - GCM_TAG_BYTES);
  const key        = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    throw new Error('Invalid password or corrupted file');
  }
}

// ─── Credential enumeration ────────────────────────────────────────────────

function readAllCredentials() {
  const credentials = {};

  for (const subdir of KNOWN_SUBDIRS) {
    const dir = path.join(TC_DIR, subdir);
    if (!fs.existsSync(dir)) continue;

    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }

    for (const entry of entries) {
      if (!CRED_REF_RE.test(entry)) continue;
      const fullPath = path.join(dir, entry);
      try {
        const encBytes = fs.readFileSync(fullPath);
        const decrypted = safeStorage.decryptString(encBytes);
        const key = `${subdir}/${entry}`;
        credentials[key] = decrypted;
      } catch {
        // Skip unreadable / corrupt files — don't abort the whole export
      }
    }
  }

  return credentials;
}

function writeAllCredentials(credentials) {
  let count = 0;

  for (const [key, value] of Object.entries(credentials)) {
    // key = "subdir/ref.bin"
    const parts = key.split('/');
    if (parts.length !== 2) continue;
    const [subdir, filename] = parts;
    if (!KNOWN_SUBDIRS.includes(subdir)) continue;
    if (!CRED_REF_RE.test(filename)) continue;

    const dir = path.join(TC_DIR, subdir);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    try {
      const enc = safeStorage.encryptString(value);
      fs.writeFileSync(path.join(dir, filename), enc, { mode: 0o600 });
      count++;
    } catch {
      // Skip credentials that fail to write — don't abort the whole import
    }
  }

  return count;
}

// ─── IPC handlers ──────────────────────────────────────────────────────────

export function registerCredsBridge() {

  // creds:export — bundle + encrypt all credentials, offer save dialog
  ipcMain.handle('creds:export', async (_e, { password }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'OS keychain unavailable' };
      }

      const credentials = readAllCredentials();
      const payload = JSON.stringify({
        version:     1,
        exportedAt:  new Date().toISOString(),
        credentials,
      });

      const envelope = encrypt(payload, password);
      const fileContent = JSON.stringify(envelope);
      const base64 = Buffer.from(fileContent).toString('base64');

      const { filePath, canceled } = await dialog.showSaveDialog({
        title:       'Export ThreatCaddy credentials',
        defaultPath: `threatcaddy-credentials-${Date.now()}.tckeys`,
        filters:     [{ name: 'ThreatCaddy Keys', extensions: ['tckeys'] }],
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' };
      }

      fs.writeFileSync(filePath, fileContent, { encoding: 'utf8', mode: 0o600 });
      return { success: true, filePath, base64, exportedCount: Object.keys(credentials).length };
    } catch (err) {
      return { success: false, error: String(err?.message ?? err) };
    }
  });

  // creds:import — decrypt + restore credentials from file or base64
  ipcMain.handle('creds:import', (_e, { filePath, base64, password }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'OS keychain unavailable' };
      }

      let fileContent;
      if (filePath) {
        fileContent = fs.readFileSync(filePath, 'utf8');
      } else if (base64) {
        fileContent = Buffer.from(base64, 'base64').toString('utf8');
      } else {
        return { success: false, error: 'No file or text provided' };
      }

      let envelope;
      try { envelope = JSON.parse(fileContent); } catch {
        return { success: false, error: 'Invalid file format' };
      }

      let plaintext;
      try {
        plaintext = decrypt(envelope, password);
      } catch (err) {
        return { success: false, error: err.message };
      }

      let bundle;
      try { bundle = JSON.parse(plaintext); } catch {
        return { success: false, error: 'Corrupted credential bundle' };
      }

      if (!bundle.credentials || typeof bundle.credentials !== 'object') {
        return { success: false, error: 'Corrupted credential bundle' };
      }

      const restoredCount = writeAllCredentials(bundle.credentials);
      return { success: true, restoredCount };
    } catch (err) {
      return { success: false, error: String(err?.message ?? err) };
    }
  });

  // creds:open-file — open-file dialog filtered to .tckeys
  ipcMain.handle('creds:open-file', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title:      'Open ThreatCaddy credentials file',
      filters:    [{ name: 'ThreatCaddy Keys', extensions: ['tckeys'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { filePath: null };
    return { filePath: filePaths[0] };
  });
}
