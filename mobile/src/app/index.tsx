import { Redirect } from 'expo-router';
import { useAuth, roleHome } from '@/lib/auth';
import { Page } from '@/components/page';
import { LoadingCards } from '@/components/ui';
export default function Index() {
  const { user, ready } = useAuth();
  return ready ? (
    <Redirect href={roleHome(user?.role) as never} />
  ) : (
    <Page header={false}>
      <LoadingCards />
    </Page>
  );
}
