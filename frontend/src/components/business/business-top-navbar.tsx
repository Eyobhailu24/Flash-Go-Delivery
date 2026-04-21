'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bell,
  LayoutDashboard,
  Package,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@/hooks/use-notifications';

const NOTIFICATIONS_PREVIEW_MAX = 10;

function formatRelativeNotificationTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86_400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  const d = Math.floor(diffSec / 86_400);
  if (d < 7) return `${d}d ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

const nav = [
  { href: '/business', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/business/categories', label: 'Categories', icon: ShoppingBag },
  { href: '/business/orders', label: 'Orders', icon: Package },
  { href: '/business/notifications', label: 'Notifications', icon: Bell },
  { href: '/business/account', label: 'Account', icon: UserRound },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type BusinessTopNavbarProps = {
  firstName: string;
  notifications?: Notification[];
  notificationsLoading?: boolean;
  notificationUnreadCount?: number;
};

export function BusinessTopNavbar({
  firstName,
  notifications = [],
  notificationsLoading = false,
  notificationUnreadCount = 0,
}: BusinessTopNavbarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const notificationPreview = notifications.slice(0, NOTIFICATIONS_PREVIEW_MAX);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="flex flex-col gap-3 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/business"
          className="shrink-0 rounded-xl p-1 transition hover:scale-[1.02]"
          aria-label="Business home"
        >
          <Image
            src="/flashlogo.png"
            alt="FlashGo"
            width={150}
            height={60}
            className="h-10 w-auto object-contain md:h-11"
            priority
          />
        </Link>
        <nav className="flex flex-1 flex-wrap items-center justify-end gap-1.5 sm:justify-center md:gap-2">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Button
                key={href}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={`h-9 rounded-full px-3 text-xs shadow-sm sm:h-10 sm:px-4 sm:text-sm ${
                  active
                    ? 'border-0 bg-orange-500 text-white hover:bg-orange-400'
                    : 'border-orange-200 bg-white text-orange-800 hover:bg-orange-50'
                }`}
                onClick={() => router.push(href)}
              >
                <Icon className="mr-1.5 size-3.5 sm:size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Popover
            open={isNotificationsOpen}
            onOpenChange={setIsNotificationsOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full border-0 bg-white shadow-sm hover:bg-orange-50"
                aria-label="Notifications"
              >
                <Bell className="size-5 text-gray-500" />
                {notificationUnreadCount > 0 ? (
                  <Badge className="absolute -top-1 -right-1 min-w-5 rounded-full bg-orange-500 px-1.5 text-[10px] leading-5 text-white">
                    {notificationUnreadCount > 99
                      ? '99+'
                      : notificationUnreadCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 rounded-2xl border-none bg-white p-0 shadow-xl shadow-orange-100/70"
            >
              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    Notifications
                  </p>
                  <p className="text-xs text-gray-500">
                    {notificationUnreadCount > 0
                      ? `${notificationUnreadCount} unread`
                      : 'All caught up'}
                  </p>
                </div>
                {notificationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 rounded-xl bg-orange-100/60" />
                    <Skeleton className="h-16 rounded-xl bg-orange-100/60" />
                  </div>
                ) : notificationPreview.length === 0 ? (
                  <div className="rounded-xl bg-orange-50 px-3 py-6 text-center text-sm text-gray-500">
                    No notifications yet.
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {notificationPreview.map((n) => (
                      <div
                        key={n.notificationId}
                        className={`rounded-xl p-2.5 ${
                          n.readStatus
                            ? 'bg-gray-50/80'
                            : 'border-l-4 border-orange-500 bg-orange-50/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-sm font-semibold text-gray-800">
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {formatRelativeNotificationTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  className="h-10 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                  onClick={() => router.push('/business/notifications')}
                >
                  View all
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div
            onMouseEnter={() => setIsProfileMenuOpen(true)}
            onMouseLeave={() => setIsProfileMenuOpen(false)}
          >
            <DropdownMenu
              open={isProfileMenuOpen}
              onOpenChange={setIsProfileMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition hover:opacity-90"
                  onClick={() => router.push('/business/account')}
                >
                  <Avatar size="lg" className="border-0 shadow-sm">
                    <AvatarFallback className="bg-orange-100 font-semibold text-orange-700">
                      {firstName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-xl border-0 shadow-md"
              >
                <DropdownMenuItem
                  asChild
                  className="focus:bg-orange-50 focus:text-orange-700"
                >
                  <Link href="/business/account">Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="focus:bg-orange-50 focus:text-orange-700"
                >
                  <Link href="/business/orders">Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-orange-50 focus:text-orange-700"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Logging out…' : 'Log out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        Signed in as <span className="font-medium text-foreground">{firstName}</span>
      </p>
    </header>
  );
}
