import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { adminProfile, users } from '../schema.js';

const adminLevelValues = [
  'call_center',
  'manager',
  'super_admin',
] as const;

const createAdminProfileSchema = z.object({
  userId: z.string().uuid(),
  level: z.enum(adminLevelValues).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

const updateAdminProfileSchema = z
  .object({
    level: z.enum(adminLevelValues).optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function assertUserRole(
  userId: string,
  role: 'admin',
): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === role;
}

export const createAdminProfile = async (c: Context) => {
  const parsed = createAdminProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const { userId, level, permissions } = parsed.data;

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) {
    return c.json({ message: 'User not found.' }, 404);
  }

  if (!(await assertUserRole(userId, 'admin'))) {
    return c.json(
      { message: 'User must have admin role.' },
      400,
    );
  }

  try {
    const [created] = await db
      .insert(adminProfile)
      .values({
        userId,
        level: level ?? 'call_center',
        permissions: permissions ?? undefined,
      })
      .returning();

    return c.json({ profile: created }, 201);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') {
      return c.json(
        { message: 'Profile already exists for this user.' },
        409,
      );
    }
    throw err;
  }
};

export const updateAdminProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const parsed = updateAdminProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const patch: Partial<typeof adminProfile.$inferInsert> = {};
  if (parsed.data.level !== undefined) {
    patch.level = parsed.data.level;
  }
  if (parsed.data.permissions !== undefined) {
    patch.permissions = parsed.data.permissions;
  }

  const [updated] = await db
    .update(adminProfile)
    .set(patch)
    .where(eq(adminProfile.userId, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: updated });
};

export const deleteAdminProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [removed] = await db
    .delete(adminProfile)
    .where(eq(adminProfile.userId, params.data.id))
    .returning({ userId: adminProfile.userId });

  if (!removed) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({
    message: 'Profile deleted.',
    userId: removed.userId,
  });
};

export const getAllAdminProfiles = async (c: Context) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(adminProfile)
    .orderBy(desc(adminProfile.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    profiles: rows,
    limit,
    offset,
  });
};

export const getAdminProfileById = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(adminProfile)
    .where(eq(adminProfile.userId, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: row });
};
