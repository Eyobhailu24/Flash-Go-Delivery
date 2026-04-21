"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Bell, RefreshCw, Sparkles } from "lucide-react";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { useCarts } from "../_hooks/use-carts";
import { useLiveAddress } from "../_hooks/use-live-address";
import { useNotifications } from "@/hooks/use-notifications";

function formatWhen(iso: string): { relative: string; full: string } {
  const d = new Date(iso);
  const full = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  let relative = full;
  if (diffSec < 60) relative = "Just now";
  else if (diffSec < 3600)
    relative = `${Math.floor(diffSec / 60)} min ago`;
  else if (diffSec < 86_400)
    relative = `${Math.floor(diffSec / 3600)} hr ago`;
  else if (diffSec < 604_800)
    relative = `${Math.floor(diffSec / 86_400)} days ago`;
  return { relative, full };
}

export default function CustomerNotificationsPage() {
  const { user, isReady } = useAuth();
  const {
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    loadNotifications,
  } = useNotifications();
  const { liveAddress, loading: loadingLiveAddress } = useLiveAddress();

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const firstName = user?.fullName?.split(" ")[0] ?? "Guest";
  const profileAddress =
    (user as { address?: string } | null)?.address?.trim() || "";
  const userAddress = loadingLiveAddress
    ? "Detecting location..."
    : liveAddress || profileAddress || "Purwokerto Selatan";

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  useEffect(() => {
    void loadNotifications({ limit: 100 });
  }, [loadNotifications]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-10 md:px-6">
      <CustomerTopNavbar
        firstName={firstName}
        todayLabel={todayLabel}
        userAddress={userAddress}
        cartItems={cartItemsView}
        cartTotalQuantity={activeCartSummary?.totalQuantity ?? 0}
        cartSubtotal={activeCartSummary?.subtotal ?? "0.00"}
        cartLoading={cartLoading}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        notificationUnreadCount={notificationUnreadCount}
      />

      <section className="relative overflow-hidden rounded-3xl border border-orange-100/80 bg-linear-to-br from-orange-50 via-white to-amber-50/40 p-6 shadow-md shadow-orange-100/50 md:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-orange-200/30 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 size-32 rounded-full bg-amber-200/25 blur-2xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-orange-700 shadow-sm ring-1 ring-orange-100">
              <Sparkles className="size-3.5" />
              Stay in the loop
            </div>
            <h1 className="text-[32px] leading-none font-semibold tracking-tight text-gray-900 md:text-[36px]">
              Notifications
            </h1>
            <p className="max-w-lg text-sm text-gray-600">
              Orders, promos, and updates from FlashGo appear here. Unread
              items are highlighted so you never miss what matters.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 rounded-xl border-orange-200 bg-white/90 text-orange-800 hover:bg-orange-50"
            disabled={notificationsLoading}
            onClick={() => void loadNotifications({ limit: 100 })}
          >
            <RefreshCw
              className={`size-4 ${notificationsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </section>

      {notificationsError ? (
        <Alert variant="destructive">
          <AlertDescription>{notificationsError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700">
            {notificationsLoading
              ? "Loading…"
              : `${notifications.length} in this list`}
          </p>
          {notificationUnreadCount > 0 ? (
            <Badge className="rounded-full bg-orange-500 px-2.5 text-white hover:bg-orange-500">
              {notificationUnreadCount} unread
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="rounded-full border-0 bg-emerald-50 text-emerald-800"
            >
              All caught up
            </Badge>
          )}
        </div>

        {notificationsLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-28 rounded-2xl bg-orange-100/50" />
            <Skeleton className="h-28 rounded-2xl bg-orange-100/50" />
            <Skeleton className="h-28 rounded-2xl bg-orange-100/50" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="rounded-2xl border-none bg-card shadow-md">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <Bell className="size-8" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-gray-900">
                  You are all set
                </p>
                <p className="max-w-sm text-sm text-gray-500">
                  When there is news about your orders or your account, it will
                  show up here.
                </p>
              </div>
              <Button
                asChild
                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              >
                <Link href="/">Browse restaurants</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => {
              const { relative, full } = formatWhen(n.createdAt);
              return (
                <li key={n.notificationId}>
                  <Card
                    className={`overflow-hidden rounded-2xl border-none shadow-md transition hover:shadow-lg ${
                      n.readStatus
                        ? "bg-card"
                        : "bg-linear-to-r from-orange-50/90 to-white ring-2 ring-orange-200/60"
                    }`}
                  >
                    <CardContent className="p-4 md:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!n.readStatus ? (
                              <span className="size-2 shrink-0 rounded-full bg-orange-500" />
                            ) : null}
                            <h2 className="text-base font-semibold text-gray-900">
                              {n.title}
                            </h2>
                            <Badge
                              variant="outline"
                              className="rounded-lg border-orange-200 text-[10px] font-normal uppercase tracking-wide text-orange-800"
                            >
                              {n.type.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed text-gray-600">
                            {n.message}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-gray-500 sm:pt-1">
                          <p className="font-medium text-gray-700">
                            {relative}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {full}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
