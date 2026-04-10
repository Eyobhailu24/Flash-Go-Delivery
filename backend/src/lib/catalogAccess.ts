import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { db } from '../db.js';
import type { AuthUser } from '../middleware/auth.middleware.js';
import { users } from '../schema.js';

export type CatalogEnv = { Variables: { user: AuthUser } };

export function canAccessBusinessData(
  user: AuthUser,
  businessId: string,
): boolean {
  if (user.role === 'admin') return true;
  return user.role === 'business' && user.id === businessId;
}

export async function resolveWriteBusinessId(
  c: Context<CatalogEnv>,
  bodyBusinessId: string | undefined,
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; response: Response }
> {
  const u = c.var.user;
  if (u.role === 'business') {
    return { ok: true, businessId: u.id };
  }
  if (u.role !== 'admin') {
    return {
      ok: false,
      response: c.json({ message: 'Forbidden.' }, 403),
    };
  }
  const id = bodyBusinessId?.trim();
  if (!id) {
    return {
      ok: false,
      response: c.json(
        { message: 'businessId is required for admin.' },
        400,
      ),
    };
  }
  const uuidOk = zStringUuid(id);
  if (!uuidOk) {
    return {
      ok: false,
      response: c.json({ message: 'Invalid businessId.' }, 400),
    };
  }
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row || row.role !== 'business') {
    return {
      ok: false,
      response: c.json({ message: 'Invalid business user.' }, 400),
    };
  }
  return { ok: true, businessId: id };
}

export async function resolveListBusinessId(
  c: Context<CatalogEnv>,
  queryBusinessId: string | undefined,
): Promise<
  | { ok: true; businessId: string }
  | { ok: false; response: Response }
> {
  const u = c.var.user;
  if (u.role === 'business') {
    return { ok: true, businessId: u.id };
  }
  if (u.role !== 'admin') {
    return {
      ok: false,
      response: c.json({ message: 'Forbidden.' }, 403),
    };
  }
  const id = queryBusinessId?.trim();
  if (!id) {
    return {
      ok: false,
      response: c.json(
        { message: 'businessId query parameter is required for admin.' },
        400,
      ),
    };
  }
  if (!zStringUuid(id)) {
    return {
      ok: false,
      response: c.json({ message: 'Invalid businessId.' }, 400),
    };
  }
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row || row.role !== 'business') {
    return {
      ok: false,
      response: c.json({ message: 'Invalid business user.' }, 400),
    };
  }
  return { ok: true, businessId: id };
}

function zStringUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}
