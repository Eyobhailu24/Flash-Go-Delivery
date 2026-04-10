import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { db } from './db.js';
import { users } from './schema.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { userRoutes } from './routes/user.routes.js';

const app = new Hono();

const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
app.use(
  '*',
  cors({
    origin: frontendOrigin,
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
app.route('/auth', authRoutes);
app.route('/users', userRoutes);
app.route('/profiles', profileRoutes);
app.route('/catalog', catalogRoutes);

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
