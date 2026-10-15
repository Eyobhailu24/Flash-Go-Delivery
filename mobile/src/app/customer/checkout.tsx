import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  Choice,
  Empty,
  ErrorState,
  LoadingCards,
  Row,
  Txt,
  useAction,
} from '@/components/ui';
import {
  LocationPicker,
  type AddressPoint,
} from '@/components/location-picker';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/features/cart';
import {
  fetchMyCustomerProfile,
  patchMyCustomerProfile,
} from '@/lib/customer-profile-api';
import {
  createCheckoutOrder,
  estimateCheckoutOrder,
  type CheckoutPaymentMethod,
} from '@/api/checkout';
import { queryClient } from '@/lib/query';
import { formatBirr } from '@/lib/currency';
import { payForOrder } from '@/lib/payment';

export default function CheckoutScreen() {
  const { user, ready } = useAuth();
  const cart = useCart();
  const action = useAction();
  const [payment, setPayment] = useState<CheckoutPaymentMethod>('cash');
  const profile = useQuery({
    queryKey: ['customer-profile', user?.id],
    queryFn: fetchMyCustomerProfile,
    enabled: !!user,
  });
  const addresses = profile.data?.addresses || [];
  const saved = addresses.find((address) => address.isDefault) || addresses[0];
  const address =
    saved?.lat != null && saved?.lng != null
      ? { address: saved.address, latitude: saved.lat, longitude: saved.lng }
      : null;
  const estimate = useQuery({
    queryKey: ['estimate', cart.data?.cart.id, address],
    queryFn: () => estimateCheckoutOrder({ cartId: cart.data!.cart.id }),
    enabled: !!cart.data?.items.length && !!address,
    staleTime: 0,
  });
  const chooseAddress = (point: AddressPoint) =>
    void action.run(async () => {
      await patchMyCustomerProfile({
        addresses: [
          {
            address: point.address,
            lat: point.latitude,
            lng: point.longitude,
            isDefault: true,
          },
          ...addresses
            .filter((entry) => entry.address !== point.address)
            .map((entry) => ({ ...entry, isDefault: false })),
        ],
      });
      await profile.refetch();
    });
  async function placeOrder() {
    if (!address || !cart.data || !estimate.data)
      throw new Error(
        'Choose a delivery location and wait for the price estimate.',
      );
    const result = await createCheckoutOrder({
      cartId: cart.data.cart.id,
      paymentMethod: payment,
    });
    await queryClient.invalidateQueries({ queryKey: ['cart'] });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    router.replace(`/customer/orders/${result.order.id}` as never);
    if (payment === 'telebirr') await payForOrder(result.order.id);
  }
  if (ready && !user) return <Redirect href="/auth/login" />;
  return (
    <Page title="Checkout" back>
      {cart.isPending || profile.isPending ? (
        <LoadingCards />
      ) : cart.error || profile.error ? (
        <ErrorState
          error={cart.error || profile.error}
          retry={() => {
            void cart.refetch();
            void profile.refetch();
          }}
        />
      ) : !cart.data?.items.length ? (
        <Empty
          title="Your cart is empty"
          action={
            <Button onPress={() => go('/customer/menu')}>Browse menu</Button>
          }
        />
      ) : (
        <>
          <Card>
            <Txt bold size={20}>
              Your order
            </Txt>
            {cart.data.items.map((item) => (
              <Row key={item.id} style={{ justifyContent: 'space-between' }}>
                <Txt
                  style={{ flex: 1 }}
                >{`${item.quantity} × ${item.product?.name || 'Menu item'}`}</Txt>
                <Txt bold>
                  {formatBirr(Number(item.unitPrice) * item.quantity)}
                </Txt>
              </Row>
            ))}
          </Card>
          <Card>
            <LocationPicker value={address} onChange={chooseAddress} />
            {addresses.length > 1 && (
              <Choice
                label="Saved addresses"
                value={saved?.address || ''}
                options={addresses.map((entry) => ({
                  label: entry.address,
                  value: entry.address,
                }))}
                onChange={(value) => {
                  const entry = addresses.find((row) => row.address === value);
                  if (entry?.lat != null && entry?.lng != null)
                    chooseAddress({
                      address: entry.address,
                      latitude: entry.lat,
                      longitude: entry.lng,
                    });
                }}
              />
            )}
          </Card>
          <Card>
            <Txt bold size={20}>
              Summary
            </Txt>
            {estimate.isFetching ? (
              <LoadingCards count={1} />
            ) : estimate.error ? (
              <ErrorState
                error={estimate.error}
                retry={() => void estimate.refetch()}
              />
            ) : estimate.data ? (
              <>
                {[
                  ['Subtotal', estimate.data.subtotal],
                  ['Delivery fee', estimate.data.deliveryFee],
                  ['Service charge', estimate.data.serviceCharge],
                  ['Total', estimate.data.totalAmount],
                ].map(([label, value]) => (
                  <Row key={label} style={{ justifyContent: 'space-between' }}>
                    <Txt bold={label === 'Total'}>{label}</Txt>
                    <Txt bold>{formatBirr(value)}</Txt>
                  </Row>
                ))}
              </>
            ) : (
              <Txt muted>Choose a delivery address to calculate the total.</Txt>
            )}
            <Choice
              label="Payment method"
              value={payment}
              options={[
                { value: 'cash', label: 'Cash on delivery' },
                { value: 'telebirr', label: 'Telebirr' },
              ]}
              onChange={(value) => setPayment(value as CheckoutPaymentMethod)}
            />
            <Button
              loading={action.busy}
              disabled={
                !address ||
                !estimate.data ||
                estimate.isFetching ||
                !!estimate.error
              }
              onPress={() => void action.run(placeOrder)}
            >
              Place order
            </Button>
          </Card>
        </>
      )}
    </Page>
  );
}
