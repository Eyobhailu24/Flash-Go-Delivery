import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Page, go } from '@/components/page';
import { Button, Card, ErrorState, LoadingCards, Txt } from '@/components/ui';
import { api } from '@/lib/auth-api';
export default function PaymentStatus() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const query = useQuery({
    queryKey: ['orders', 'payment-return', orderId],
    enabled: !!orderId,
    queryFn: () =>
      api<{ payment: { status: string } | null }>(`/orders/${orderId}`),
  });
  return (
    <Page title="Payment status" back>
      {!orderId ? (
        <Card>
          <Txt>Return to your order to check its payment status.</Txt>
          <Button onPress={() => go('/customer/orders')}>Orders</Button>
        </Card>
      ) : query.isPending ? (
        <LoadingCards count={1} />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Card>
          <Txt bold size={26}>
            {query.data?.payment?.status || 'pending'}
          </Txt>
          <Button onPress={() => go(`/customer/orders/${orderId}`)}>
            Order details
          </Button>
          <Button variant="secondary" onPress={() => void query.refetch()}>
            Check payment
          </Button>
        </Card>
      )}
    </Page>
  );
}
