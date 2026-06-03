import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
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
import './bot/index.js'; // Start the Telegram bot

const app = new Hono();

const frontendOrigin = (
  process.env.FRONTEND_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'https://flash-go-delivery-eth.up.railway.app/',
    ],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
  }),
);

app.get('/', (c) =>
  c.json({ message: 'FlashGo backend is running' }),
);

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
  const parts = rel
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..');
  if (parts.length === 0) return c.notFound();
  const abs = join(uploadRoot(), ...parts);
  try {
    const data = await readFile(abs);
    const ext = parts[parts.length - 1]
      ?.split('.')
      .pop()
      ?.toLowerCase();
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

app.get('/health', async (c) => {
  const result = await db.select().from(users).limit(1);
  return c.json({ ok: true, usersPreview: result });
});

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(
      `Backend running on http://localhost:${port}`,
    );
  },
);
