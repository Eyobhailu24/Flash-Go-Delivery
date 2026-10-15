import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { readAccessPayload } from '../lib/mobile-auth.js';
import { db } from '../db.js';
import { users } from '../schema.js';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phoneNumber: string | null;
};

type AuthEnv = { Variables: { user: AuthUser } };

export const protect: MiddlewareHandler<AuthEnv> = async (
  c,
  next,
) => {
  const payload = await readAccessPayload(c);
  if (!payload) {
    return c.json({ message: 'Unauthorized.' }, 401);
  }

  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  const user = result[0];
  if (!user) {
    return c.json({ message: 'Unauthorized.' }, 401);
  }

  c.set('user', user);
  return next();
};

export function restrictTo(
  ...roles: Array<'customer' | 'driver' | 'business' | 'admin'>
): MiddlewareHandler<AuthEnv> {
  const allowed: readonly string[] = roles;
  return async (c, next) => {
    const user = c.var.user;
    if (!allowed.includes(user.role)) {
      return c.json({ message: 'Forbidden.' }, 403);
    }
    return next();
  };
}
