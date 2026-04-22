'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, MapPin, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CartItemView } from '@/app/(customer)/_hooks/use-carts';
import type { Notification } from '@/hooks/use-notifications';
import { catalogItemImageUrl } from '@/lib/admin-catalog-api';
import { formatBirr } from '@/lib/currency';

const NOTIFICATIONS_PREVIEW_MAX = 12;

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
    year: 'numeric',
  }).format(new Date(iso));
}

type CustomerTopNavbarProps = {
  firstName: string;
  userAddress: string;
  cartItems?: CartItemView[];
  cartTotalQuantity?: number;
  cartSubtotal?: string;
  cartLoading?: boolean;
  notifications?: Notification[];
  notificationsLoading?: boolean;
  notificationUnreadCount?: number;
};

export function CustomerTopNavbar({
  firstName,
  userAddress,
  cartItems = [],
  cartTotalQuantity = 0,
  cartSubtotal = '0.00',
  cartLoading = false,
  notifications = [],
  notificationsLoading = false,
  notificationUnreadCount = 0,
}: CustomerTopNavbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] =
    useState(false);

  const notificationPreview = notifications.slice(
    0,
    NOTIFICATIONS_PREVIEW_MAX,
  );

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
    <header className="flex items-center gap-3 pt-2">
      <div className="flex flex-1 items-center gap-2">
        <Link
          href="/"
          className="shrink-0 rounded-xl p-1 transition hover:scale-[1.02]"
          aria-label="Go to home"
        >
          <Image
            src="/flashlogo.png"
            alt="FlashGo"
            width={150}
            height={60}
            className="h-11 w-auto object-contain md:h-12"
            priority
          />
        </Link>
        <Input
          placeholder="Search something"
          className="h-11 w-full max-w-[240px] rounded-full border-0 bg-orange-50 px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0 md:max-w-[320px]"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <LanguageSwitcher />
        <Button
          asChild
          variant="outline"
          className="hidden h-11 rounded-xl border-orange-200 bg-orange-50 px-4 text-orange-700 shadow-sm transition-all hover:scale-[1.02] hover:bg-orange-100 md:inline-flex"
        >
          <Link href="/deliver-packages">Deliver Packages</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="hidden h-11 rounded-xl border-0 bg-orange-500 px-4 text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-orange-400 md:inline-flex"
        >
          <Link href="/track-order">Track Order</Link>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden h-11 items-center gap-1 rounded-full border-0 bg-orange-50 px-4 text-sm text-gray-500 shadow-sm md:flex">
              <MapPin className="size-4" />
              <span className="max-w-[200px] truncate">
                {userAddress}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={8}
            className="max-w-sm"
          >
            <span className="wrap-break-word">
              {userAddress}
            </span>
          </TooltipContent>
        </Tooltip>
        <Popover
          open={isCartOpen}
          onOpenChange={setIsCartOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full border-0 bg-white shadow-sm hover:bg-orange-50"
              aria-label="Cart"
              onMouseEnter={() => setIsCartOpen(true)}
              onMouseLeave={() => setIsCartOpen(false)}
              onClick={() => router.push('/checkout')}
            >
              <ShoppingCart className="size-5 text-gray-500" />
              {cartTotalQuantity > 0 ? (
                <Badge className="absolute -top-1 -right-1 min-w-5 rounded-full bg-orange-500 px-1.5 text-[10px] leading-5 text-white">
                  {cartTotalQuantity}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 rounded-2xl border-none bg-white p-0 shadow-xl shadow-orange-100/70"
            onMouseEnter={() => setIsCartOpen(true)}
            onMouseLeave={() => setIsCartOpen(false)}
          >
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  Your Cart
                </p>
                <p className="text-xs text-gray-500">
                  {cartTotalQuantity} items
                </p>
              </div>
              {cartLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 rounded-xl bg-orange-100/60" />
                  <Skeleton className="h-14 rounded-xl bg-orange-100/60" />
                </div>
              ) : cartItems.length === 0 ? (
                <div className="rounded-xl bg-orange-50 px-3 py-6 text-center text-sm text-gray-500">
                  Your cart is empty. Add delicious items to
                  get started.
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl bg-orange-50 p-2"
                    >
                      <div className="size-11 overflow-hidden rounded-lg bg-orange-100">
                        {catalogItemImageUrl(
                          item.itemImagePath,
                        ) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              catalogItemImageUrl(
                                item.itemImagePath,
                              ) ?? ''
                            }
                            alt={item.itemName}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {item.itemName}
                        </p>
                        <p className="text-xs text-gray-500">
                          x{item.quantity} ·{' '}
                          {formatBirr(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-orange-100 pt-2">
                <p className="text-sm font-semibold text-gray-800">
                  Subtotal
                </p>
                <p className="text-base font-bold text-orange-500">
                  {formatBirr(cartSubtotal)}
                </p>
              </div>
              <Button
                type="button"
                className="h-10 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => router.push('/checkout')}
              >
                Go to checkout
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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
              onMouseEnter={() => setIsNotificationsOpen(true)}
              onMouseLeave={() => setIsNotificationsOpen(false)}
              onClick={() => router.push('/notifications')}
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
            onMouseEnter={() => setIsNotificationsOpen(true)}
            onMouseLeave={() => setIsNotificationsOpen(false)}
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
                  No notifications yet. We will let you know when something
                  important happens.
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
                onClick={() => router.push('/notifications')}
              >
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {user ? (
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
                  onClick={() => router.push('/profile')}
                >
                  <Avatar
                    size="lg"
                    className="border-0 shadow-sm"
                  >
                    <AvatarFallback className="bg-orange-100 font-semibold text-orange-700">
                      {firstName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 rounded-xl border-0 shadow-md"
              >
                <DropdownMenuItem
                  asChild
                  className="focus:bg-orange-50 focus:text-orange-700"
                >
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="focus:bg-orange-50 focus:text-orange-700"
                >
                  <Link href="/notifications">Notifications</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-orange-50 focus:text-orange-700"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button
            asChild
            className="h-11 rounded-xl border-0 bg-orange-500 px-6 font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-orange-400"
          >
            <Link href="/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
