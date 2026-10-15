import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Page, go } from '@/components/page';
import {
  Empty,
  ErrorState,
  Input,
  LoadingCards,
  Pill,
  useAction,
} from '@/components/ui';
import { ProductCard } from '@/components/product-card';
import { api } from '@/lib/auth-api';
import {
  fetchPublicCategoryNames,
  type CategoryItem,
} from '@/lib/admin-catalog-api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/features/cart';
import { useDebounced } from '@/lib/location';

export default function MenuScreen() {
  const params = useLocalSearchParams<{
    businessId?: string;
    categoryNameId?: string;
    q?: string;
  }>();
  const [search, setSearch] = useState(params.q || '');
  const [category, setCategory] = useState(params.categoryNameId || '');
  const q = useDebounced(search);
  const { user } = useAuth();
  const cart = useCart();
  const action = useAction();
  const categories = useQuery({
    queryKey: ['public-categories'],
    queryFn: () => fetchPublicCategoryNames({ limit: 200 }),
  });
  const items = useInfiniteQuery({
    queryKey: ['menu', params.businessId, category, q],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({
        limit: '24',
        offset: String(pageParam),
        ...(q ? { q } : {}),
        ...(category ? { categoryNameId: category } : {}),
        ...(params.businessId ? { businessId: params.businessId } : {}),
      });
      return api<{ items: CategoryItem[] }>(
        `/catalog/category-items?${query}`,
        { signal },
      );
    },
    getNextPageParam: (page, pages) =>
      page.items.length === 24 ? pages.length * 24 : undefined,
  });
  const add = (item: CategoryItem) => {
    if (!user) return go('/auth/login');
    void action.run(() => cart.add.mutateAsync(item), 'Added to cart');
  };
  return (
    <Page title="All Menu" back scroll={false}>
      <Input placeholder="Search" value={search} onChangeText={setSearch} />
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pill active={!category} onPress={() => setCategory('')}>
            All
          </Pill>
          {categories.data?.categoryNames.map((row) => (
            <Pill
              key={row.id}
              active={category === row.id}
              onPress={() => setCategory(row.id)}
            >
              {row.name}
            </Pill>
          ))}
        </ScrollView>
      </View>
      {items.isPending ? (
        <LoadingCards />
      ) : items.error ? (
        <ErrorState error={items.error} retry={() => void items.refetch()} />
      ) : (
        <FlashList
          data={items.data?.pages.flatMap((page) => page.items) || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ paddingBottom: 18 }}>
              <ProductCard
                item={item}
                onAdd={add}
                busy={cart.add.isPending && cart.add.variables?.id === item.id}
              />
            </View>
          )}
          onEndReached={() => {
            if (items.hasNextPage && !items.isFetchingNextPage)
              void items.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          onRefresh={() => void items.refetch()}
          refreshing={items.isRefetching}
          ListEmptyComponent={<Empty title="No results" />}
          ListFooterComponent={
            items.isFetchingNextPage ? (
              <LoadingCards count={1} />
            ) : (
              <View style={{ height: 20 }} />
            )
          }
        />
      )}
    </Page>
  );
}
