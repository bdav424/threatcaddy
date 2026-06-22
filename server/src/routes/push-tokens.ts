import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { devicePushTokens } from '../db/schema.js';
import type { AuthUser } from '../types.js';

const app = new Hono<{ Variables: { user: AuthUser } }>();

app.use('*', requireAuth);

// POST /api/push-tokens — register or refresh a device push token
app.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ token: string; platform: 'android' | 'ios' | 'web' }>();

  if (!body.token || !body.platform) {
    return c.json({ error: 'token and platform are required' }, 400);
  }
  if (!['android', 'ios', 'web'].includes(body.platform)) {
    return c.json({ error: 'invalid platform' }, 400);
  }

  const existing = await db
    .select({ id: devicePushTokens.id })
    .from(devicePushTokens)
    .where(and(eq(devicePushTokens.userId, user.id), eq(devicePushTokens.token, body.token)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(devicePushTokens)
      .set({ updatedAt: new Date() })
      .where(eq(devicePushTokens.id, existing[0].id));
    return c.json({ ok: true, id: existing[0].id });
  }

  const id = nanoid();
  await db.insert(devicePushTokens).values({
    id,
    userId: user.id,
    token: body.token,
    platform: body.platform,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return c.json({ ok: true, id });
});

// DELETE /api/push-tokens/:token — unregister a device (on logout)
app.delete('/:token', async (c) => {
  const user = c.get('user');
  const token = decodeURIComponent(c.req.param('token'));

  await db
    .delete(devicePushTokens)
    .where(and(eq(devicePushTokens.userId, user.id), eq(devicePushTokens.token, token)));

  return c.json({ ok: true });
});

export default app;
