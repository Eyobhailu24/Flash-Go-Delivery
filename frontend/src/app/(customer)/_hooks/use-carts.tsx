"use client";

import { useCallback, useMemo, useState } from "react";
import {
  authFetch,
  AuthApiError,
  readAuthJson,
} from "@/lib/auth-api";
import {
  fetchCategoryItems,
  type CategoryItem,
} from "@/lib/admin-catalog-api";

export type CartStatus = "active" | "checked_out" | "abandoned";

export type Cart = {
  id: string;
  customerId: string;
  businessId: string;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  id: string;
  cartId: string;
  categoryItemId: string;
  quantity: number;
  unitPrice: string;
  specialInstructions: string | null;
};
export type CartItemView = CartItem & {
  itemName: string;
  itemImagePath: string | null;
  businessName: string | null;
};

export type CartSummary = {
  itemCount: number;
  totalQuantity: number;
  subtotal: string;
};

type CartListResponse = { carts: Cart[] };
type CartResponse = { cart: Cart };
type CartItemResponse = { item: CartItem };
type CartDetailResponse = {
  cart: Cart;
  items: CartItem[];
  summary: CartSummary;
};

export async function fetchCarts(
  status?: CartStatus,
): Promise<Cart[]> {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  const res = await authFetch(
    `/carts${q.toString() ? `?${q.toString()}` : ""}`,
  );
  const data = await readAuthJson<CartListResponse>(res);
  return data.carts;
}

export async function postCart(input: {
  businessId: string;
}): Promise<Cart> {
  const res = await authFetch("/carts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await readAuthJson<CartResponse>(res);
  return data.cart;
}

export async function fetchCartById(id: string): Promise<CartDetailResponse> {
  const res = await authFetch(`/carts/${encodeURIComponent(id)}`);
  return readAuthJson<CartDetailResponse>(res);
}

export async function postCartItem(
  cartId: string,
  input: {
    categoryItemId: string;
    quantity: number;
    specialInstructions?: string;
  },
): Promise<CartItem> {
  const res = await authFetch(
    `/carts/${encodeURIComponent(cartId)}/items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  const data = await readAuthJson<CartItemResponse>(res);
  return data.item;
}

export async function patchCartItem(
  cartId: string,
  itemId: string,
  patch: {
    quantity?: number;
    specialInstructions?: string | null;
  },
): Promise<CartItem> {
  const res = await authFetch(
    `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  const data = await readAuthJson<CartItemResponse>(res);
  return data.item;
}

export async function deleteCartItem(
  cartId: string,
  itemId: string,
): Promise<{ message: string; id: string }> {
  const res = await authFetch(
    `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
    },
  );
  return readAuthJson<{ message: string; id: string }>(res);
}

export function useCarts() {
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [activeCart, setActiveCart] = useState<Cart | null>(null);
  const [activeCartItems, setActiveCartItems] = useState<CartItem[]>([]);
  const [cartItemsView, setCartItemsView] = useState<CartItemView[]>([]);
  const [activeCartSummary, setActiveCartSummary] =
    useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingItemIds, setAddingItemIds] = useState<string[]>([]);
  const [updatingItemIds, setUpdatingItemIds] = useState<string[]>([]);

  const isAddingItem = useCallback(
    (itemId: string) => addingItemIds.includes(itemId),
    [addingItemIds],
  );
  const isUpdatingItem = useCallback(
    (itemId: string) => updatingItemIds.includes(itemId),
    [updatingItemIds],
  );

  const refreshActiveCarts = useCallback(async () => {
    const carts = await fetchCarts("active");
    setActiveCarts(carts);
    return carts;
  }, []);

  const hydrateItems = useCallback(
    async (items: CartItem[]): Promise<CartItemView[]> => {
      if (items.length === 0) return [];
      const catalog = await fetchCategoryItems({
        limit: 500,
        offset: 0,
      });
      const byId = new Map(catalog.items.map((i) => [i.id, i]));
      return items.map((item) => {
        const match = byId.get(item.categoryItemId);
        return {
          ...item,
          itemName: match?.name ?? "Unknown item",
          itemImagePath: match?.imagePath ?? null,
          businessName: match?.businessName ?? null,
        };
      });
    },
    [],
  );

  const loadCartDetails = useCallback(async (cartId: string) => {
    const details = await fetchCartById(cartId);
    const hydrated = await hydrateItems(details.items);
    setActiveCart(details.cart);
    setActiveCartItems(details.items);
    setCartItemsView(hydrated);
    setActiveCartSummary(details.summary);
    return details;
  }, [hydrateItems]);

  const loadPrimaryActiveCart = useCallback(async () => {
    const carts = await refreshActiveCarts();
    if (carts.length === 0) {
      setActiveCart(null);
      setActiveCartItems([]);
      setCartItemsView([]);
      setActiveCartSummary(null);
      return null;
    }
    const sorted = [...carts].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    );
    await loadCartDetails(sorted[0].id);
    return sorted[0];
  }, [loadCartDetails, refreshActiveCarts]);

  const addToCart = useCallback(
    async (item: CategoryItem, quantity = 1) => {
      const businessId = item.businessId?.trim();
      if (!businessId) {
        throw new Error("Item is missing business information.");
      }

      setLoading(true);
      setError(null);
      setAddingItemIds((prev) =>
        prev.includes(item.id) ? prev : [...prev, item.id],
      );

      try {
        let carts = activeCarts;
        if (carts.length === 0) {
          carts = await refreshActiveCarts();
        }

        const activeCartFromOtherBusiness = carts.find(
          (c) => c.businessId !== businessId,
        );
        if (activeCartFromOtherBusiness) {
          throw new AuthApiError(
            "You can only add an item from one place at a time.",
            409,
          );
        }

        let cart = carts.find((c) => c.businessId === businessId) ?? null;
        if (!cart) {
          cart = await postCart({ businessId });
          setActiveCarts([cart]);
        }

        await postCartItem(cart.id, {
          categoryItemId: item.id,
          quantity,
        });

        await loadCartDetails(cart.id);
      } catch (e) {
        const nextError =
          e instanceof AuthApiError
            ? e.message
            : "Could not add item to cart.";
        setError(nextError);
        throw e;
      } finally {
        setAddingItemIds((prev) =>
          prev.filter((id) => id !== item.id),
        );
        setLoading(false);
      }
    },
    [activeCarts, loadCartDetails, refreshActiveCarts],
  );

  const changeItemQuantity = useCallback(
    async (cartId: string, itemId: string, quantity: number) => {
      if (quantity <= 0) {
        return;
      }
      setUpdatingItemIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId],
      );
      setError(null);
      try {
        await patchCartItem(cartId, itemId, { quantity });
        await loadCartDetails(cartId);
      } catch (e) {
        const nextError =
          e instanceof AuthApiError
            ? e.message
            : "Could not update cart item.";
        setError(nextError);
        throw e;
      } finally {
        setUpdatingItemIds((prev) =>
          prev.filter((id) => id !== itemId),
        );
      }
    },
    [loadCartDetails],
  );

  const removeItem = useCallback(
    async (cartId: string, itemId: string) => {
      setUpdatingItemIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId],
      );
      setError(null);
      try {
        await deleteCartItem(cartId, itemId);
        await loadCartDetails(cartId);
      } catch (e) {
        const nextError =
          e instanceof AuthApiError
            ? e.message
            : "Could not remove cart item.";
        setError(nextError);
        throw e;
      } finally {
        setUpdatingItemIds((prev) =>
          prev.filter((id) => id !== itemId),
        );
      }
    },
    [loadCartDetails],
  );

  return useMemo(
    () => ({
      activeCarts,
      activeCart,
      activeCartItems,
      cartItemsView,
      activeCartSummary,
      loading,
      error,
      addToCart,
      isAddingItem,
      isUpdatingItem,
      refreshActiveCarts,
      loadCartDetails,
      loadPrimaryActiveCart,
      changeItemQuantity,
      removeItem,
    }),
    [
      activeCarts,
      activeCart,
      activeCartItems,
      cartItemsView,
      activeCartSummary,
      loading,
      error,
      addToCart,
      isAddingItem,
      isUpdatingItem,
      refreshActiveCarts,
      loadCartDetails,
      loadPrimaryActiveCart,
      changeItemQuantity,
      removeItem,
    ],
  );
}
