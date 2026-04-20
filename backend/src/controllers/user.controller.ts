import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import argon2 from 'argon2';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { driverProfile, users } from '../schema.js';

const userRoleValues = [
  'customer',
  'driver',
  'business',
  'admin',
] as const;
const userStatusValues = [
  'active',
  'inactive',
  'suspended',
] as const;

const passwordMin = Number(
  process.env.PASSWORD_MIN_LENGTH ?? 8,
);

const createUserSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phoneNumber: z.string().trim().min(8).optional(),
  password: z.string().min(passwordMin),
  role: z.enum(userRoleValues),
  status: z.enum(userStatusValues).optional(),
});

const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).optional(),
    email: z.string().trim().email().optional(),
    phoneNumber: z
      .union([
        z.string().trim().min(8),
        z.literal('').transform(() => null),
      ])
      .optional(),
    password: z.string().min(passwordMin).optional(),
    role: z.enum(userRoleValues).optional(),
    status: z.enum(userStatusValues).optional(),
    isVerified: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phoneNumber: string): string {
  return phoneNumber.replace(/\s+/g, '');
}

function toPublicUser(row: typeof users.$inferSelect) {
  const { passwordHash: _p, ...rest } = row;
  return rest;
}

export const createUser = async (c: Context) => {
  const parsed = createUserSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const phoneNumber = parsed.data.phoneNumber
    ? normalizePhone(parsed.data.phoneNumber)
    : null;
  const passwordHash = await argon2.hash(parsed.data.password);

  try {
    const [created] = await db
      .insert(users)
      .values({
        fullName: parsed.data.fullName.trim(),
        email,
        phoneNumber,
        passwordHash,
        role: parsed.data.role,
        status: parsed.data.status ?? 'active',
      })
      .returning();

    return c.json({ user: toPublicUser(created) }, 201);
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') {
      return c.json(
        { message: 'Email or phone number is already in use.' },
        409,
      );
    }
    throw err;
  }
};

export const updateUser = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const parsed = updateUserSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, params.data.id))
    .limit(1);

  if (!existing[0]) {
    return c.json({ message: 'User not found.' }, 404);
  }

  const patch: Partial<typeof users.$inferInsert> = {};

  if (parsed.data.fullName !== undefined) {
    patch.fullName = parsed.data.fullName.trim();
  }
  if (parsed.data.email !== undefined) {
    patch.email = normalizeEmail(parsed.data.email);
  }
  if (parsed.data.phoneNumber !== undefined) {
    patch.phoneNumber =
      parsed.data.phoneNumber === null
        ? null
        : normalizePhone(parsed.data.phoneNumber);
  }
  if (parsed.data.password !== undefined) {
    patch.passwordHash = await argon2.hash(
      parsed.data.password,
    );
  }
  if (parsed.data.role !== undefined) {
    patch.role = parsed.data.role;
  }
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
  }
  if (parsed.data.isVerified !== undefined) {
    patch.isVerified = parsed.data.isVerified;
    patch.verifiedAt = parsed.data.isVerified
      ? new Date()
      : null;
  }

  try {
    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, params.data.id))
      .returning();

    if (!updated) {
      return c.json({ message: 'User not found.' }, 404);
    }

    return c.json({ user: toPublicUser(updated) });
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') {
      return c.json(
        { message: 'Email or phone number is already in use.' },
        409,
      );
    }
    throw err;
  }
};

export const deleteUser = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [removed] = await db
    .delete(users)
    .where(eq(users.id, params.data.id))
    .returning({ id: users.id });

  if (!removed) {
    return c.json({ message: 'User not found.' }, 404);
  }

  return c.json({ message: 'User deleted.', id: removed.id });
};

export const getAllUsers = async (c: Context) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const roleRaw = c.req.query('role')?.trim().toLowerCase();
  const roleFilter =
    roleRaw && (userRoleValues as readonly string[]).includes(roleRaw)
      ? (roleRaw as (typeof userRoleValues)[number])
      : undefined;
  const driverAvailable =
    c.req.query('driverAvailable')?.trim().toLowerCase() === 'true';

  if (roleFilter === 'driver' && driverAvailable) {
    const userCols = getTableColumns(users);
    const rows = await db
      .select(userCols)
      .from(users)
      .innerJoin(driverProfile, eq(driverProfile.userId, users.id))
      .where(
        and(
          eq(users.role, 'driver'),
          eq(users.status, 'active'),
          eq(driverProfile.isAvailable, true),
        ),
      )
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      users: rows.map((row) => toPublicUser(row as typeof users.$inferSelect)),
      limit,
      offset,
    });
  }

  const whereParts = [];
  if (roleFilter) {
    whereParts.push(eq(users.role, roleFilter));
  }

  const rows =
    whereParts.length > 0
      ? await db
          .select()
          .from(users)
          .where(and(...whereParts))
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);

  return c.json({
    users: rows.map(toPublicUser),
    limit,
    offset,
  });
};

export const getUserById = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'User not found.' }, 404);
  }

  return c.json({ user: toPublicUser(row) });
};
