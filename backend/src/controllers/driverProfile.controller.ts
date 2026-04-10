import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { driverProfile, users } from '../schema.js';

const createDriverProfileSchema = z.object({
  userId: z.string().uuid(),
  vehicleType: z.string().trim().min(1).optional(),
  licenseNumber: z.string().trim().min(1).optional(),
  rating: z.number().min(0).optional(),
  isAvailable: z.boolean().optional(),
  joiningDate: z.coerce.date().optional(),
});

const updateDriverProfileSchema = z
  .object({
    vehicleType: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    licenseNumber: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    rating: z.number().min(0).optional(),
    isAvailable: z.boolean().optional(),
    joiningDate: z.coerce.date().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function assertUserRole(
  userId: string,
  role: 'driver',
): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === role;
}

export const createDriverProfile = async (c: Context) => {
  const parsed = createDriverProfileSchema.safeParse(
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
    vehicleType,
    licenseNumber,
    rating,
    isAvailable,
    joiningDate,
  } = parsed.data;

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) {
    return c.json({ message: 'User not found.' }, 404);
  }

  if (!(await assertUserRole(userId, 'driver'))) {
    return c.json(
      { message: 'User must have driver role.' },
      400,
    );
  }

  try {
    const [created] = await db
      .insert(driverProfile)
      .values({
        userId,
        vehicleType: vehicleType ?? undefined,
        licenseNumber: licenseNumber ?? undefined,
        rating: rating ?? 0,
        isAvailable: isAvailable ?? false,
        joiningDate: joiningDate ?? undefined,
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

export const updateDriverProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const parsed = updateDriverProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const patch: Partial<typeof driverProfile.$inferInsert> = {};
  if (parsed.data.vehicleType !== undefined) {
    patch.vehicleType = parsed.data.vehicleType;
  }
  if (parsed.data.licenseNumber !== undefined) {
    patch.licenseNumber = parsed.data.licenseNumber;
  }
  if (parsed.data.rating !== undefined) {
    patch.rating = parsed.data.rating;
  }
  if (parsed.data.isAvailable !== undefined) {
    patch.isAvailable = parsed.data.isAvailable;
  }
  if (parsed.data.joiningDate !== undefined) {
    patch.joiningDate = parsed.data.joiningDate;
  }

  const [updated] = await db
    .update(driverProfile)
    .set(patch)
    .where(eq(driverProfile.userId, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: updated });
};

export const deleteDriverProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [removed] = await db
    .delete(driverProfile)
    .where(eq(driverProfile.userId, params.data.id))
    .returning({ userId: driverProfile.userId });

  if (!removed) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({
    message: 'Profile deleted.',
    userId: removed.userId,
  });
};

export const getAllDriverProfiles = async (c: Context) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(driverProfile)
    .orderBy(desc(driverProfile.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    profiles: rows,
    limit,
    offset,
  });
};

export const getDriverProfileById = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(driverProfile)
    .where(eq(driverProfile.userId, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  return c.json({ profile: row });
};
