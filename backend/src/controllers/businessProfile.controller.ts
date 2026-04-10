import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { businessProfile, users } from '../schema.js';

const businessStatusValues = [
  'pending',
  'approved',
  'rejected',
] as const;

const createBusinessProfileSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().trim().min(1),
  businessType: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  status: z.enum(businessStatusValues).optional(),
  approvedDate: z.coerce.date().optional(),
});

const updateBusinessProfileSchema = z
  .object({
    businessName: z.string().trim().min(1).optional(),
    businessType: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    address: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    status: z.enum(businessStatusValues).optional(),
    approvedDate: z.coerce.date().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function assertUserRole(
  userId: string,
  role: 'business',
): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === role;
}

export const createBusinessProfile = async (c: Context) => {
  const parsed = createBusinessProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const {
    userId,
    businessName,
    businessType,
    address,
    status,
    approvedDate,
  } = parsed.data;

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) {
    return c.json({ message: 'User not found.' }, 404);
  }

  if (!(await assertUserRole(userId, 'business'))) {
    return c.json(
      { message: 'User must have business role.' },
      400,
    );
  }

  try {
    const [created] = await db
      .insert(businessProfile)
      .values({
        userId,
        businessName: businessName.trim(),
        businessType: businessType ?? undefined,
        address: address ?? undefined,
        status: status ?? 'pending',
        approvedDate: approvedDate ?? undefined,
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

export const updateBusinessProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const parsed = updateBusinessProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const patch: Partial<typeof businessProfile.$inferInsert> = {};
  if (parsed.data.businessName !== undefined) {
    patch.businessName = parsed.data.businessName.trim();
  }
  if (parsed.data.businessType !== undefined) {
    patch.businessType = parsed.data.businessType;
  }
  if (parsed.data.address !== undefined) {
    patch.address = parsed.data.address;
  }
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
  }
  if (parsed.data.approvedDate !== undefined) {
    patch.approvedDate = parsed.data.approvedDate;
  }

  const [updated] = await db
    .update(businessProfile)
    .set(patch)
    .where(eq(businessProfile.userId, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: updated });
};

export const deleteBusinessProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [removed] = await db
    .delete(businessProfile)
    .where(eq(businessProfile.userId, params.data.id))
    .returning({ userId: businessProfile.userId });

  if (!removed) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({
    message: 'Profile deleted.',
    userId: removed.userId,
  });
};

export const getAllBusinessProfiles = async (c: Context) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(businessProfile)
    .orderBy(desc(businessProfile.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    profiles: rows,
    limit,
    offset,
  });
};

export const getBusinessProfileById = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.userId, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: row });
};
