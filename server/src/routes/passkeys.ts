/**
 * Passkey routes — WebAuthn registration and authentication.
 *
 * Registration flow (requires active session):
 *  1. POST /api/passkeys/register/begin  → { options } (stored challenge keyed by userId)
 *  2. POST /api/passkeys/register/finish → { id, name } (verifies and persists passkey)
 *
 * Authentication flow (no session required):
 *  1. POST /api/passkeys/auth/begin   → { options, sessionId } (body: { email })
 *  2. POST /api/passkeys/auth/finish  → { accessToken, refreshToken, user } (body: { response, sessionId })
 *
 * Management (requires active session):
 *  GET    /api/passkeys        → list user's passkeys
 *  DELETE /api/passkeys/:id   → remove a passkey
 *
 * RP_ID / origin configuration: set PASSKEY_RP_ID and PASSKEY_ORIGIN env vars.
 * Defaults: rpId = "localhost", origin = "http://localhost:5173" (suitable for dev).
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { eq, and, asc } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/index.js';
import { users, userPasskeys, sessions } from '../db/schema.js';
import { requireAuth, signAccessToken } from '../middleware/auth.js';
import { logActivity } from '../services/audit-service.js';
import { getSessionSettings } from '../services/admin-secret.js';
import { storeChallenge, consumeChallenge } from '../services/passkey-challenge.js';
import type { AuthUser } from '../types.js';
import { ErrorCodes } from '../types/error-codes.js';

const RP_NAME = process.env.PASSKEY_RP_NAME ?? 'ThreatCaddy';
const RP_ID   = process.env.PASSKEY_RP_ID   ?? 'localhost';
const ORIGIN  = process.env.PASSKEY_ORIGIN  ?? 'http://localhost:5173';

const app = new Hono<{ Variables: { user: AuthUser } }>();

// ── Registration (requires existing session) ─────────────────────────────────

app.post('/register/begin', requireAuth, async (c) => {
  const { user } = c.var;

  // Fetch existing credential IDs so the device isn't re-registered
  const existing = await db
    .select({ credentialId: userPasskeys.credentialId })
    .from(userPasskeys)
    .where(eq(userPasskeys.userId, user.id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.displayName ?? user.email,
    attestationType: 'none',
    excludeCredentials: existing.map((r) => ({ id: r.credentialId })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  storeChallenge(`reg:${user.id}`, options.challenge, user.id);

  return c.json(options);
});

app.post('/register/finish', requireAuth, async (c) => {
  const { user } = c.var;
  const body = await c.req.json() as { response: RegistrationResponseJSON; name?: string };
  if (!body?.response) {
    return c.json({ error: 'Missing response', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const entry = consumeChallenge(`reg:${user.id}`);
  if (!entry) {
    return c.json({ error: 'Registration session expired', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return c.json({ error: String(err), code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'Verification failed', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const { credential, aaguid, credentialDeviceType } = verification.registrationInfo;

  // Encode publicKey bytes as hex for TEXT storage
  const publicKeyHex = Buffer.from(credential.publicKey).toString('hex');

  const passkeyId = nanoid();
  const keyName = body.name?.trim().slice(0, 40) || 'Passkey';

  await db.insert(userPasskeys).values({
    id: passkeyId,
    userId: user.id,
    credentialId: credential.id,
    publicKey: publicKeyHex,
    counter: credential.counter,
    deviceType: credentialDeviceType ?? null,
    aaguid: aaguid ?? null,
    name: keyName,
    createdAt: new Date(),
  });

  await logActivity({ userId: user.id, category: 'auth', action: 'passkey.registered', detail: `Passkey registered: ${keyName}` });

  return c.json({ id: passkeyId, name: keyName });
});

// ── Authentication (no session required) ─────────────────────────────────────

app.post('/auth/begin', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;

  let allowCredentials: { id: string }[] = [];
  let userId: string | undefined;

  if (email) {
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userRow) {
      userId = userRow.id;
      const keys = await db
        .select({ credentialId: userPasskeys.credentialId })
        .from(userPasskeys)
        .where(eq(userPasskeys.userId, userId));
      allowCredentials = keys.map((k) => ({ id: k.credentialId }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
  });

  const sessionId = nanoid(32);
  storeChallenge(`auth:${sessionId}`, options.challenge, userId);

  return c.json({ options, sessionId });
});

app.post('/auth/finish', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { response, sessionId } = body ?? {};
  if (!response || !sessionId) {
    return c.json({ error: 'Missing response or sessionId', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const entry = consumeChallenge(`auth:${sessionId}`);
  if (!entry) {
    return c.json({ error: 'Authentication session expired', code: ErrorCodes.VALIDATION_FAILED }, 400);
  }

  const authResponse = response as AuthenticationResponseJSON;
  const credentialId = authResponse.id;

  // Find passkey by credential ID
  const [passkeyRow] = await db
    .select()
    .from(userPasskeys)
    .where(eq(userPasskeys.credentialId, credentialId))
    .limit(1);

  if (!passkeyRow) {
    return c.json({ error: 'Unknown passkey', code: ErrorCodes.INVALID_CREDENTIALS }, 401);
  }

  const publicKeyBytes = new Uint8Array(Buffer.from(passkeyRow.publicKey, 'hex'));

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkeyRow.credentialId,
        publicKey: publicKeyBytes,
        counter: passkeyRow.counter,
        transports: undefined,
      },
    });
  } catch (err) {
    return c.json({ error: String(err), code: ErrorCodes.INVALID_CREDENTIALS }, 401);
  }

  if (!verification.verified) {
    return c.json({ error: 'Passkey verification failed', code: ErrorCodes.INVALID_CREDENTIALS }, 401);
  }

  // Update counter
  await db
    .update(userPasskeys)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(userPasskeys.id, passkeyRow.id));

  // Load user
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, passkeyRow.userId))
    .limit(1);

  if (!userRow?.active) {
    return c.json({ error: 'Account disabled', code: ErrorCodes.ACCOUNT_DISABLED }, 403);
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userRow.id));

  const authUser: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    displayName: userRow.displayName,
    avatarUrl: userRow.avatarUrl,
  };

  const accessToken = await signAccessToken(authUser);
  const refreshTokenId = nanoid(32);

  const sessionSettings = await getSessionSettings();
  const expiresAt = new Date(Date.now() + sessionSettings.ttlHours * 60 * 60 * 1000);

  // Enforce max sessions per user
  if (sessionSettings.maxPerUser > 0) {
    const existing = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userRow.id))
      .orderBy(asc(sessions.createdAt));
    const excess = existing.length - sessionSettings.maxPerUser + 1;
    if (excess > 0) {
      for (const s of existing.slice(0, excess)) {
        await db.delete(sessions).where(eq(sessions.id, s.id));
      }
    }
  }

  await db.insert(sessions).values({
    id: refreshTokenId,
    userId: userRow.id,
    tokenFamily: nanoid(16),
    rotationCounter: 0,
    expiresAt,
  });

  await logActivity({ userId: userRow.id, category: 'auth', action: 'login', detail: 'Login via passkey' });

  return c.json({
    accessToken,
    refreshToken: refreshTokenId,
    user: { id: userRow.id, email: userRow.email, displayName: userRow.displayName, role: userRow.role, avatarUrl: userRow.avatarUrl },
  });
});

// ── Management ────────────────────────────────────────────────────────────────

app.get('/', requireAuth, async (c) => {
  const { user } = c.var;
  const keys = await db
    .select({
      id: userPasskeys.id,
      name: userPasskeys.name,
      deviceType: userPasskeys.deviceType,
      aaguid: userPasskeys.aaguid,
      createdAt: userPasskeys.createdAt,
    })
    .from(userPasskeys)
    .where(eq(userPasskeys.userId, user.id));
  return c.json(keys);
});

app.delete('/:id', requireAuth, async (c) => {
  const { user } = c.var;
  const { id } = c.req.param();
  const [row] = await db
    .select({ id: userPasskeys.id })
    .from(userPasskeys)
    .where(and(eq(userPasskeys.id, id), eq(userPasskeys.userId, user.id)))
    .limit(1);

  if (!row) {
    return c.json({ error: 'Passkey not found', code: ErrorCodes.NOT_FOUND }, 404);
  }

  await db.delete(userPasskeys).where(eq(userPasskeys.id, id));
  await logActivity({ userId: user.id, category: 'auth', action: 'passkey.deleted', detail: `Passkey deleted: ${id}` });
  return c.json({ ok: true });
});

export { app as passkeyRouter };
