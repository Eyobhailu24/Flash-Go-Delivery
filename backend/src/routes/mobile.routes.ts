import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { protect, type AuthUser } from '../middleware/auth.middleware.js';
import { db } from '../db.js';
import {
  notificationDevices,
  notifications,
  pushDeliveries,
} from '../schema.js';
import { readAccessPayload } from '../lib/mobile-auth.js';

export const mobileRoutes = new Hono<{ Variables: { user: AuthUser } }>();
mobileRoutes.use('*', protect);
const deviceSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/),
  platform: z.enum(['android', 'ios']),
});
mobileRoutes.post('/devices', async (c) => {
  const parsed = deviceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ message: 'Invalid device registration.' }, 400);
  const session = await readAccessPayload(c);
  if (!session?.sid)
    return c.json({ message: 'A mobile session is required.' }, 401);
  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(notificationDevices)
      .where(eq(notificationDevices.token, parsed.data.token));
    const changedAccount = previous && previous.userId !== c.var.user.id;
    if (changedAccount)
      await tx
        .delete(pushDeliveries)
        .where(eq(pushDeliveries.deviceId, previous.id));
    await tx
      .insert(notificationDevices)
      .values({ ...parsed.data, userId: c.var.user.id, sessionId: session.sid })
      .onConflictDoUpdate({
        target: notificationDevices.token,
        set: {
          userId: c.var.user.id,
          sessionId: session.sid,
          platform: parsed.data.platform,
          ...(changedAccount ? { createdAt: new Date() } : {}),
        },
      });
  });
  return c.json({ registered: true });
});
mobileRoutes.delete('/devices', async (c) => {
  const parsed = z
    .object({ token: z.string().max(256) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Invalid device.' }, 400);
  await db
    .delete(notificationDevices)
    .where(
      and(
        eq(notificationDevices.token, parsed.data.token),
        eq(notificationDevices.userId, c.var.user.id),
      ),
    );
  return c.json({ removed: true });
});
mobileRoutes.patch('/notifications/:id/read', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ message: 'Invalid notification.' }, 400);
  await db
    .update(notifications)
    .set({ readStatus: true })
    .where(
      and(
        eq(notifications.notificationId, id.data),
        eq(notifications.userId, c.var.user.id),
      ),
    );
  return c.json({ read: true });
});
