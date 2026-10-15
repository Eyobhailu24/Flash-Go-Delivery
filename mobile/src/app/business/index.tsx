import { useScreenFocused } from '@/lib/screen-focused';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  ErrorState,
  LoadingCards,
  Pill,
  Row,
  Txt,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchBusinessProfileById } from '@/lib/admin-business-api';
import { fetchProductCategories } from '@/lib/admin-catalog-api';
import { fetchBusinessOrders } from '@/lib/business-orders-api';
export default function BusinessHome() {
  const focused = useScreenFocused();
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ['business-profile', user?.id],
    queryFn: () => fetchBusinessProfileById(user!.id),
    enabled: !!user,
  });
  const categories = useQuery({
    queryKey: ['manage-catalog', 'summary', user?.id],
    queryFn: () => fetchProductCategories(user!.id, { limit: 200 }),
    enabled: !!user,
  });
  const orders = useQuery({
    queryKey: ['orders', 'business-summary'],
    queryFn: () => fetchBusinessOrders({ limit: 100 }),
    refetchInterval: focused ? 8000 : false,
  });
  return (
    <Page
      title="Dashboard"
      refresh={() => {
        void profile.refetch();
        void orders.refetch();
        void categories.refetch();
      }}
      refreshing={profile.isRefetching}
    >
      <LinearGradient
        colors={['#fff0de', '#fff8ee']}
        style={{ borderRadius: 25, padding: 25, gap: 10 }}
      >
        <Txt bold size={29}>
          {profile.data?.businessName || user?.fullName || 'Business'}
        </Txt>
        <Txt muted>Manage your menu and keep every delivery moving.</Txt>
        <Pill>{profile.data?.status || 'pending'}</Pill>
      </LinearGradient>
      {profile.isPending ? (
        <LoadingCards count={1} />
      ) : profile.error ? (
        <ErrorState
          error={profile.error}
          retry={() => void profile.refetch()}
        />
      ) : (
        <Card>
          <Txt bold size={21}>
            Profile & location
          </Txt>
          <Txt muted>{profile.data?.address || ''}</Txt>
          <Button variant="secondary" onPress={() => go('/business/account')}>
            Account
          </Button>
        </Card>
      )}
      <Row>
        <Card style={{ flex: 1 }}>
          <Txt bold size={32}>
            {categories.data?.categories.length ?? '—'}
          </Txt>
          <Txt muted>Categories</Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt bold size={32}>
            {orders.data?.orders.filter((row) => row.canApprove).length ?? '—'}
          </Txt>
          <Txt muted>Awaiting approval</Txt>
        </Card>
      </Row>
      <Button onPress={() => go('/business/orders')}>Orders</Button>
      <Button variant="secondary" onPress={() => go('/business/categories')}>
        Menu items
      </Button>
    </Page>
  );
}
