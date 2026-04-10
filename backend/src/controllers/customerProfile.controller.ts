import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { customerProfile, users } from '../schema.js';

const addressEntrySchema = z.object({
  label: z.string().optional(),
  address: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

const createCustomerProfileSchema = z.object({
  userId: z.string().uuid(),
  addresses: z.array(addressEntrySchema).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
});

const updateCustomerProfileSchema = z
  .object({
    addresses: z.array(addressEntrySchema).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    loyaltyPoints: z.number().int().min(0).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function assertUserRole(
  userId: string,
  role: 'customer',
): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === role;
}

export const createCustomerProfile = async (c: Context) => {
  const parsed = createCustomerProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const { userId, addresses, preferences, loyaltyPoints } =
    parsed.data;

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) {
    return c.json({ message: 'User not found.' }, 404);
  }

  if (!(await assertUserRole(userId, 'customer'))) {
    return c.json(
      { message: 'User must have customer role.' },
      400,
    );
  }

  try {
    const [created] = await db
      .insert(customerProfile)
      .values({
        userId,
        addresses: addresses ?? undefined,
        preferences: preferences ?? undefined,
        loyaltyPoints: loyaltyPoints ?? 0,
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

export const updateCustomerProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const parsed = updateCustomerProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const patch: Partial<typeof customerProfile.$inferInsert> = {};
  if (parsed.data.addresses !== undefined) {
    patch.addresses = parsed.data.addresses;
  }
  if (parsed.data.preferences !== undefined) {
    patch.preferences = parsed.data.preferences;
  }
  if (parsed.data.loyaltyPoints !== undefined) {
    patch.loyaltyPoints = parsed.data.loyaltyPoints;
  }

  const [updated] = await db
    .update(customerProfile)
    .set(patch)
    .where(eq(customerProfile.userId, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: updated });
};

export const deleteCustomerProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [removed] = await db
    .delete(customerProfile)
    .where(eq(customerProfile.userId, params.data.id))
    .returning({ userId: customerProfile.userId });

  if (!removed) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({
    message: 'Profile deleted.',
    userId: removed.userId,
  });
};

export const getAllCustomerProfiles = async (c: Context) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(customerProfile)
    .orderBy(desc(customerProfile.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    profiles: rows,
    limit,
    offset,
  });
};

export const getCustomerProfileById = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(customerProfile)
    .where(eq(customerProfile.userId, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: row });
};
