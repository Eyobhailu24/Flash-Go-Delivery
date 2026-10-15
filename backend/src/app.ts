import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { uploadRoot } from './lib/categoryItemImageUpload.js';
import { db } from './db.js';
import { users } from './schema.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { cartRoutes } from './routes/cart.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { driverDispatchRoutes } from './routes/driver-dispatch.routes.js';
import { notificationsRoutes } from './routes/notifications.routes.js';
import { mobileRoutes } from './routes/mobile.routes.js';
// Telegram bot disabled locally to avoid Grammy 409 (duplicate getUpdates).
// Re-enable when only one bot instance uses this token: import './bot/index.js';

export const app = new Hono();

const frontendOrigin = (
  process.env.FRONTEND_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
app.use(
  '*',
  cors({
    origin: [
      frontendOrigin,
      'http://localhost:3000',
      'http://localhost:8081',
      'https://flash-go-delivery-production-ffed.up.railway.app',
    ],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/', (c) => c.json({ message: 'FlashGo backend is running' }));

app.get('/uploads/*', async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const prefix = '/uploads/';
  if (!pathname.startsWith(prefix)) {
    return c.notFound();
  }
  const rel = pathname.slice(prefix.length);
  if (!rel || rel.includes('..')) {
    return c.notFound();
  }
  const parts = rel.split('/').filter((p) => p && p !== '.' && p !== '..');
  if (parts.length === 0) return c.notFound();
  const abs = join(uploadRoot(), ...parts);
  try {
    const data = await readFile(abs);
    const ext = parts[parts.length - 1]?.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : 'application/octet-stream';
    return new Response(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return c.notFound();
  }
});

app.route('/auth', authRoutes);
app.route('/users', userRoutes);
app.route('/profiles', profileRoutes);
app.route('/catalog', catalogRoutes);
app.route('/carts', cartRoutes);
app.route('/orders', orderRoutes);
app.route('/payments', paymentRoutes);
app.route('/driver-dispatch', driverDispatchRoutes);
app.route('/notifications', notificationsRoutes);
app.route('/mobile', mobileRoutes);

app.get('/health', async (c) => {
  await db.select({ id: users.id }).from(users).limit(1);
  return c.json({ ok: true });
});
