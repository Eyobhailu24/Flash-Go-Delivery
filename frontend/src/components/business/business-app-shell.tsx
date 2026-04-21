'use client';

import { useEffect, useMemo } from 'react';
import { BusinessTopNavbar } from '@/components/business/business-top-navbar';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/hooks/use-notifications';

export function BusinessAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isReady } = useAuth();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();

  const firstName = user?.fullName?.split(' ')[0] ?? 'Partner';

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    void loadNotifications({ limit: 40 });
  }, [loadNotifications]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8 text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-6 pb-12 md:px-6">
      <BusinessTopNavbar
        firstName={firstName}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        notificationUnreadCount={notificationUnreadCount}
      />
      {children}
    </div>
  );
}
