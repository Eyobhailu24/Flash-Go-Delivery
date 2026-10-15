import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Page, go } from '@/components/page';
import {
  Card,
  Empty,
  ErrorState,
  LoadingCards,
  Pill,
  Row,
  Txt,
} from '@/components/ui';
import { api } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth';
import { orderPayableTotal } from '@/lib/pricing';
import { useScreenFocused } from '@/lib/screen-focused';
import { formatBirr } from '@/lib/currency';
import type { CustomerOrder } from '@/api/orders';

export function OrderList({
  role,
}: {
  role: 'customer' | 'business' | 'admin';
}) {
  const focused = useScreenFocused();
  const { user, ready } = useAuth();
  const path = role === 'customer' ? '/orders/my' : `/orders/${role}`;
  const query = useInfiniteQuery({
    queryKey: ['orders', role, user?.id],
    enabled: !!user && focused,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api<{ orders: CustomerOrder[] }>(`${path}?limit=30&offset=${pageParam}`, {
        signal,
      }),
    getNextPageParam: (page, pages) =>
      page.orders.length === 30 ? pages.length * 30 : undefined,
    refetchInterval: role === 'business' ? 8000 : false,
    refetchIntervalInBackground: false,
  });
  if (ready && !user) return <Redirect href="/auth/login" />;
  return (
    <Page
      title={role === 'customer' ? 'Track Order' : 'Orders'}
      back
      scroll={false}
    >
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data?.pages.flatMap((page) => page.orders) || []}
          keyExtractor={(order) => order.id}
          renderItem={({ item: order }) => (
            <Pressable
              onPress={() => go(`/${role}/orders/${order.id}`)}
              style={{ marginBottom: 15 }}
            >
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt bold size={18}>{`#${order.id.slice(0, 8)}`}</Txt>
                  <Pill>{order.status}</Pill>
                </Row>
                <Txt muted>{order.business?.name || order.orderType}</Txt>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt muted size={12}>
                    {new Date(order.createdAt).toLocaleString()}
                  </Txt>
                  <Txt bold size={20}>
                    {formatBirr(orderPayableTotal(order))}
                  </Txt>
                </Row>
              </Card>
            </Pressable>
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              void query.fetchNextPage();
          }}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching}
          ListEmptyComponent={
            <Empty title="Order list" description="Nothing here yet" />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
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
