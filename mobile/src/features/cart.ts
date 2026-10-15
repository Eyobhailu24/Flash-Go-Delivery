import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/auth-api';
import { queryClient } from '@/lib/query';
import {
  fetchCarts,
  fetchCartById,
  postCart,
  postCartItem,
  patchCartItem,
  deleteCartItem,
} from '@/api/carts';
import type { CategoryItem } from '@/lib/admin-catalog-api';
export async function loadCart() {
  const carts = await fetchCarts('active');
  const cart = carts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!cart) return null;
  const detail = await fetchCartById(cart.id);
  const items = await Promise.all(
    detail.items.map(async (item) => {
      const product = await queryClient
        .fetchQuery({
          queryKey: ['item', item.categoryItemId],
          staleTime: 120000,
          queryFn: () =>
            api<{ item: CategoryItem }>(
              `/catalog/category-items/${item.categoryItemId}`,
            ),
        })
        .catch(() => null);
      return { ...item, product: product?.item };
    }),
  );
  return { ...detail, items };
}
export function useCart() {
  const { user } = useAuth();
  const key = ['cart', user?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: loadCart,
    enabled: user?.role === 'customer',
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  const add = useMutation({
    scope: { id: 'cart' },
    mutationFn: async (item: CategoryItem) => {
      if (!user) throw new Error('Please sign in to add items to your cart.');
      if (!item.isAvailable || !item.businessId)
        throw new Error('This item is not available.');
      // The server reuses empty carts and enforces one business per nonempty cart.
      const cart = await postCart({ businessId: item.businessId });
      await postCartItem(cart.id, { categoryItemId: item.id, quantity: 1 });
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    scope: { id: 'cart' },
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (!query.data) return;
      if (quantity < 1) await deleteCartItem(query.data.cart.id, id);
      else await patchCartItem(query.data.cart.id, id, { quantity });
    },
    onSuccess: invalidate,
  });
  return { ...query, add, update };
}
