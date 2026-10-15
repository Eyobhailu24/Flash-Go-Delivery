import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, jsonBody } from '@/lib/auth-api';
import { formatBirr } from '@/lib/currency';
import type { CheckoutEstimate } from '@/api/checkout';
import { Redirect, router } from 'expo-router';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  Choice,
  ErrorState,
  Input,
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
import {
  createPackageDeliveryOrder,
  type CheckoutPaymentMethod,
} from '@/api/checkout';
import { DeliveryMap } from '@/components/maps/map';
import { useRoute } from '@/lib/location';
import { payForOrder } from '@/lib/payment';
import { queryClient } from '@/lib/query';
export default function PackagesScreen() {
  const { user, ready } = useAuth();
  const action = useAction();
  const [pickup, setPickup] = useState<AddressPoint | null>(null);
  const [dropoff, setDropoff] = useState<AddressPoint | null>(null);
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<CheckoutPaymentMethod>('cash');
  const route = useRoute(pickup, dropoff);
  const estimate = useQuery({
    queryKey: ['package-estimate', pickup, dropoff],
    enabled: !!pickup && !!dropoff && !!user,
    queryFn: () =>
      api<CheckoutEstimate>(
        '/orders/package/estimate',
        jsonBody({
          paymentMethod: 'cash',
          pickup: {
            address: pickup!.address,
            lat: pickup!.latitude,
            lng: pickup!.longitude,
          },
          dropoff: {
            address: dropoff!.address,
            lat: dropoff!.latitude,
            lng: dropoff!.longitude,
          },
        }),
      ),
  });
  if (ready && !user) return <Redirect href="/auth/login" />;
  async function submit() {
    if (!pickup || !dropoff)
      throw new Error('Choose both pickup and drop-off locations.');
    const result = await createPackageDeliveryOrder({
      paymentMethod: payment,
      packageNote: note,
      pickup: {
        address: pickup.address,
        lat: pickup.latitude,
        lng: pickup.longitude,
      },
      dropoff: {
        address: dropoff.address,
        lat: dropoff.latitude,
        lng: dropoff.longitude,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    router.replace(`/customer/orders/${result.order.id}` as never);
    if (payment === 'telebirr') await payForOrder(result.order.id);
  }
  return (
    <Page title="Deliver Packages" back>
      <Card>
        <Txt bold size={20}>
          Route details
        </Txt>
        <LocationPicker label="Pickup" value={pickup} onChange={setPickup} />
        <LocationPicker
          label="Drop-off"
          value={dropoff}
          onChange={setDropoff}
        />
        <Input
          label="Package note"
          multiline
          value={note}
          onChangeText={setNote}
          maxLength={2000}
        />
      </Card>
      {pickup && dropoff && (
        <DeliveryMap
          markers={[
            { ...pickup, title: 'Pickup' },
            { ...dropoff, title: 'Drop-off', color: '#16a34a' },
          ]}
          route={route.data}
        />
      )}
      <Card>
        <Txt bold size={20}>
          Summary
        </Txt>
        {pickup && dropoff ? (
          estimate.isPending ? (
            <LoadingCards count={1} />
          ) : estimate.error ? (
            <ErrorState
              error={estimate.error}
              retry={() => void estimate.refetch()}
            />
          ) : (
            estimate.data &&
            [
              ['Subtotal', estimate.data.subtotal],
              ['Delivery fee', estimate.data.deliveryFee],
              ['Service charge', estimate.data.serviceCharge],
              ['Total', estimate.data.totalAmount],
            ].map(([label, amount]) => (
              <Row key={label} style={{ justifyContent: 'space-between' }}>
                <Txt>{label}</Txt>
                <Txt bold>{formatBirr(amount)}</Txt>
              </Row>
            ))
          )
        ) : (
          <Txt muted>Choose both pickup and drop-off locations.</Txt>
        )}
        <Choice
          label="Payment method"
          value={payment}
          onChange={(value) => setPayment(value as CheckoutPaymentMethod)}
          options={[
            { label: 'Cash on delivery', value: 'cash' },
            { label: 'Telebirr', value: 'telebirr' },
          ]}
        />
        <Button
          disabled={
            !pickup ||
            !dropoff ||
            !estimate.data ||
            !!estimate.error ||
            estimate.isFetching
          }
          loading={action.busy}
          onPress={() => void action.run(submit)}
        >
          Send package
        </Button>
      </Card>
    </Page>
  );
}
