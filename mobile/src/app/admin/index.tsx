import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Page, go, navigation } from '@/components/page';
import {
  Button,
  Card,
  ErrorState,
  LoadingCards,
  Row,
  Txt,
} from '@/components/ui';
import { api } from '@/lib/auth-api';
import type { User } from '@/api/users';
export default function AdminHome() {
  const query = useQuery({
    queryKey: ['users', 'overview'],
    queryFn: () => api<{ users: User[] }>('/users?limit=200'),
  });
  const rows = query.data?.users || [];
  return (
    <Page
      title="Overview"
      refresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      {query.isPending ? (
        <LoadingCards />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <View style={{ gap: 14 }}>
          <Row>
            <Card style={{ flex: 1 }}>
              <Txt muted>Users loaded</Txt>
              <Txt bold size={35}>
                {rows.length}
              </Txt>
            </Card>
            <Card style={{ flex: 1 }}>
              <Txt muted>Customers</Txt>
              <Txt bold size={35}>
                {rows.filter((user) => user.role === 'customer').length}
              </Txt>
            </Card>
          </Row>
          <Row>
            <Card style={{ flex: 1 }}>
              <Txt muted>Drivers</Txt>
              <Txt bold size={35}>
                {rows.filter((user) => user.role === 'driver').length}
              </Txt>
            </Card>
            <Card style={{ flex: 1 }}>
              <Txt muted>Businesses</Txt>
              <Txt bold size={35}>
                {rows.filter((user) => user.role === 'business').length}
              </Txt>
            </Card>
          </Row>
        </View>
      )}
      <Card>
        <Txt bold size={21}>
          Manage FlashGo
        </Txt>
        {navigation.admin
          .filter(([_, path]) => path !== '/admin' && path !== '/profile')
          .map(([label, path]) => (
            <Button key={path} variant="secondary" onPress={() => go(path)}>
              {label}
            </Button>
          ))}
      </Card>
    </Page>
  );
}
