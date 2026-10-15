import { and, asc, eq, ilike } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import {
  canAccessBusinessData,
  type CatalogEnv,
} from '../lib/catalogAccess.js';
import {
  saveCategoryItemImage,
  tryRemoveStoredImage,
} from '../lib/categoryItemImageUpload.js';
import {
  businessProfile,
  categoryItems,
  categoryNameCatalog,
  productCategories,
} from '../schema.js';

function formatMoney(n: number): string {
  return n.toFixed(2);
}

const createItemJsonSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
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

function parseOptionalString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function parseBoolField(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return undefined;
}

function parseOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

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
  const ct = (c.req.header('content-type') ?? '').toLowerCase();

  if (ct.includes('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return c.json({ message: 'Invalid multipart body.' }, 400);
    }

    const categoryId = parseOptionalString(body.categoryId);
    if (!categoryId || !z.string().uuid().safeParse(categoryId).success) {
      return c.json({ message: 'Valid categoryId is required.' }, 400);
    }

    const name = parseOptionalString(body.name);
    if (!name || name.length < 1) {
      return c.json({ message: 'Name is required.' }, 400);
    }

    const description = parseOptionalString(body.description);
    const priceRaw = body.price;
    const priceNum =
      typeof priceRaw === 'string' || typeof priceRaw === 'number'
        ? Number(priceRaw)
        : NaN;
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return c.json({ message: 'Valid price is required.' }, 400);
    }

    const discountRaw = body.discount;
    let discount: number | null | undefined;
    if (
      discountRaw === undefined ||
      discountRaw === null ||
      discountRaw === ''
    ) {
      discount = undefined;
    } else {
      const d = Number(discountRaw);
      if (!Number.isFinite(d) || d < 0) {
        return c.json({ message: 'Invalid discount.' }, 400);
      }
      discount = d;
    }

    const isAvailable =
      parseBoolField(body.isAvailable) ?? true;
    const sortOrderRaw = body.sortOrder;
    const sortOrder =
      sortOrderRaw === undefined || sortOrderRaw === ''
        ? 0
        : Math.trunc(Number(sortOrderRaw)) || 0;

    const img = body.image;
    let imagePath: string | undefined;
    if (img instanceof File && img.size > 0) {
      const saved = await saveCategoryItemImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      imagePath = saved.publicPath;
    }

    const access = await assertCategoryAccess(c, categoryId);
    if (!access.ok) return access.response;

    const [created] = await db
      .insert(categoryItems)
      .values({
        categoryId,
        name,
        description: description ?? undefined,
        imagePath: imagePath ?? undefined,
        price: formatMoney(priceNum),
        discount:
          discount === undefined
            ? undefined
            : discount === null
              ? null
              : formatMoney(discount),
        isAvailable,
        sortOrder,
      })
      .returning();

    return c.json({ item: created }, 201);
  }

  const parsed = createItemJsonSchema.safeParse(await c.req.json());
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

  const ct = (c.req.header('content-type') ?? '').toLowerCase();

  if (ct.includes('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return c.json({ message: 'Invalid multipart body.' }, 400);
    }

    const patch: Partial<typeof categoryItems.$inferInsert> = {};

    const name = parseOptionalString(body.name);
    if (name !== undefined) {
      if (name.length < 1) {
        return c.json({ message: 'Name cannot be empty.' }, 400);
      }
      patch.name = name;
    }

    if (body.description !== undefined) {
      if (body.description === '') {
        patch.description = null;
      } else {
        const d = parseOptionalString(body.description);
        if (d !== undefined) patch.description = d;
      }
    }

    const priceNum = parseOptionalNumber(body.price);
    if (priceNum !== undefined) {
      patch.price = formatMoney(priceNum);
    }

    if (body.discount !== undefined && body.discount !== '') {
      const d = parseOptionalNumber(body.discount);
      if (d !== undefined) {
        patch.discount = formatMoney(d);
      }
    } else if (body.discount === '') {
      patch.discount = null;
    }

    const av = parseBoolField(body.isAvailable);
    if (av !== undefined) patch.isAvailable = av;

    const so = body.sortOrder;
    if (so !== undefined && so !== '') {
      const n = Math.trunc(Number(so));
      if (Number.isFinite(n)) patch.sortOrder = n;
    }

    const img = body.image;
    if (img instanceof File && img.size > 0) {
      const saved = await saveCategoryItemImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      await tryRemoveStoredImage(existing.imagePath);
      patch.imagePath = saved.publicPath;
    }

    if (Object.keys(patch).length === 0) {
      return c.json(
        { message: 'At least one field is required.' },
        400,
      );
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
  }

  const parsed = updateItemSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const patch: Partial<typeof categoryItems.$inferInsert> = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name.trim();
  }
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description;
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

  await tryRemoveStoredImage(existing.imagePath);

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
  if (categoryId && !z.string().uuid().safeParse(categoryId).success) {
    return c.json({ message: 'Invalid categoryId query parameter.' }, 400);
  }
  if (categoryId) {
    const [category] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, categoryId))
      .limit(1);
    if (!category) {
      return c.json({ message: 'Category not found.' }, 404);
    }
  }

  const businessId = c.req.query('businessId')?.trim();
  if (businessId && !z.string().uuid().safeParse(businessId).success) {
    return c.json({ message: 'Invalid businessId query parameter.' }, 400);
  }
  if (businessId) {
    const [biz] = await db
      .select({ id: businessProfile.userId })
      .from(businessProfile)
      .where(eq(businessProfile.userId, businessId))
      .limit(1);
    if (!biz) {
      return c.json({ message: 'Business not found.' }, 404);
    }
  }

  const qRaw = c.req.query('q')?.trim() ?? '';
  const qClean = qRaw.slice(0, 120).replace(/[%_\\]/g, '');

  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 50) || 50, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const conditions = [];
  const categoryNameId = c.req.query('categoryNameId')?.trim();
  if (categoryNameId) {
    if (!z.string().uuid().safeParse(categoryNameId).success) return c.json({ message: 'Invalid category name id.' }, 400);
    conditions.push(eq(productCategories.categoryNameId, categoryNameId));
  }
  if (categoryId) {
    conditions.push(eq(categoryItems.categoryId, categoryId));
  }
  if (businessId) {
    conditions.push(eq(productCategories.businessId, businessId));
  }
  if (qClean.length > 0) {
    conditions.push(ilike(categoryItems.name, `%${qClean}%`));
  }
  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const baseQuery = db
    .select({
      id: categoryItems.id,
      categoryId: categoryItems.categoryId,
      name: categoryItems.name,
      description: categoryItems.description,
      imagePath: categoryItems.imagePath,
      price: categoryItems.price,
      discount: categoryItems.discount,
      isAvailable: categoryItems.isAvailable,
      sortOrder: categoryItems.sortOrder,
      createdAt: categoryItems.createdAt,
      updatedAt: categoryItems.updatedAt,
      categoryNameId: productCategories.categoryNameId,
      categoryName: categoryNameCatalog.name,
      businessId: productCategories.businessId,
      businessName: businessProfile.businessName,
    })
    .from(categoryItems)
    .innerJoin(
      productCategories,
      eq(categoryItems.categoryId, productCategories.id),
    )
    .innerJoin(
      categoryNameCatalog,
      eq(productCategories.categoryNameId, categoryNameCatalog.id),
    )
    .innerJoin(
      businessProfile,
      eq(productCategories.businessId, businessProfile.userId),
    );

  const rows = await (whereExpr ? baseQuery.where(whereExpr) : baseQuery)
    .orderBy(
      c.req.query('sort') === 'name' ? asc(categoryItems.name) : c.req.query('sort') === 'price' ? asc(categoryItems.price) : asc(categoryItems.sortOrder),
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

  const [category] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.id, row.categoryId))
    .limit(1);
  if (!category) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  return c.json({ item: row });
};
