import { View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  LoadingCards,
  Photo,
  Pill,
  Txt,
} from '@/components/ui';
import {
  fetchBusinessProfiles,
  businessProfileImageUrl,
} from '@/lib/admin-business-api';
export default function CatalogBusinesses() {
  const query = useInfiniteQuery({
    queryKey: ['businesses'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBusinessProfiles({ limit: 30, offset: pageParam }),
    getNextPageParam: (page, pages) =>
      page.profiles.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <Page title="Product categories" back scroll={false}>
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data?.pages.flatMap((page) => page.profiles) || []}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 16 }}>
              <Photo uri={businessProfileImageUrl(item.imagePath)} />
              <Txt bold size={21}>
                {item.businessName}
              </Txt>
              <Pill>{item.status}</Pill>
              <Button
                variant="secondary"
                onPress={() =>
                  go(`/admin/categories?businessId=${item.userId}`)
                }
              >
                Categories
              </Button>
            </Card>
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              void query.fetchNextPage();
          }}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching}
          ListEmptyComponent={<Empty />}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </Page>
  );
}
