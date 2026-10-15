import { RoleGuard } from '@/components/role-guard';
export default function Layout() {
  return <RoleGuard role="business" />;
}
