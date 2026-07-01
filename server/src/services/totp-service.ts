/**
 * TOTP service — wraps otpauth for secret generation/verification,
 * argon2id for backup-code hashing, and AES-256-GCM for secret storage.
 *
 * TOTP_SECRET_KEY env var (32 hex bytes = 64 hex chars) encrypts secrets
 * at rest so a DB dump doesn't expose raw TOTP seeds.
 */

import * as OTPAuth from 'otpauth';
import * as argon2 from 'argon2';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { nanoid } from 'nanoid';

// ── Encryption helpers ────────────────────────────────────────────────────

function getEncKey(): Buffer {
  const hex = process.env.TOTP_SECRET_KEY ?? '';
  if (hex.length !== 64) throw new Error('TOTP_SECRET_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

/** Returns 'iv:tag:ciphertext' in hex, all joined with ':'. */
export function encryptSecret(plaintext: string): string {
  const key = getEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join(':');
}

export function decryptSecret(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':');
  const key = getEncKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
  return plain.toString('utf8');
}

// ── TOTP core ─────────────────────────────────────────────────────────────

const TOTP_ISSUER = process.env.TOTP_ISSUER ?? 'ThreatCaddy';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1';

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildOtpAuthUri(email: string, base32Secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
  return totp.toString();
}

/** Returns true if the provided 6-digit code is valid for the secret (±1 window). */
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: 'verify',
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ── Backup codes ──────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 8;

export interface BackupCodeEntry {
  id: string;
  hash: string;
  used: boolean;
}

export async function generateBackupCodes(): Promise<{ plaintext: string[]; hashed: BackupCodeEntry[] }> {
  const plaintext: string[] = [];
  const hashed: BackupCodeEntry[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = nanoid(10).toUpperCase();
    const hash = await argon2.hash(code, { type: argon2.argon2id });
    plaintext.push(code);
    hashed.push({ id: nanoid(8), hash, used: false });
  }
  return { plaintext, hashed };
}

/** Returns the matched code entry id, or null if no match / all used. */
export async function verifyBackupCode(
  codes: BackupCodeEntry[],
  input: string,
): Promise<string | null> {
  for (const entry of codes) {
    if (entry.used) continue;
    const match = await argon2.verify(entry.hash, input);
    if (match) return entry.id;
  }
  return null;
}

export function markBackupCodeUsed(codes: BackupCodeEntry[], id: string): BackupCodeEntry[] {
  return codes.map(c => c.id === id ? { ...c, used: true } : c);
}
