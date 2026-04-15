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
import {
  categoryNameCatalog,
  productCategories,
} from '../schema.js';

const createCategorySchema = z.object({
  businessId: z.string().uuid().optional(),
  categoryNameId: z.string().uuid(),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z
  .object({
    categoryNameId: z.string().uuid().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

const idParamSchema = z.object({
  id: z.string().uuid(),
});

async function getCategoryNameById(id: string) {
  const [row] = await db
    .select()
    .from(categoryNameCatalog)
    .where(eq(categoryNameCatalog.id, id))
    .limit(1);
  return row ?? null;
}

function toCategoryResponse(row: {
  id: string;
  businessId: string;
  categoryNameId: string;
  sortOrder: number;
  createdAt: Date;
  categoryName: {
    id: string;
    name: string;
    imagePath: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    id: row.id,
    businessId: row.businessId,
    categoryNameId: row.categoryNameId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    categoryName: row.categoryName,
  };
}

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

  const chosenName = await getCategoryNameById(
    parsed.data.categoryNameId,
  );
  if (!chosenName || !chosenName.isActive) {
    return c.json(
      { message: 'Category name not found.' },
      400,
    );
  }

  const [created] = await db
    .insert(productCategories)
    .values({
      businessId: scope.businessId,
      categoryNameId: parsed.data.categoryNameId,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  return c.json(
    {
      category: toCategoryResponse({
        ...created,
        categoryName: chosenName,
      }),
    },
    201,
  );
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
  if (parsed.data.categoryNameId !== undefined) {
    const chosenName = await getCategoryNameById(
      parsed.data.categoryNameId,
    );
    if (!chosenName || !chosenName.isActive) {
      return c.json(
        { message: 'Category name not found.' },
        400,
      );
    }
    patch.categoryNameId = parsed.data.categoryNameId;
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

  const categoryName = await getCategoryNameById(
    updated.categoryNameId,
  );
  if (!categoryName) {
    return c.json(
      { message: 'Category name not found.' },
      404,
    );
  }

  return c.json({
    category: toCategoryResponse({
      ...updated,
      categoryName,
    }),
  });
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
    .select({
      id: productCategories.id,
      businessId: productCategories.businessId,
      categoryNameId: productCategories.categoryNameId,
      sortOrder: productCategories.sortOrder,
      createdAt: productCategories.createdAt,
      categoryNameIdValue: categoryNameCatalog.id,
      categoryNameText: categoryNameCatalog.name,
      categoryNameImagePath: categoryNameCatalog.imagePath,
      categoryNameIsActive: categoryNameCatalog.isActive,
      categoryNameCreatedAt: categoryNameCatalog.createdAt,
      categoryNameUpdatedAt: categoryNameCatalog.updatedAt,
    })
    .from(productCategories)
    .innerJoin(
      categoryNameCatalog,
      eq(
        productCategories.categoryNameId,
        categoryNameCatalog.id,
      ),
    )
    .where(eq(productCategories.businessId, scope.businessId))
    .orderBy(
      asc(productCategories.sortOrder),
      asc(productCategories.createdAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({
    categories: rows.map((row) =>
      toCategoryResponse({
        id: row.id,
        businessId: row.businessId,
        categoryNameId: row.categoryNameId,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        categoryName: {
          id: row.categoryNameIdValue,
          name: row.categoryNameText,
          imagePath: row.categoryNameImagePath,
          isActive: row.categoryNameIsActive,
          createdAt: row.categoryNameCreatedAt,
          updatedAt: row.categoryNameUpdatedAt,
        },
      }),
    ),
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
    .select({
      id: productCategories.id,
      businessId: productCategories.businessId,
      categoryNameId: productCategories.categoryNameId,
      sortOrder: productCategories.sortOrder,
      createdAt: productCategories.createdAt,
      categoryNameIdValue: categoryNameCatalog.id,
      categoryNameText: categoryNameCatalog.name,
      categoryNameImagePath: categoryNameCatalog.imagePath,
      categoryNameIsActive: categoryNameCatalog.isActive,
      categoryNameCreatedAt: categoryNameCatalog.createdAt,
      categoryNameUpdatedAt: categoryNameCatalog.updatedAt,
    })
    .from(productCategories)
    .innerJoin(
      categoryNameCatalog,
      eq(
        productCategories.categoryNameId,
        categoryNameCatalog.id,
      ),
    )
    .where(eq(productCategories.id, params.data.id))
    .limit(1);

  if (!row) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  if (!canAccessBusinessData(c.var.user, row.businessId)) {
    return c.json({ message: 'Category not found.' }, 404);
  }

  return c.json({
    category: toCategoryResponse({
      id: row.id,
      businessId: row.businessId,
      categoryNameId: row.categoryNameId,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      categoryName: {
        id: row.categoryNameIdValue,
        name: row.categoryNameText,
        imagePath: row.categoryNameImagePath,
        isActive: row.categoryNameIsActive,
        createdAt: row.categoryNameCreatedAt,
        updatedAt: row.categoryNameUpdatedAt,
      },
    }),
  });
};
