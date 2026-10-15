import { useScreenFocused } from '@/lib/screen-focused';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Input,
  LoadingCards,
  Pill,
  Row,
  Sheet,
  Txt,
  useAction,
} from '@/components/ui';
import { Countdown } from '@/components/countdown';
import { DeliveryMap } from '@/components/maps/map';
import {
  fetchCurrentAssignedOrder,
  fetchCurrentDriverOffer,
  acceptDriverOffer,
  rejectDriverOffer,
  startAssignedOrder,
  deliverAssignedOrder,
} from '@/lib/driver-dispatch-api';
import {
  startDriverTracking,
  stopDriverTracking,
  isDriverTracking,
} from '@/lib/driver-location';
import { useRoute } from '@/lib/location';
import { formatBirr } from '@/lib/currency';
import { queryClient } from '@/lib/query';

export default function DriverScreen() {
  const focused = useScreenFocused();
  const action = useAction();
  const [tracking, setTracking] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const offer = useQuery({
    queryKey: ['driver-offer'],
    queryFn: fetchCurrentDriverOffer,
    refetchInterval: focused ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const assigned = useQuery({
    queryKey: ['driver-assigned'],
    queryFn: fetchCurrentAssignedOrder,
    refetchInterval: focused ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    const refresh = () => void isDriverTracking().then(setTracking);
    refresh();
    const listener = AppState.addEventListener('change', refresh);
    return () => listener.remove();
  }, []);
  const order = assigned.data?.order;
  const pickup = order?.pickup || order?.business;
  const from =
    pickup?.latitude != null && pickup.longitude != null
      ? { latitude: pickup.latitude, longitude: pickup.longitude }
      : null;
  const to =
    order?.customer.latitude != null && order.customer.longitude != null
      ? {
          latitude: order.customer.latitude,
          longitude: order.customer.longitude,
        }
      : null;
  const route = useRoute(from, to);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['driver-offer'] });
    await queryClient.invalidateQueries({ queryKey: ['driver-assigned'] });
  };
  return (
    <Page
      title="Current delivery"
      refresh={() => void refresh()}
      refreshing={assigned.isRefetching}
    >
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt bold size={19}>
            Driver tracking
          </Txt>
          <Pill active={tracking}>{tracking ? 'active' : 'inactive'}</Pill>
        </Row>
        <Txt muted>
          While tracking is enabled, your location is shared with dispatch and
          your customer, including when the app is in the background.
        </Txt>
        <Button
          loading={action.busy}
          variant={tracking ? 'secondary' : 'primary'}
          onPress={() =>
            void action.run(async () => {
              if (tracking) await stopDriverTracking();
              else await startDriverTracking();
              setTracking(await isDriverTracking());
            })
          }
        >
          {tracking ? 'Stop tracking' : 'Enable tracking'}
        </Button>
      </Card>
      {offer.isPending || assigned.isPending ? (
        <LoadingCards />
      ) : offer.error || assigned.error ? (
        <ErrorState
          error={offer.error || assigned.error}
          retry={() => void refresh()}
        />
      ) : (
        <>
          {offer.data?.offer && (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt bold size={21}>
                  Incoming order
                </Txt>
                {offer.data.offer.expiresAt && (
                  <Countdown expiresAt={offer.data.offer.expiresAt} />
                )}
              </Row>
              <Txt bold>
                {offer.data.offer.business?.name || 'Deliver Packages'}
              </Txt>
              <Txt muted>
                {offer.data.offer.pickup?.address ||
                  offer.data.offer.business?.address ||
                  ''}
              </Txt>
              <Txt muted>{offer.data.offer.customer.address}</Txt>
              <Txt bold size={24}>
                {formatBirr(offer.data.offer.order.totalPrice)}
              </Txt>
              {offer.data.offer.items.map((item, i) => (
                <Txt key={i}>{`${item.quantity} × ${item.productName}`}</Txt>
              ))}
              <Row>
                <Button
                  className="flex-1"
                  loading={action.busy}
                  disabled={
                    !!offer.data.offer.expiresAt &&
                    Date.parse(offer.data.offer.expiresAt) <= Date.now()
                  }
                  onPress={() =>
                    void action.run(async () => {
                      await acceptDriverOffer(offer.data!.offer!.id);
                      await refresh();
                    })
                  }
                >
                  Accept
                </Button>
                <Button
                  variant="danger"
                  loading={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await rejectDriverOffer(offer.data!.offer!.id);
                      await refresh();
                    })
                  }
                >
                  Reject
                </Button>
              </Row>
            </Card>
          )}
          {order ? (
            <>
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt bold size={21}>{`#${order.id.slice(0, 8)}`}</Txt>
                  <Pill>{order.status}</Pill>
                </Row>
                {from && to && (
                  <DeliveryMap
                    markers={[
                      { ...from, title: 'Pickup' },
                      { ...to, title: 'Drop-off', color: '#16a34a' },
                    ]}
                    route={route.data}
                  />
                )}
                <Txt bold>Pickup</Txt>
                <Txt muted>{pickup?.address || ''}</Txt>
                <Txt bold>Drop-off</Txt>
                <Txt muted>{order.customer.address}</Txt>
                {to && (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void Linking.openURL(
                        `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}`,
                      )
                    }
                  >
                    Open directions
                  </Button>
                )}
              </Card>
              <Card>
                <Txt bold size={19}>
                  Your order
                </Txt>
                {order.items.map((item, i) => (
                  <Txt key={i}>{`${item.quantity} × ${item.productName}`}</Txt>
                ))}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt>Delivery fee</Txt>
                  <Txt bold>{formatBirr(order.deliveryFee)}</Txt>
                </Row>
                {order.status === 'accepted' && (
                  <Button
                    loading={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        await startAssignedOrder(order.id);
                        await refresh();
                      })
                    }
                  >
                    Start trip
                  </Button>
                )}
                {order.status === 'in_transit' && (
                  <Button onPress={() => setCodeOpen(true)}>
                    Mark delivered
                  </Button>
                )}
              </Card>
            </>
          ) : (
            !offer.data?.offer && <Empty title="No delivery offers right now" />
          )}
        </>
      )}
      <Sheet
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        title="Delivery code"
      >
        <Txt muted>Enter the delivery code provided by the customer.</Txt>
        <Input
          label="Delivery code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={8}
          textContentType="oneTimeCode"
        />
        <Button
          disabled={code.length < 4}
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              if (!order) return;
              await deliverAssignedOrder(order.id, code);
              setCode('');
              setCodeOpen(false);
              await stopDriverTracking();
              setTracking(false);
              await refresh();
            })
          }
        >
          Confirm
        </Button>
      </Sheet>
    </Page>
  );
}
