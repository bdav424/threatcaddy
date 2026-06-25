// desktop/sync-auth-bridge.mjs
//
// Main-process IPC handlers for MFA-gated sync auth (TOTP + passkeys).
// All secrets are encrypted at rest via safeStorage and stored in a keyed
// flat JSON file under app.getPath('userData')/sync-auth.json.
// The renderer never receives raw secret material — only success/null.

import { ipcMain, safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const SYNC_AUTH_FILE = path.join(app.getPath('userData'), 'sync-auth.json');

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readStore() {
  try {
    const raw = fs.readFileSync(SYNC_AUTH_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(SYNC_AUTH_FILE, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
}

function encryptField(value) {
  if (!safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.encryptString(value).toString('base64');
}

function decryptField(encoded) {
  if (!safeStorage.isEncryptionAvailable() || !encoded) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    return null;
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

export function registerSyncAuthBridge() {

  // Store TOTP secret encrypted in safeStorage
  ipcMain.handle('sync-auth:save-totp', (_e, secret) => {
    const enc = encryptField(secret);
    if (!enc) return;
    const store = readStore();
    store.totp = enc;
    writeStore(store);
  });

  // Retrieve and decrypt TOTP secret; returns null if absent or unavailable
  ipcMain.handle('sync-auth:get-totp', () => {
    const store = readStore();
    return decryptField(store.totp ?? null);
  });

  // Store passkey credential ID + public key (both encrypted)
  ipcMain.handle('sync-auth:save-passkey', (_e, credentialId, publicKey) => {
    const encId  = encryptField(credentialId);
    const encKey = encryptField(publicKey);
    if (!encId || !encKey) return;
    const store = readStore();
    store.passkeyCredentialId = encId;
    store.passkeyPublicKey    = encKey;
    writeStore(store);
  });

  // Retrieve passkey credential; returns null if absent
  ipcMain.handle('sync-auth:get-passkey', () => {
    const store = readStore();
    const credentialId = decryptField(store.passkeyCredentialId ?? null);
    const publicKey    = decryptField(store.passkeyPublicKey    ?? null);
    if (!credentialId || !publicKey) return null;
    return { credentialId, publicKey };
  });

  // Clear all stored sync auth data
  ipcMain.handle('sync-auth:clear', () => {
    writeStore({});
  });
}
