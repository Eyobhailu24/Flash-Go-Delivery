import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  IconButton,
  LoadingCards,
  Photo,
  Row,
  Txt,
  useAction,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/features/cart';
import { catalogItemImageUrl } from '@/lib/admin-catalog-api';
import { formatBirr } from '@/lib/currency';
export default function CartScreen() {
  const { user, ready } = useAuth();
  const cart = useCart();
  const action = useAction();
  if (ready && !user) return <Redirect href="/auth/login" />;
  return (
    <Page
      title="Cart"
      back
      refresh={() => void cart.refetch()}
      refreshing={cart.isRefetching}
    >
      {cart.isPending ? (
        <LoadingCards />
      ) : cart.error ? (
        <ErrorState error={cart.error} retry={() => void cart.refetch()} />
      ) : !cart.data?.items.length ? (
        <Empty
          title="Your cart is empty"
          action={
            <Button onPress={() => go('/customer/menu')}>Browse menu</Button>
          }
        />
      ) : (
        <>
          {cart.data.items.map((item) => (
            <Card key={item.id}>
              <Row>
                <Photo
                  uri={catalogItemImageUrl(item.product?.imagePath || null)}
                  size={76}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt bold size={17}>
                    {item.product?.name || 'Menu item'}
                  </Txt>
                  <Txt muted>{formatBirr(item.unitPrice)}</Txt>
                </View>
                <Txt bold>
                  {formatBirr(Number(item.unitPrice) * item.quantity)}
                </Txt>
              </Row>
              <Row style={{ justifyContent: 'flex-end' }}>
                <IconButton
                  label="Remove"
                  onPress={() => {
                    if (!action.busy)
                      void action.run(() =>
                        cart.update.mutateAsync({
                          id: item.id,
                          quantity: item.quantity - 1,
                        }),
                      );
                  }}
                >
                  <Minus size={18} color="#f97316" />
                </IconButton>
                <Txt bold>{item.quantity}</Txt>
                <IconButton
                  label="Add"
                  onPress={() => {
                    if (!action.busy)
                      void action.run(() =>
                        cart.update.mutateAsync({
                          id: item.id,
                          quantity: item.quantity + 1,
                        }),
                      );
                  }}
                >
                  <Plus size={18} color="#f97316" />
                </IconButton>
              </Row>
            </Card>
          ))}
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt bold>Subtotal</Txt>
              <Txt bold size={22}>
                {formatBirr(cart.data.summary.subtotal)}
              </Txt>
            </Row>
            <Button
              loading={action.busy}
              onPress={() => go('/customer/checkout')}
            >
              Checkout
            </Button>
          </Card>
        </>
      )}
    </Page>
  );
}
