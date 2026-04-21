import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import type { AuthUser } from '../middleware/auth.middleware.js';
import {
  saveBusinessProfileImage,
  tryRemoveBusinessProfileImage,
} from '../lib/businessProfileImageUpload.js';
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
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  imagePath: z.string().trim().min(1).optional(),
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
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    imagePath: z
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

function parseOptionalString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function parseOptionalCoordinate(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

type AuthContext = Context<{ Variables: { user: AuthUser } }>;

function assertBusinessProfileReadAccess(
  c: AuthContext,
  profileUserId: string,
): Response | null {
  const user = c.var.user;
  if (user.role === 'admin') return null;
  if (user.role === 'business' && user.id === profileUserId) return null;
  return c.json({ message: 'Forbidden.' }, 403);
}

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
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  let userId: string;
  let businessName: string;
  let businessType: string | undefined;
  let address: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let imagePath: string | undefined;
  let status: (typeof businessStatusValues)[number] | undefined;
  let approvedDate: Date | undefined;

  if (ct.includes('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return c.json({ message: 'Invalid multipart body.' }, 400);
    }

    const parsedUserId = parseOptionalString(body.userId);
    if (!parsedUserId || !z.string().uuid().safeParse(parsedUserId).success) {
      return c.json({ message: 'Valid userId is required.' }, 400);
    }
    const parsedBusinessName = parseOptionalString(body.businessName);
    if (!parsedBusinessName) {
      return c.json({ message: 'Business name is required.' }, 400);
    }

    userId = parsedUserId;
    businessName = parsedBusinessName;
    businessType = parseOptionalString(body.businessType);
    address = parseOptionalString(body.address);
    latitude = parseOptionalCoordinate(body.latitude);
    longitude = parseOptionalCoordinate(body.longitude);
    if (latitude === undefined || latitude < -90 || latitude > 90) {
      return c.json({ message: 'Valid latitude is required.' }, 400);
    }
    if (longitude === undefined || longitude < -180 || longitude > 180) {
      return c.json({ message: 'Valid longitude is required.' }, 400);
    }

    const statusRaw = parseOptionalString(body.status);
    if (statusRaw !== undefined) {
      if (!businessStatusValues.includes(statusRaw as (typeof businessStatusValues)[number])) {
        return c.json({ message: 'Invalid status value.' }, 400);
      }
      status = statusRaw as (typeof businessStatusValues)[number];
    }

    const approvedRaw = parseOptionalString(body.approvedDate);
    if (approvedRaw !== undefined) {
      const parsedApproved = z.coerce.date().safeParse(approvedRaw);
      if (!parsedApproved.success) {
        return c.json({ message: 'Invalid approvedDate value.' }, 400);
      }
      approvedDate = parsedApproved.data;
    }

    const img = body.image;
    if (img instanceof File && img.size > 0) {
      const saved = await saveBusinessProfileImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      imagePath = saved.publicPath;
    }
  } else {
    const parsed = createBusinessProfileSchema.safeParse(
      await c.req.json(),
    );
    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request payload.' },
        400,
      );
    }
    userId = parsed.data.userId;
    businessName = parsed.data.businessName;
    businessType = parsed.data.businessType;
    address = parsed.data.address;
    latitude = parsed.data.latitude;
    longitude = parsed.data.longitude;
    imagePath = parsed.data.imagePath;
    status = parsed.data.status;
    approvedDate = parsed.data.approvedDate;
  }

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
        latitude,
        longitude,
        imagePath: imagePath ?? undefined,
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

export const updateBusinessProfile = async (c: AuthContext) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const actor = c.var.user;
  if (actor.role === 'business' && actor.id !== params.data.id) {
    return c.json({ message: 'Forbidden.' }, 403);
  }

  const [existing] = await db
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.userId, params.data.id))
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  const patch: Partial<typeof businessProfile.$inferInsert> = {};
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return c.json({ message: 'Invalid multipart body.' }, 400);
    }

    const businessName = parseOptionalString(body.businessName);
    if (businessName !== undefined) patch.businessName = businessName;

    if (body.businessType !== undefined) {
      patch.businessType =
        body.businessType === ''
          ? null
          : parseOptionalString(body.businessType) ?? null;
    }

    if (body.address !== undefined) {
      patch.address =
        body.address === '' ? null : parseOptionalString(body.address) ?? null;
    }

    if (body.latitude !== undefined) {
      if (body.latitude === '') {
        patch.latitude = null;
      } else {
        const latitude = parseOptionalCoordinate(body.latitude);
        if (latitude === undefined || latitude < -90 || latitude > 90) {
          return c.json({ message: 'Invalid latitude value.' }, 400);
        }
        patch.latitude = latitude;
      }
    }

    if (body.longitude !== undefined) {
      if (body.longitude === '') {
        patch.longitude = null;
      } else {
        const longitude = parseOptionalCoordinate(body.longitude);
        if (longitude === undefined || longitude < -180 || longitude > 180) {
          return c.json({ message: 'Invalid longitude value.' }, 400);
        }
        patch.longitude = longitude;
      }
    }

    const statusRaw = parseOptionalString(body.status);
    if (statusRaw !== undefined) {
      if (!businessStatusValues.includes(statusRaw as (typeof businessStatusValues)[number])) {
        return c.json({ message: 'Invalid status value.' }, 400);
      }
      patch.status = statusRaw as (typeof businessStatusValues)[number];
    }

    if (body.approvedDate !== undefined) {
      if (body.approvedDate === '') {
        patch.approvedDate = null;
      } else {
        const parsedApproved = z.coerce.date().safeParse(body.approvedDate);
        if (!parsedApproved.success) {
          return c.json({ message: 'Invalid approvedDate value.' }, 400);
        }
        patch.approvedDate = parsedApproved.data;
      }
    }

    const imageRemove = body.image === '';
    const img = body.image;
    if (img instanceof File && img.size > 0) {
      const saved = await saveBusinessProfileImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      await tryRemoveBusinessProfileImage(existing.imagePath);
      patch.imagePath = saved.publicPath;
    } else if (imageRemove) {
      await tryRemoveBusinessProfileImage(existing.imagePath);
      patch.imagePath = null;
    }
  } else {
    const parsed = updateBusinessProfileSchema.safeParse(
      await c.req.json(),
    );
    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request payload.' },
        400,
      );
    }

    if (parsed.data.businessName !== undefined) {
      patch.businessName = parsed.data.businessName.trim();
    }
    if (parsed.data.businessType !== undefined) {
      patch.businessType = parsed.data.businessType;
    }
    if (parsed.data.address !== undefined) {
      patch.address = parsed.data.address;
    }
    if (parsed.data.latitude !== undefined) {
      patch.latitude = parsed.data.latitude;
    }
    if (parsed.data.longitude !== undefined) {
      patch.longitude = parsed.data.longitude;
    }
    if (parsed.data.imagePath !== undefined) {
      patch.imagePath = parsed.data.imagePath;
    }
    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status;
    }
    if (parsed.data.approvedDate !== undefined) {
      patch.approvedDate = parsed.data.approvedDate;
    }
  }

  if (Object.keys(patch).length === 0) {
    return c.json(
      { message: 'At least one field is required.' },
      400,
    );
  }

  if (actor.role === 'business') {
    delete patch.status;
    delete patch.approvedDate;
  }

  if (Object.keys(patch).length === 0) {
    return c.json(
      { message: 'At least one field is required.' },
      400,
    );
  }

  const [updated] = await db
    .update(businessProfile)
    .set(patch)
    .where(eq(businessProfile.userId, params.data.id))
    .returning();

  return c.json({ profile: updated });
};

export const deleteBusinessProfile = async (c: Context) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const [existing] = await db
    .select({ imagePath: businessProfile.imagePath })
    .from(businessProfile)
    .where(eq(businessProfile.userId, params.data.id))
    .limit(1);
  if (!existing) {
    return c.json({ message: 'Profile not found.' }, 404);
  }

  const [removed] = await db
    .delete(businessProfile)
    .where(eq(businessProfile.userId, params.data.id))
    .returning({ userId: businessProfile.userId });

  await tryRemoveBusinessProfileImage(existing.imagePath);

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

/** Storefront: approved businesses only, no auth. */
export const getPublicApprovedBusinessProfiles = async (c: Context) => {
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
    .where(eq(businessProfile.status, 'approved'))
    .orderBy(desc(businessProfile.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    profiles: rows,
    limit,
    offset,
  });
};

export const getBusinessProfileById = async (c: AuthContext) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid user id.' }, 400);
  }

  const denied = assertBusinessProfileReadAccess(c, params.data.id);
  if (denied) return denied;

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
