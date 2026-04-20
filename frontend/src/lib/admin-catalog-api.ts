import {
  authFetch,
  getApiBaseUrl,
  readAuthJson,
} from "@/lib/auth-api";

export type CategoryNameCatalog = {
  id: string;
  name: string;
  imagePath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CategoryNameCatalogListResponse = {
  categoryNames: CategoryNameCatalog[];
  limit: number;
  offset: number;
};

export type ProductCategory = {
  id: string;
  businessId: string;
  categoryNameId: string;
  sortOrder: number;
  createdAt: string;
  categoryName: CategoryNameCatalog;
};

type CategoriesListResponse = {
  categories: ProductCategory[];
  limit: number;
  offset: number;
};

export async function fetchCategoryNameCatalog(
  params: {
    limit?: number;
    offset?: number;
    q?: string;
    active?: boolean;
  } = {},
): Promise<CategoryNameCatalogListResponse> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.active !== undefined) {
    q.set("active", params.active ? "true" : "false");
  }
  const res = await authFetch(
    `/catalog/category-name-catalog?${q.toString()}`,
  );
  return readAuthJson<CategoryNameCatalogListResponse>(res);
}

export async function createCategoryNameCatalog(input: {
  name: string;
  isActive?: boolean;
}): Promise<CategoryNameCatalog> {
  const res = await authFetch("/catalog/category-name-catalog", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    }),
  });
  const data = await readAuthJson<{
    categoryName: CategoryNameCatalog;
  }>(res);
  return data.categoryName;
}

export async function createCategoryNameCatalogMultipart(input: {
  name: string;
  isActive?: boolean;
  image?: File | null;
}): Promise<CategoryNameCatalog> {
  const fd = new FormData();
  fd.append("name", input.name.trim());
  fd.append("isActive", input.isActive === false ? "false" : "true");
  if (input.image && input.image.size > 0) {
    fd.append("image", input.image);
  }
  const res = await authFetch("/catalog/category-name-catalog", {
    method: "POST",
    body: fd,
  });
  const data = await readAuthJson<{
    categoryName: CategoryNameCatalog;
  }>(res);
  return data.categoryName;
}

export async function updateCategoryNameCatalog(
  id: string,
  input: { name?: string; isActive?: boolean },
): Promise<CategoryNameCatalog> {
  const body: { name?: string; isActive?: boolean } = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.isActive !== undefined) body.isActive = input.isActive;
  const res = await authFetch(
    `/catalog/category-name-catalog/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  const data = await readAuthJson<{
    categoryName: CategoryNameCatalog;
  }>(res);
  return data.categoryName;
}

export async function updateCategoryNameCatalogMultipart(
  id: string,
  input: {
    name?: string;
    isActive?: boolean;
    image?: File | null;
    removeImage?: boolean;
  },
): Promise<CategoryNameCatalog> {
  const fd = new FormData();
  if (input.name !== undefined) fd.append("name", input.name.trim());
  if (input.isActive !== undefined) {
    fd.append("isActive", input.isActive ? "true" : "false");
  }
  if (input.removeImage) {
    fd.append("image", "");
  } else if (input.image && input.image.size > 0) {
    fd.append("image", input.image);
  }
  const res = await authFetch(
    `/catalog/category-name-catalog/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: fd,
    },
  );
  const data = await readAuthJson<{
    categoryName: CategoryNameCatalog;
  }>(res);
  return data.categoryName;
}

export async function deleteCategoryNameCatalog(id: string): Promise<void> {
  const res = await authFetch(
    `/catalog/category-name-catalog/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  await readAuthJson<{ message: string; id: string }>(res);
}

export async function fetchPublicCategoryNames(
  params: { limit?: number; offset?: number; q?: string } = {},
): Promise<CategoryNameCatalogListResponse> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  });
  if (params.q?.trim()) q.set("q", params.q.trim());
  const res = await fetch(
    `${getApiBaseUrl()}/catalog/public/category-names?${q.toString()}`,
    { credentials: "include" },
  );
  const data = (await res.json()) as CategoryNameCatalogListResponse & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? "Failed to load category names.");
  }
  return data;
}

export async function fetchProductCategories(
  businessId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<CategoriesListResponse> {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;
  const q = new URLSearchParams({
    businessId,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await authFetch(
    `/catalog/product-categories?${q.toString()}`,
  );
  return readAuthJson<CategoriesListResponse>(res);
}

export async function createProductCategory(input: {
  businessId: string;
  categoryNameId: string;
  sortOrder?: number;
}): Promise<ProductCategory> {
  const res = await authFetch("/catalog/product-categories", {
    method: "POST",
    body: JSON.stringify({
      businessId: input.businessId,
      categoryNameId: input.categoryNameId,
      ...(input.sortOrder !== undefined
        ? { sortOrder: input.sortOrder }
        : {}),
    }),
  });
  const data = await readAuthJson<{ category: ProductCategory }>(
    res,
  );
  return data.category;
}

export async function fetchProductCategoryById(
  id: string,
): Promise<ProductCategory> {
  const res = await authFetch(
    `/catalog/product-categories/${encodeURIComponent(id)}`,
  );
  const data = await readAuthJson<{ category: ProductCategory }>(res);
  return data.category;
}

export type CategoryItem = {
  id: string;
  categoryId: string;
  categoryNameId?: string;
  categoryName?: string;
  businessId?: string;
  businessName?: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  price: string;
  discount: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CategoryItemsListResponse = {
  items: CategoryItem[];
  limit: number;
  offset: number;
};

export async function fetchCategoryItems(
  params: {
    categoryId?: string;
    businessId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<CategoryItemsListResponse> {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (params.categoryId?.trim()) {
    q.set("categoryId", params.categoryId.trim());
  }
  if (params.businessId?.trim()) {
    q.set("businessId", params.businessId.trim());
  }
  if (params.q?.trim()) {
    q.set("q", params.q.trim());
  }
  const res = await authFetch(`/catalog/category-items?${q.toString()}`);
  return readAuthJson<CategoryItemsListResponse>(res);
}

export async function createCategoryItemMultipart(input: {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  discount?: number | null;
  isAvailable: boolean;
  image?: File | null;
}): Promise<CategoryItem> {
  const fd = new FormData();
  fd.append("categoryId", input.categoryId);
  fd.append("name", input.name.trim());
  if (input.description?.trim()) {
    fd.append("description", input.description.trim());
  }
  fd.append("price", String(input.price));
  if (input.discount != null && input.discount !== undefined) {
    fd.append("discount", String(input.discount));
  }
  fd.append("isAvailable", input.isAvailable ? "true" : "false");
  if (input.image && input.image.size > 0) {
    fd.append("image", input.image);
  }

  const res = await authFetch("/catalog/category-items", {
    method: "POST",
    body: fd,
  });
  const data = await readAuthJson<{ item: CategoryItem }>(res);
  return data.item;
}

/** Absolute URL for a stored upload path such as `/uploads/category-items/…`. */
export function catalogItemImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const base = getApiBaseUrl();
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${base}${path}`;
}

export function catalogCategoryNameImageUrl(
  imagePath: string | null,
): string | null {
  if (!imagePath) return null;
  const base = getApiBaseUrl();
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${base}${path}`;
}
