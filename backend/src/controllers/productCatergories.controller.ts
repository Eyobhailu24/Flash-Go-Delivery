import { asc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import {
  canAccessBusinessData,
  resolveListBusinessId,
  resolveWriteBusinessId,
  type CatalogEnv,
} from '../lib/catalogAccess.js';
import { productCategories } from '../schema.js';

const createCategorySchema = z.object({
  businessId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    imageUrl: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const createProductCategory = async (
  c: Context<CatalogEnv>,
) => {
  const parsed = createCategorySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const scope = await resolveWriteBusinessId(
    c,
    parsed.data.businessId,
  );
  if (!scope.ok) return scope.response;

  const [created] = await db
    .insert(productCategories)
    .values({
      businessId: scope.businessId,
      name: parsed.data.name.trim(),
      imageUrl: parsed.data.imageUrl ?? undefined,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  return c.json({ category: created }, 201);
};

export const updateProductCategory = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid category id.' }, 400);
  }

  const parsed = updateCategorySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const [existing] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, params.data.id))
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  if (
    !canAccessBusinessData(c.var.user, existing.businessId)
  ) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  const patch: Partial<
    typeof productCategories.$inferInsert
  > = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name.trim();
  }
  if (parsed.data.imageUrl !== undefined) {
    patch.imageUrl = parsed.data.imageUrl;
  }
  if (parsed.data.sortOrder !== undefined) {
    patch.sortOrder = parsed.data.sortOrder;
  }

  const [updated] = await db
    .update(productCategories)
    .set(patch)
    .where(eq(productCategories.id, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  return c.json({ category: updated });
};

export const deleteProductCategory = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid category id.' }, 400);
  }

  const [existing] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, params.data.id))
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  if (
    !canAccessBusinessData(c.var.user, existing.businessId)
  ) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  const [removed] = await db
    .delete(productCategories)
    .where(eq(productCategories.id, params.data.id))
    .returning({ id: productCategories.id });

  if (!removed) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  return c.json({
    message: 'Category deleted.',
    id: removed.id,
  });
};

export const getAllProductCategories = async (
  c: Context<CatalogEnv>,
) => {
  const scope = await resolveListBusinessId(
    c,
    c.req.query('businessId'),
  );
  if (!scope.ok) return scope.response;

  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(productCategories)
    .where(
      eq(productCategories.businessId, scope.businessId),
    )
    .orderBy(
      asc(productCategories.sortOrder),
      asc(productCategories.createdAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({
    categories: rows,
    limit,
    offset,
  });
};

export const getProductCategoryById = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid category id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  if (!canAccessBusinessData(c.var.user, row.businessId)) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  return c.json({ category: row });
};
