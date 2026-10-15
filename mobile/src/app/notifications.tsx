import { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Page } from '@/components/page';
import {
  Button,
  Card,
  Choice,
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
import { useAuth } from '@/lib/auth';
import { api, jsonBody } from '@/lib/auth-api';
import { registerPush } from '@/lib/notifications';
type Notification = {
  notificationId: string;
  title: string;
  message: string;
  type: string;
  readStatus: boolean;
  createdAt: string;
};
export default function NotificationsScreen() {
  const { user, ready } = useAuth();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: () =>
      api<{ notifications: Notification[] }>('/notifications/me?limit=100'),
  });
  if (ready && !user) return <Redirect href="/auth/login" />;
  return (
    <Page title="Notifications" back scroll={false}>
      <Row>
        <Button
          variant="secondary"
          loading={action.busy}
          onPress={() =>
            void action.run(() => registerPush(), 'Notifications enabled')
          }
        >
          Enable notifications
        </Button>
        {user?.role === 'admin' && (
          <Button onPress={() => setOpen(true)}>Add</Button>
        )}
      </Row>
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data?.notifications || []}
          keyExtractor={(item) => item.notificationId}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 15 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt bold size={18} style={{ flex: 1 }}>
                  {item.title}
                </Txt>
                {!item.readStatus && <Pill active>New</Pill>}
              </Row>
              <Txt muted>{item.message}</Txt>
              <Txt muted size={11}>
                {new Date(item.createdAt).toLocaleString()}
              </Txt>
              {!item.readStatus && (
                <Button
                  variant="ghost"
                  loading={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await api(
                        `/mobile/notifications/${item.notificationId}/read`,
                        { method: 'PATCH' },
                      );
                      await query.refetch();
                    })
                  }
                >
                  Mark as read
                </Button>
              )}
            </Card>
          )}
          ListEmptyComponent={<Empty />}
          onRefresh={() => void query.refetch()}
          refreshing={query.isRefetching}
          ListFooterComponent={<View style={{ height: 25 }} />}
        />
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Send notification"
      >
        <Input label="Title" value={title} onChangeText={setTitle} />
        <Input
          label="Message"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <Choice
          label="Audience"
          value={audience}
          onChange={setAudience}
          options={[
            'all',
            'customer',
            'business',
            'driver',
            'admin',
            'customers_and_businesses',
          ].map((value) => ({ label: value, value }))}
        />
        <Button
          loading={action.busy}
          disabled={!title.trim() || !message.trim()}
          onPress={() =>
            void action.run(async () => {
              await api(
                '/notifications/broadcast',
                jsonBody({ title, message, audience, type: 'announcement' }),
              );
              setOpen(false);
              setTitle('');
              setMessage('');
              await query.refetch();
            })
          }
        >
          Send notification
        </Button>
      </Sheet>
    </Page>
  );
}
