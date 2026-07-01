/**
 * MFA routes — TOTP setup/enable/disable + MFA challenge verification.
 *
 * Flow:
 *  1. POST /api/mfa/totp/setup  → { otpAuthUri, qrDataUri } (not enabled yet)
 *  2. POST /api/mfa/totp/enable → { backupCodes } (after scanning QR, enables TOTP)
 *  3. POST /api/mfa/totp/disable → {} (disables TOTP; requires current code or backup)
 *  4. POST /api/mfa/verify      → { accessToken, refreshToken, user } (completes login)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import totp from 'qrcode';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../services/audit-service.js';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  markBackupCodeUsed,
  encryptSecret,
  decryptSecret,
  type BackupCodeEntry,
} from '../services/totp-service.js';
import { signMfaChallenge, verifyMfaChallenge } from '../services/mfa-challenge.js';
import type { AuthUser } from '../types.js';
import { ErrorCodes } from '../types/error-codes.js';

const app = new Hono<{ Variables: { user: AuthUser } }>();

// ── TOTP setup (requires active session) ─────────────────────────────────

// GET /api/mfa/totp/setup — generate a new pending secret (not yet enabled)
app.get('/totp/setup', requireAuth, async (c) => {
  const { user } = c.var;
  const base32Secret = generateTotpSecret();
  const otpAuthUri = buildOtpAuthUri(user.email, base32Secret);
  const qrDataUri = await totp.toDataURL(otpAuthUri);
  // Return the raw base32 so the client can store it temporarily until the
  // user confirms by enabling. Don't save to DB yet.
  return c.json({ secret: base32Secret, otpAuthUri, qrDataUri });
});

const enableSchema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6).regex(/^\d{6}$/),
});

// POST /api/mfa/totp/enable
app.post('/totp/enable', requireAuth, async (c) => {
  const { user } = c.var;
  const body = await c.req.json();
  const parsed = enableSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }
  const { secret, code } = parsed.data;

  if (!verifyTotpCode(secret, code)) {
    return c.json({ error: 'Invalid TOTP code', code: ErrorCodes.INVALID_CREDENTIALS }, 400);
  }

  const { plaintext, hashed } = await generateBackupCodes();
  const encryptedSecret = encryptSecret(secret);

  await db.update(users).set({
    totpSecret: encryptedSecret,
    totpEnabled: true,
    totpBackupCodes: hashed,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  await logActivity({ userId: user.id, category: 'auth', action: 'mfa.totp.enabled', detail: 'TOTP 2FA enabled' });

  return c.json({ backupCodes: plaintext });
});

const disableSchema = z.object({
  code: z.string().min(6).max(10),
});

// POST /api/mfa/totp/disable
app.post('/totp/disable', requireAuth, async (c) => {
  const { user } = c.var;
  const body = await c.req.json();
  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const [row] = await db.select({
    totpSecret: users.totpSecret,
    totpEnabled: users.totpEnabled,
    totpBackupCodes: users.totpBackupCodes,
  }).from(users).where(eq(users.id, user.id)).limit(1);

  if (!row?.totpEnabled || !row.totpSecret) {
    return c.json({ error: 'TOTP is not enabled', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const base32Secret = decryptSecret(row.totpSecret);
  const codes = row.totpBackupCodes as BackupCodeEntry[];
  const code = parsed.data.code;

  const isTotpValid = code.length === 6 && verifyTotpCode(base32Secret, code);
  const backupMatchId = isTotpValid ? null : await verifyBackupCode(codes, code);

  if (!isTotpValid && !backupMatchId) {
    return c.json({ error: 'Invalid code', code: ErrorCodes.INVALID_CREDENTIALS }, 400);
  }

  await db.update(users).set({
    totpSecret: null,
    totpEnabled: false,
    totpBackupCodes: [],
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  await logActivity({ userId: user.id, category: 'auth', action: 'mfa.totp.disabled', detail: 'TOTP 2FA disabled' });

  return c.json({ ok: true });
});

// GET /api/mfa/status — returns MFA state for the current user
app.get('/status', requireAuth, async (c) => {
  const { user } = c.var;
  const [row] = await db.select({
    totpEnabled: users.totpEnabled,
    totpBackupCodes: users.totpBackupCodes,
  }).from(users).where(eq(users.id, user.id)).limit(1);

  const codes = (row?.totpBackupCodes ?? []) as BackupCodeEntry[];
  const unusedBackupCodes = codes.filter(c => !c.used).length;

  return c.json({
    totpEnabled: row?.totpEnabled ?? false,
    unusedBackupCodes,
  });
});

// ── MFA challenge verification (no session required) ──────────────────────
// The verify endpoint lives in auth.ts (/api/auth/mfa/verify) to keep token
// issuance logic co-located with createTokenPair. handleMfaVerify is exported
// below so auth.ts can call it without a circular import.
export { app as mfaRouter };

// Export a standalone verify handler used by the auth service so it can issue tokens.
// The auth route registers this on the same router as /api/auth to avoid circular deps.
export async function handleMfaVerify(
  challengeToken: string,
  code: string,
): Promise<{ userId: string } | { error: string; code: string; status: number }> {
  let userId: string;
  try {
    userId = await verifyMfaChallenge(challengeToken);
  } catch {
    return { error: 'Invalid or expired MFA session', code: ErrorCodes.INVALID_CREDENTIALS, status: 401 };
  }

  const [row] = await db.select({
    totpSecret: users.totpSecret,
    totpEnabled: users.totpEnabled,
    totpBackupCodes: users.totpBackupCodes,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!row?.totpEnabled || !row.totpSecret) {
    return { error: 'MFA not configured', code: ErrorCodes.VALIDATION_FAILED, status: 400 };
  }

  const base32Secret = decryptSecret(row.totpSecret);
  const codes = row.totpBackupCodes as BackupCodeEntry[];

  const isTotpValid = code.length === 6 && /^\d{6}$/.test(code) && verifyTotpCode(base32Secret, code);
  const backupMatchId = isTotpValid ? null : await verifyBackupCode(codes, code);

  if (!isTotpValid && !backupMatchId) {
    return { error: 'Invalid MFA code', code: ErrorCodes.INVALID_CREDENTIALS, status: 401 };
  }

  if (backupMatchId) {
    const updatedCodes = markBackupCodeUsed(codes, backupMatchId);
    await db.update(users).set({ totpBackupCodes: updatedCodes, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  return { userId };
}

export { signMfaChallenge };
