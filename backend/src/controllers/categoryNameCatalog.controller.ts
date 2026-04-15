import { and, asc, eq, ilike, ne, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import {
  saveCategoryNameImage,
  tryRemoveCategoryNameImage,
} from '../lib/categoryNameImageUpload.js';
import type { CatalogEnv } from '../lib/catalogAccess.js';
import { categoryNameCatalog, productCategories } from '../schema.js';

const createSchema = z.object({
  name: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    imagePath: z
      .union([
        z.string().trim().min(1),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

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

async function findByName(
  name: string,
  excludeId?: string,
) {
  const normalized = normalizeName(name);
  const condition = excludeId
    ? and(
        sql`lower(${categoryNameCatalog.name}) = lower(${normalized})`,
        ne(categoryNameCatalog.id, excludeId),
      )
    : sql`lower(${categoryNameCatalog.name}) = lower(${normalized})`;
  const [row] = await db
    .select()
    .from(categoryNameCatalog)
    .where(condition)
    .limit(1);
  return row ?? null;
}

export const createCategoryName = async (
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

    const name = parseOptionalString(body.name);
    if (!name) {
      return c.json({ message: 'Name is required.' }, 400);
    }
    const normalized = normalizeName(name);
    const dupe = await findByName(normalized);
    if (dupe) {
      return c.json(
        { message: 'Category name already exists.' },
        409,
      );
    }

    const isActive = parseBoolField(body.isActive) ?? true;
    let imagePath: string | undefined;
    const img = body.image;
    if (img instanceof File && img.size > 0) {
      const saved = await saveCategoryNameImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      imagePath = saved.publicPath;
    }

    const [created] = await db
      .insert(categoryNameCatalog)
      .values({
        name: normalized,
        isActive,
        imagePath: imagePath ?? undefined,
      })
      .returning();

    return c.json({ categoryName: created }, 201);
  }

  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const normalized = normalizeName(parsed.data.name);
  const dupe = await findByName(normalized);
  if (dupe) {
    return c.json(
      { message: 'Category name already exists.' },
      409,
    );
  }

  const [created] = await db
    .insert(categoryNameCatalog)
    .values({
      name: normalized,
      isActive: parsed.data.isActive ?? true,
      imagePath: undefined,
    })
    .returning();

  return c.json({ categoryName: created }, 201);
};

export const updateCategoryName = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json(
      { message: 'Invalid category name id.' },
      400,
    );
  }

  const [existing] = await db
    .select()
    .from(categoryNameCatalog)
    .where(eq(categoryNameCatalog.id, params.data.id))
    .limit(1);
  if (!existing) {
    return c.json(
      { message: 'Category name not found.' },
      404,
    );
  }

  const patch: Partial<
    typeof categoryNameCatalog.$inferInsert
  > = {};

  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return c.json({ message: 'Invalid multipart body.' }, 400);
    }

    const maybeName = parseOptionalString(body.name);
    if (maybeName !== undefined) {
      const normalized = normalizeName(maybeName);
      const dupe = await findByName(normalized, existing.id);
      if (dupe) {
        return c.json(
          { message: 'Category name already exists.' },
          409,
        );
      }
      patch.name = normalized;
    }

    const active = parseBoolField(body.isActive);
    if (active !== undefined) patch.isActive = active;

    const imageRemove = body.image === '';
    const img = body.image;
    if (img instanceof File && img.size > 0) {
      const saved = await saveCategoryNameImage(img);
      if (!saved.ok) {
        return c.json({ message: saved.message }, 400);
      }
      await tryRemoveCategoryNameImage(existing.imagePath);
      patch.imagePath = saved.publicPath;
    } else if (imageRemove) {
      await tryRemoveCategoryNameImage(existing.imagePath);
      patch.imagePath = null;
    }

    if (Object.keys(patch).length === 0) {
      return c.json(
        { message: 'At least one field is required.' },
        400,
      );
    }
  } else {
    const parsed = updateSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request payload.' },
        400,
      );
    }
    if (parsed.data.name !== undefined) {
      const normalized = normalizeName(parsed.data.name);
      const dupe = await findByName(normalized, existing.id);
      if (dupe) {
        return c.json(
          { message: 'Category name already exists.' },
          409,
        );
      }
      patch.name = normalized;
    }
    if (parsed.data.isActive !== undefined) {
      patch.isActive = parsed.data.isActive;
    }
    if (parsed.data.imagePath !== undefined) {
      patch.imagePath = parsed.data.imagePath;
    }
  }

  const [updated] = await db
    .update(categoryNameCatalog)
    .set(patch)
    .where(eq(categoryNameCatalog.id, params.data.id))
    .returning();

  if (!updated) {
    return c.json(
      { message: 'Category name not found.' },
      404,
    );
  }

  return c.json({ categoryName: updated });
};

export const deleteCategoryName = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json(
      { message: 'Invalid category name id.' },
      400,
    );
  }

  const [inUse] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      eq(productCategories.categoryNameId, params.data.id),
    )
    .limit(1);
  if (inUse) {
    return c.json(
      {
        message:
          'Category name is in use by product categories. Set isActive=false instead.',
      },
      409,
    );
  }

  const [removed] = await db
    .delete(categoryNameCatalog)
    .where(eq(categoryNameCatalog.id, params.data.id))
    .returning({
      id: categoryNameCatalog.id,
      imagePath: categoryNameCatalog.imagePath,
    });
  if (!removed) {
    return c.json(
      { message: 'Category name not found.' },
      404,
    );
  }
  await tryRemoveCategoryNameImage(removed.imagePath);
  return c.json({
    message: 'Category name deleted.',
    id: removed.id,
  });
};

export const getAllCategoryNames = async (
  c: Context<CatalogEnv>,
) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const q = c.req.query('q')?.trim();
  const active = c.req.query('active')?.trim();
  const onlyActive =
    active === undefined ? undefined : active === 'true';

  const limit = Math.min(
    Math.max(Number(limitRaw ?? 100) || 100, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const whereClause = and(
    q ? ilike(categoryNameCatalog.name, `%${q}%`) : undefined,
    onlyActive === undefined
      ? undefined
      : eq(categoryNameCatalog.isActive, onlyActive),
  );

  const rows = await db
    .select()
    .from(categoryNameCatalog)
    .where(whereClause)
    .orderBy(
      asc(categoryNameCatalog.name),
      asc(categoryNameCatalog.createdAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({ categoryNames: rows, limit, offset });
};

export const getCategoryNameById = async (
  c: Context<CatalogEnv>,
) => {
  const params = idParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json(
      { message: 'Invalid category name id.' },
      400,
    );
  }

  const [row] = await db
    .select()
    .from(categoryNameCatalog)
    .where(eq(categoryNameCatalog.id, params.data.id))
    .limit(1);
  if (!row) {
    return c.json(
      { message: 'Category name not found.' },
      404,
    );
  }
  return c.json({ categoryName: row });
};

export const getPublicCategoryNames = async (
  c: Context,
) => {
  const limitRaw = c.req.query('limit');
  const offsetRaw = c.req.query('offset');
  const q = c.req.query('q')?.trim();

  const limit = Math.min(
    Math.max(Number(limitRaw ?? 100) || 100, 1),
    200,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  const rows = await db
    .select({
      id: categoryNameCatalog.id,
      name: categoryNameCatalog.name,
      imagePath: categoryNameCatalog.imagePath,
      createdAt: categoryNameCatalog.createdAt,
      updatedAt: categoryNameCatalog.updatedAt,
    })
    .from(categoryNameCatalog)
    .where(
      and(
        eq(categoryNameCatalog.isActive, true),
        q
          ? ilike(categoryNameCatalog.name, `%${q}%`)
          : undefined,
      ),
    )
    .orderBy(
      asc(categoryNameCatalog.name),
      asc(categoryNameCatalog.createdAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({ categoryNames: rows, limit, offset });
};
