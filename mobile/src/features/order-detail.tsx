import { useLanguage } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  Choice,
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
import type { MapMarker } from '@/components/maps/types';
import { useRoute } from '@/lib/location';
import { useAuth } from '@/lib/auth';
import { api, jsonBody } from '@/lib/auth-api';
import { queryClient } from '@/lib/query';
import { orderPayableTotal } from '@/lib/pricing';
import { useScreenFocused } from '@/lib/screen-focused';
import { formatBirr } from '@/lib/currency';
import type { CustomerOrderDetail, CustomerOrderTracking } from '@/api/orders';
import { fetchAvailableDrivers } from '@/api/admin-orders';
import { fetchCategoryItems } from '@/lib/admin-catalog-api';
import { payForOrder } from '@/lib/payment';

type Detail = CustomerOrderDetail & {
  customer?: { fullName: string; phoneNumber: string | null } | null;
};
export function OrderDetail({
  role,
}: {
  role: 'customer' | 'business' | 'admin';
}) {
  const { t } = useLanguage();
  const focused = useScreenFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, ready } = useAuth();
  const action = useAction();
  const [reason, setReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [driverId, setDriverId] = useState('');
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<
    { categoryItemId: string; quantity: number }[]
  >([]);
  const [addItem, setAddItem] = useState('');
  const path = role === 'customer' ? `/orders/${id}` : `/orders/${role}/${id}`;
  const query = useQuery({
    queryKey: ['orders', role, id],
    enabled: !!user && focused,
    queryFn: () => api<Detail>(path),
    refetchInterval: (query) =>
      ['delivered', 'cancelled'].includes(query.state.data?.order.status || '')
        ? false
        : 5000,
    refetchIntervalInBackground: false,
  });
  const tracking = useQuery({
    queryKey: ['tracking', id],
    enabled: !!user && focused && role === 'customer',
    queryFn: () => api<CustomerOrderTracking>(`/orders/${id}/tracking`),
    refetchInterval: ['delivered', 'cancelled'].includes(
      query.data?.order.status || '',
    )
      ? false
      : 5000,
    refetchIntervalInBackground: false,
  });
  const drivers = useQuery({
    queryKey: ['available-drivers'],
    queryFn: fetchAvailableDrivers,
    enabled: role === 'admin',
  });
  const menu = useQuery({
    queryKey: ['edit-order-menu', query.data?.order.businessId],
    queryFn: () =>
      fetchCategoryItems({
        businessId: query.data!.order.businessId!,
        limit: 200,
      }),
    enabled: editing && !!query.data?.order.businessId,
  });
  useEffect(() => {
    setDriverId(query.data?.order.driverId || '');
  }, [query.data?.order.driverId]);
  const origin = tracking.data?.driver?.location
    ? {
        latitude: tracking.data.driver.location.lat,
        longitude: tracking.data.driver.location.lng,
      }
    : null;
  const destination =
    tracking.data?.destination.latitude != null &&
    tracking.data.destination.longitude != null
      ? {
          latitude: tracking.data.destination.latitude,
          longitude: tracking.data.destination.longitude,
        }
      : null;
  const route = useRoute(origin, destination);
  const markers: MapMarker[] = [
    ...(origin ? [{ ...origin, title: 'Driver' }] : []),
    ...(destination
      ? [{ ...destination, title: 'Delivery address', color: '#16a34a' }]
      : []),
  ];
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    await queryClient.invalidateQueries({ queryKey: ['tracking'] });
  }
  async function mutate(suffix: string, body?: unknown, method = 'POST') {
    await api(`${path}${suffix}`, body ? jsonBody(body, method) : { method });
    await refresh();
  }
  if (ready && !user) return <Redirect href="/auth/login" />;
  const detail = query.data;
  return (
    <Page
      title="Order details"
      back
      refresh={() => void refresh()}
      refreshing={query.isRefetching}
    >
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        detail && (
          <>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt bold size={22}>{`#${id.slice(0, 8)}`}</Txt>
                <Pill>{detail.order.status}</Pill>
              </Row>
              <Txt muted>{detail.business?.name || detail.order.orderType}</Txt>
              {detail.order.cancelExpiresAt && detail.order.canCancel && (
                <Row>
                  <Txt muted>Cancellation window</Txt>
                  <Countdown expiresAt={detail.order.cancelExpiresAt} />
                </Row>
              )}
              <Txt muted>
                {new Date(detail.order.createdAt).toLocaleString()}
              </Txt>
              {detail.order.businessRejectionNote && (
                <Txt>{detail.order.businessRejectionNote}</Txt>
              )}
            </Card>
            {role === 'customer' && (
              <Card>
                <Txt bold size={20}>
                  Track Order
                </Txt>
                {markers.length > 0 ? (
                  <DeliveryMap markers={markers} route={route.data} />
                ) : (
                  <Txt muted>
                    Waiting for driver — route will appear when assigned
                  </Txt>
                )}
                {tracking.error && (
                  <Txt muted>
                    Live tracking is temporarily unavailable. Pull to refresh.
                  </Txt>
                )}
                {tracking.data?.driver?.locationUpdatedAt && (
                  <Txt muted size={12}>
                    {t('Location updated: {time}', {
                      time: new Date(
                        tracking.data.driver.locationUpdatedAt,
                      ).toLocaleTimeString(),
                    })}
                  </Txt>
                )}
                {route.error && (
                  <Txt muted>Could not calculate a road route.</Txt>
                )}
              </Card>
            )}
            <Card>
              <Txt bold size={20}>
                Line items
              </Txt>
              {detail.items.map((item) => (
                <Row key={item.id} style={{ justifyContent: 'space-between' }}>
                  <Txt
                    style={{ flex: 1 }}
                  >{`${item.quantity} × ${item.productName}`}</Txt>
                  <Txt bold>{formatBirr(item.lineTotal)}</Txt>
                </Row>
              ))}
              {detail.order.packageNote && (
                <Txt>{detail.order.packageNote}</Txt>
              )}
              {role === 'admin' &&
                detail.order.businessId &&
                !['delivered', 'cancelled'].includes(detail.order.status) && (
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setLines(
                        detail.items
                          .filter((item) => item.categoryItemId)
                          .map((item) => ({
                            categoryItemId: item.categoryItemId!,
                            quantity: item.quantity,
                          })),
                      );
                      setEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
            </Card>
            <Card>
              <Txt bold size={20}>
                Summary
              </Txt>
              {[
                ['Subtotal', detail.order.totalPrice],
                ['Delivery fee', detail.order.deliveryFee],
                ['Service charge', detail.order.serviceCharge],
                ['Total', orderPayableTotal(detail.order, detail.payment)],
              ].map(([label, value]) => (
                <Row key={label} style={{ justifyContent: 'space-between' }}>
                  <Txt>{label}</Txt>
                  <Txt bold>{formatBirr(value)}</Txt>
                </Row>
              ))}
              <Row>
                <Txt>Payment status</Txt>
                <Pill>{detail.payment?.status || 'pending'}</Pill>
                <Txt muted>{detail.payment?.method || ''}</Txt>
              </Row>
              {role === 'customer' &&
                detail.payment?.method === 'telebirr' &&
                detail.payment.status !== 'paid' &&
                detail.order.status !== 'cancelled' && (
                  <Button
                    loading={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        await payForOrder(id);
                        await refresh();
                      })
                    }
                  >
                    Pay with Telebirr
                  </Button>
                )}
            </Card>
            {detail.driver && (
              <Card>
                <Txt bold size={19}>
                  Driver
                </Txt>
                <Txt>{detail.driver.fullName}</Txt>
                {detail.driver.phoneNumber && (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void Linking.openURL(`tel:${detail.driver!.phoneNumber}`)
                    }
                  >
                    {detail.driver.phoneNumber}
                  </Button>
                )}
              </Card>
            )}
            {detail.customer && (
              <Card>
                <Txt bold size={19}>
                  Customer
                </Txt>
                <Txt>{detail.customer.fullName}</Txt>
                <Txt>{detail.customer.phoneNumber || ''}</Txt>
              </Card>
            )}
            {role === 'business' &&
              (detail.order.canApprove || detail.order.canReject) && (
                <Card>
                  <Txt bold size={20}>
                    Approve or reject
                  </Txt>
                  <Button
                    disabled={!detail.order.canApprove}
                    loading={action.busy}
                    onPress={() => void action.run(() => mutate('/approve'))}
                  >
                    Approve
                  </Button>
                  <Input
                    label="Rejection reason"
                    value={reason}
                    onChangeText={setReason}
                  />
                  <Button
                    variant="danger"
                    disabled={!detail.order.canReject || !reason.trim()}
                    loading={action.busy}
                    onPress={() =>
                      void action.run(() =>
                        mutate('/reject', { note: reason.trim() }),
                      )
                    }
                  >
                    Reject
                  </Button>
                </Card>
              )}
            {role === 'admin' &&
              !['delivered', 'cancelled'].includes(detail.order.status) && (
                <Card>
                  <Choice
                    label="Assign driver"
                    value={driverId}
                    onChange={setDriverId}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...(detail.driver &&
                      !(drivers.data || []).some(
                        (driver) => driver.id === detail.driver!.id,
                      )
                        ? [
                            {
                              value: detail.driver.id,
                              label: detail.driver.fullName,
                            },
                          ]
                        : []),
                      ...(drivers.data || []).map((driver) => ({
                        value: driver.id,
                        label: driver.fullName,
                      })),
                    ]}
                  />
                  <Button
                    loading={action.busy}
                    onPress={() =>
                      void action.run(() =>
                        mutate('', { driverId: driverId || null }, 'PATCH'),
                      )
                    }
                  >
                    Save
                  </Button>
                </Card>
              )}
            {((role === 'customer' && detail.order.canCancel) ||
              (role === 'admin' && detail.order.canAdminCancel)) && (
              <Button variant="danger" onPress={() => setConfirmCancel(true)}>
                Cancel order
              </Button>
            )}
            {role === 'customer' &&
              detail.order.status === 'delivered' &&
              detail.driver && (
                <Card>
                  <Txt bold size={20}>
                    Rate delivery
                  </Txt>
                  {detail.driverFeedback ? (
                    <Txt>{`★ ${detail.driverFeedback.rating} / 5 · ${detail.driverFeedback.comment || ''}`}</Txt>
                  ) : (
                    <>
                      <Choice
                        label="Rating"
                        value={rating}
                        onChange={setRating}
                        options={[1, 2, 3, 4, 5].map((value) => ({
                          value: String(value),
                          label: `${'★'.repeat(value)} (${value}/5)`,
                        }))}
                      />
                      <Input
                        label="Comment"
                        multiline
                        value={comment}
                        onChangeText={setComment}
                      />
                      <Button
                        loading={action.busy}
                        onPress={() =>
                          void action.run(() =>
                            mutate('/feedback', {
                              rating: Number(rating),
                              comment,
                            }),
                          )
                        }
                      >
                        Submit feedback
                      </Button>
                    </>
                  )}
                </Card>
              )}
          </>
        )
      )}
      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel order"
      >
        <Txt>Cancel this order?</Txt>
        <Button
          variant="danger"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              await mutate('/cancel');
              setConfirmCancel(false);
            })
          }
        >
          Confirm
        </Button>
      </Sheet>
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Line items"
      >
        {menu.error ? (
          <ErrorState error={menu.error} retry={() => void menu.refetch()} />
        ) : (
          <>
            {lines.map((line, index) => (
              <Card key={line.categoryItemId}>
                <Txt bold>
                  {menu.data?.items.find(
                    (item) => item.id === line.categoryItemId,
                  )?.name ||
                    detail?.items.find(
                      (item) => item.categoryItemId === line.categoryItemId,
                    )?.productName ||
                    'Menu item'}
                </Txt>
                <Input
                  label="Quantity"
                  keyboardType="number-pad"
                  value={String(line.quantity)}
                  onChangeText={(value) =>
                    setLines((old) =>
                      old.map((row, i) =>
                        i === index
                          ? { ...row, quantity: Number(value) || 0 }
                          : row,
                      ),
                    )
                  }
                />
                <Button
                  variant="danger"
                  onPress={() =>
                    setLines((old) => old.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </Card>
            ))}
            <Choice
              label="Add"
              value={addItem}
              onChange={setAddItem}
              options={(menu.data?.items || [])
                .filter(
                  (item) =>
                    !lines.some((line) => line.categoryItemId === item.id),
                )
                .map((item) => ({ label: item.name, value: item.id }))}
            />
            <Button
              variant="secondary"
              disabled={!addItem}
              onPress={() => {
                setLines((old) => [
                  ...old,
                  { categoryItemId: addItem, quantity: 1 },
                ]);
                setAddItem('');
              }}
            >
              Add
            </Button>
            <Button
              loading={action.busy}
              disabled={
                !lines.length ||
                lines.some(
                  (row) => !Number.isInteger(row.quantity) || row.quantity < 1,
                )
              }
              onPress={() =>
                void action.run(async () => {
                  await mutate('', { items: lines }, 'PATCH');
                  setEditing(false);
                })
              }
            >
              Save
            </Button>
          </>
        )}
      </Sheet>
    </Page>
  );
}
