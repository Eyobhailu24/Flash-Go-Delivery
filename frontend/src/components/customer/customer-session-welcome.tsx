'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { fetchMyNotifications } from '@/hooks/use-notifications';

const SESSION_FLAG = 'flashgo:session-welcomed';

export function CustomerSessionWelcome() {
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SESSION_FLAG)) return;
    window.sessionStorage.setItem(SESSION_FLAG, '1');

    let cancelled = false;

    void (async () => {
      const firstName = user?.fullName?.split(' ')[0];
      let unread = 0;
      if (user) {
        try {
          const list = await fetchMyNotifications({
            unreadOnly: true,
            limit: 50,
          });
          unread = list.length;
        } catch {
          // Welcome toast still shows without the unread count.
        }
      }
      if (cancelled) return;

      const message = user
        ? unread > 0
          ? `Welcome back, ${firstName}! You have ${unread} unread notification${
              unread === 1 ? '' : 's'
            }.`
          : `Welcome back, ${firstName}!`
        : 'Welcome to FlashGo! Sign in to track orders and get updates.';

      toast(message);

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('FlashGo', {
          body: message,
          icon: '/icons/icon-192.png',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  return null;
}
