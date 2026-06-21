// src/lib/sync-crypto.ts
//
// Client-side encryption for sync payloads — PBKDF2 → AES-256-GCM.
// Mirrors the backup-crypto.ts scheme but applied to per-entity sync data
// instead of whole-backup blobs.
//
// Key derivation uses a stable per-account salt so the same password produces
// the same key on every device. The salt is generated once on first login,
// stored server-side (in plain — it's not sensitive), returned in login
// responses, and never changes for the life of the account.
//
// Encryption boundary:
//   Push: full entity record → AES-256-GCM → base64 string stored in encryptedData
//   Pull: encryptedData base64 → AES-256-GCM → full entity record
//
// The server stores encryptedData opaquely. All metadata needed for conflict
// resolution (id, folderId, version, updatedAt, deletedAt) is also present in
// plain columns alongside the ciphertext so the server can still validate and
// route without decrypting.

import { arrayBufferToBase64, base64ToArrayBuffer } from './crypto';

const PBKDF2_ITERATIONS = 600_000;
const IV_BYTES = 12;

/** JSON wire format for an encrypted sync entity blob. */
export interface EncryptedSyncBlob {
  v: 1;
  iv: string;   // base64, 12 bytes
  ct: string;   // base64 AES-256-GCM ciphertext
}

/**
 * Derive a stable AES-256-GCM key from the user's password and their
 * per-account salt. The same password + salt always produces the same key,
 * so multiple devices converge on the same key without exchanging it.
 *
 * Call once at login; cache the CryptoKey in memory for the session.
 * The key is not persisted — re-derived on each login.
 */
export async function deriveSyncKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToArrayBuffer(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a full entity record. Returns an EncryptedSyncBlob serialised
 * to a compact base64-JSON string suitable for storing in encryptedData.
 */
export async function encryptSyncEntity(
  key: CryptoKey,
  entity: Record<string, unknown>,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(entity));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const blob: EncryptedSyncBlob = {
    v: 1,
    iv: arrayBufferToBase64(iv.buffer),
    ct: arrayBufferToBase64(ct),
  };
  return JSON.stringify(blob);
}

/**
 * Decrypt an EncryptedSyncBlob string produced by encryptSyncEntity.
 * Returns the original entity record.
 */
export async function decryptSyncEntity(
  key: CryptoKey,
  ciphertext: string,
): Promise<Record<string, unknown>> {
  let blob: EncryptedSyncBlob;
  try {
    blob = JSON.parse(ciphertext) as EncryptedSyncBlob;
  } catch {
    throw new Error('sync-crypto: malformed ciphertext (not valid JSON)');
  }
  if (blob.v !== 1) throw new Error(`sync-crypto: unsupported blob version ${blob.v}`);

  const ivBuf = base64ToArrayBuffer(blob.iv);
  const ctBuf = base64ToArrayBuffer(blob.ct);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ctBuf);
  return JSON.parse(new TextDecoder().decode(plainBuf)) as Record<string, unknown>;
}

/** Generate a random base64 salt suitable for use as a sync key salt. */
export function generateSyncKeySalt(): string {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(buf.buffer);
}
