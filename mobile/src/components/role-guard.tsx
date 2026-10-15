import { Redirect, Slot } from 'expo-router';
import { View } from 'react-native';
import { useAuth, roleHome } from '@/lib/auth';
import type { UserRole } from '@/types/auth';
import { LoadingCards } from './ui';
export function RoleGuard({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  if (!ready)
    return (
      <View style={{ padding: 24 }}>
        <LoadingCards />
      </View>
    );
  if (!user && role !== 'customer') return <Redirect href="/auth/login" />;
  if (user && user.role !== role)
    return <Redirect href={roleHome(user.role) as never} />;
  return <Slot />;
}
