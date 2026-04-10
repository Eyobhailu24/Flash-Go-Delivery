import { asc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import {
  canAccessBusinessData,
  type CatalogEnv,
} from '../lib/catalogAccess.js';
import { categoryItems, productCategories } from '../schema.js';

function formatMoney(n: number): string {
  return n.toFixed(2);
}

const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().min(1).optional(),
  price: z.coerce.number().finite().nonnegative(),
  discount: z
    .union([
      z.coerce.number().finite().nonnegative(),
      z.null(),
    ])
    .optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z
      .union([
        z.string().trim(),
        z.literal('').transform(() => null),
      ])
      .optional(),
    imageUrl: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
      ])
      .optional(),
    price: z.coerce.number().finite().nonnegative().optional(),
    discount: z
      .union([
        z.coerce.number().finite().nonnegative(),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function assertCategoryAccess(
  c: Context<CatalogEnv>,
  categoryId: string,
): Promise<
  | { ok: true; category: typeof productCategories.$inferSelect }
  | { ok: false; response: Response }
> {
  const [cat] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, categoryId))
    .limit(1);

  if (!cat) {
    return {
      ok: false,
      response: c.json({ message: 'Category not found.' }, 404),
    };
  }

  if (!canAccessBusinessData(c.var.user, cat.businessId)) {
    return {
      ok: false,
      response: c.json({ message: 'Category not found.' }, 404),
    };
  }

  return { ok: true, category: cat };
}

export const createCategoryItem = async (
  c: Context<CatalogEnv>,
) => {
  const parsed = createItemSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const access = await assertCategoryAccess(
    c,
    parsed.data.categoryId,
  );
  if (!access.ok) return access.response;

  const discountVal = parsed.data.discount;
  const [created] = await db
    .insert(categoryItems)
    .values({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name.trim(),
      description: parsed.data.description ?? undefined,
      imageUrl: parsed.data.imageUrl ?? undefined,
      price: formatMoney(parsed.data.price),
      discount:
        discountVal === undefined
          ? undefined
          : discountVal === null
            ? null
            : formatMoney(discountVal),
      isAvailable: parsed.data.isAvailable ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  return c.json({ item: created }, 201);
};

export const updateCategoryItem = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid item id.' }, 400);
  }

  const parsed = updateItemSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const [existing] = await db
    .select()
    .from(categoryItems)
    .where(eq(categoryItems.id, params.data.id))
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Item not found.' }, 404);
  }

  const access = await assertCategoryAccess(
    c,
    existing.categoryId,
  );
  if (!access.ok) return access.response;

  const patch: Partial<typeof categoryItems.$inferInsert> = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name.trim();
  }
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description;
  }
  if (parsed.data.imageUrl !== undefined) {
    patch.imageUrl = parsed.data.imageUrl;
  }
  if (parsed.data.price !== undefined) {
    patch.price = formatMoney(parsed.data.price);
  }
  if (parsed.data.discount !== undefined) {
    patch.discount =
      parsed.data.discount === null
        ? null
        : formatMoney(parsed.data.discount);
  }
  if (parsed.data.isAvailable !== undefined) {
    patch.isAvailable = parsed.data.isAvailable;
  }
  if (parsed.data.sortOrder !== undefined) {
    patch.sortOrder = parsed.data.sortOrder;
  }

  const [updated] = await db
    .update(categoryItems)
    .set(patch)
    .where(eq(categoryItems.id, params.data.id))
    .returning();

  if (!updated) {
    return c.json({ message: 'Item not found.' }, 404);
  }

  return c.json({ item: updated });
};

export const deleteCategoryItem = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid item id.' }, 400);
  }

  const [existing] = await db
    .select()
    .from(categoryItems)
    .where(eq(categoryItems.id, params.data.id))
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Item not found.' }, 404);
  }

  const access = await assertCategoryAccess(
    c,
    existing.categoryId,
  );
  if (!access.ok) return access.response;

  const [removed] = await db
    .delete(categoryItems)
    .where(eq(categoryItems.id, params.data.id))
    .returning({ id: categoryItems.id });

  if (!removed) {
    return c.json({ message: 'Item not found.' }, 404);
  }

  return c.json({ message: 'Item deleted.', id: removed.id });
};

export const getAllCategoryItems = async (
  c: Context<CatalogEnv>,
) => {
  const categoryId = c.req.query('categoryId')?.trim();
  if (!categoryId || !z.string().uuid().safeParse(categoryId).success) {
    return c.json(
      { message: 'categoryId query parameter is required.' },
      400,
    );
  }

  const access = await assertCategoryAccess(c, categoryId);
  if (!access.ok) return access.response;

  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select()
    .from(categoryItems)
    .where(eq(categoryItems.categoryId, categoryId))
    .orderBy(
      asc(categoryItems.sortOrder),
      asc(categoryItems.createdAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({
    items: rows,
    limit,
    offset,
  });
};

export const getCategoryItemById = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid item id.' }, 400);
  }

  const [row] = await db
    .select()
    .from(categoryItems)
    .where(eq(categoryItems.id, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Item not found.' }, 404);
  }

  const access = await assertCategoryAccess(c, row.categoryId);
  if (!access.ok) return access.response;

  return c.json({ item: row });
};
