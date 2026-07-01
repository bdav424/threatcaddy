import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { customAlphabet } from 'nanoid';
import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { syncDevices } from '../db/schema.js';
import { storePairingCode, consumePairingCode } from '../services/pairing-challenge.js';
import type { AuthUser } from '../types.js';
import { ErrorCodes } from '../types/error-codes.js';

const genPairingCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const app = new Hono<{ Variables: { user: AuthUser } }>();
app.use('*', requireAuth);

// GET /api/sync/devices — list caller's enrolled devices
app.get('/', async (c) => {
  const user = c.get('user');
  const devices = await db
    .select({
      id: syncDevices.id,
      deviceName: syncDevices.deviceName,
      status: syncDevices.status,
      enrolledAt: syncDevices.enrolledAt,
      approvedAt: syncDevices.approvedAt,
      lastSeenAt: syncDevices.lastSeenAt,
    })
    .from(syncDevices)
    .where(eq(syncDevices.userId, user.id));
  return c.json({ devices });
});

// POST /api/sync/devices/register — first-time device registration
// Auto-approves if this user has no approved devices yet (first device bootstrap).
app.post('/register', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { deviceKey, deviceName } = body as { deviceKey?: string; deviceName?: string };

  if (!deviceKey || typeof deviceKey !== 'string' || deviceKey.length < 16) {
    return c.json({ error: 'Invalid device key', code: ErrorCodes.SYNC_PAIRING_INVALID }, 400);
  }

  const fingerprint = sha256(deviceKey);
  const name = (typeof deviceName === 'string' && deviceName.trim()) ? deviceName.trim().slice(0, 80) : 'Unknown Device';

  // Check if already registered (idempotent)
  const existing = await db
    .select({ id: syncDevices.id, status: syncDevices.status })
    .from(syncDevices)
    .where(and(eq(syncDevices.userId, user.id), eq(syncDevices.deviceFingerprint, fingerprint)))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ status: existing[0].status, deviceId: existing[0].id });
  }

  // First device for this user → auto-approve; subsequent → pending
  const [{ approvedCount }] = await db
    .select({ approvedCount: count() })
    .from(syncDevices)
    .where(and(eq(syncDevices.userId, user.id), eq(syncDevices.status, 'approved')));

  const isFirstDevice = Number(approvedCount) === 0;
  const status = isFirstDevice ? ('approved' as const) : ('pending' as const);
  const deviceId = nanoid();

  await db.insert(syncDevices).values({
    id: deviceId,
    userId: user.id,
    deviceName: name,
    deviceFingerprint: fingerprint,
    status,
    approvedAt: isFirstDevice ? new Date() : undefined,
  });

  return c.json({ status, deviceId });
});

// POST /api/sync/devices/pair/generate — trusted device generates a pairing code
app.post('/pair/generate', async (c) => {
  const user = c.get('user');
  const code = genPairingCode();
  const codeHash = sha256(code);
  storePairingCode(codeHash, user.id);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Generate QR code encoding just the pairing code so mobile can scan it
  const qrDataUrl = await QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 1, width: 200 });

  return c.json({ pairingCode: code, qrDataUrl, expiresAt });
});

// POST /api/sync/devices/pair/complete — new device redeems pairing code
app.post('/pair/complete', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { pairingCode, deviceKey, deviceName } = body as {
    pairingCode?: string;
    deviceKey?: string;
    deviceName?: string;
  };

  if (!pairingCode || typeof pairingCode !== 'string') {
    return c.json({ error: 'Pairing code required', code: ErrorCodes.SYNC_PAIRING_INVALID }, 400);
  }
  if (!deviceKey || typeof deviceKey !== 'string' || deviceKey.length < 16) {
    return c.json({ error: 'Invalid device key', code: ErrorCodes.SYNC_PAIRING_INVALID }, 400);
  }

  const codeHash = sha256(pairingCode.trim().toUpperCase());
  const valid = consumePairingCode(codeHash, user.id);
  if (!valid) {
    return c.json({ error: 'Pairing code is invalid or expired', code: ErrorCodes.SYNC_PAIRING_INVALID }, 400);
  }

  const fingerprint = sha256(deviceKey);
  const name = (typeof deviceName === 'string' && deviceName.trim()) ? deviceName.trim().slice(0, 80) : 'Unknown Device';
  const now = new Date();

  // Upsert device as approved (either register new or approve pending)
  const existing = await db
    .select({ id: syncDevices.id })
    .from(syncDevices)
    .where(and(eq(syncDevices.userId, user.id), eq(syncDevices.deviceFingerprint, fingerprint)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(syncDevices)
      .set({ status: 'approved', approvedAt: now, deviceName: name })
      .where(eq(syncDevices.id, existing[0].id));
    return c.json({ enrolled: true, deviceId: existing[0].id });
  }

  const deviceId = nanoid();
  await db.insert(syncDevices).values({
    id: deviceId,
    userId: user.id,
    deviceName: name,
    deviceFingerprint: fingerprint,
    status: 'approved',
    approvedAt: now,
  });

  return c.json({ enrolled: true, deviceId });
});

// DELETE /api/sync/devices/:id — revoke a device
app.delete('/:id', async (c) => {
  const user = c.get('user');
  const deviceId = c.req.param('id');

  const [device] = await db
    .select({ id: syncDevices.id, userId: syncDevices.userId })
    .from(syncDevices)
    .where(eq(syncDevices.id, deviceId))
    .limit(1);

  if (!device || device.userId !== user.id) {
    return c.json({ error: 'Device not found', code: ErrorCodes.SYNC_DEVICE_NOT_FOUND }, 404);
  }

  await db.update(syncDevices)
    .set({ status: 'revoked' })
    .where(eq(syncDevices.id, deviceId));

  return c.json({ ok: true });
});

// PATCH /api/sync/devices/:id — rename a device
app.patch('/:id', async (c) => {
  const user = c.get('user');
  const deviceId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { deviceName } = body as { deviceName?: string };

  if (!deviceName || typeof deviceName !== 'string' || !deviceName.trim()) {
    return c.json({ error: 'deviceName required' }, 400);
  }

  const [device] = await db
    .select({ id: syncDevices.id, userId: syncDevices.userId })
    .from(syncDevices)
    .where(eq(syncDevices.id, deviceId))
    .limit(1);

  if (!device || device.userId !== user.id) {
    return c.json({ error: 'Device not found', code: ErrorCodes.SYNC_DEVICE_NOT_FOUND }, 404);
  }

  await db.update(syncDevices)
    .set({ deviceName: deviceName.trim().slice(0, 80) })
    .where(eq(syncDevices.id, deviceId));

  return c.json({ ok: true });
});

export default app;
