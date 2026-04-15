import {
  authFetch,
  getApiBaseUrl,
  readAuthJson,
} from "@/lib/auth-api";

export type ProductCategory = {
  id: string;
  businessId: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
};

type CategoriesListResponse = {
  categories: ProductCategory[];
  limit: number;
  offset: number;
};

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
  name: string;
  sortOrder?: number;
}): Promise<ProductCategory> {
  const res = await authFetch("/catalog/product-categories", {
    method: "POST",
    body: JSON.stringify({
      businessId: input.businessId,
      name: input.name.trim(),
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
  categoryId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<CategoryItemsListResponse> {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;
  const q = new URLSearchParams({
    categoryId,
    limit: String(limit),
    offset: String(offset),
  });
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
