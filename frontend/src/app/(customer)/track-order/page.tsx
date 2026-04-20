"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { formatBirr } from "@/lib/currency";
import { useCarts } from "../_hooks/use-carts";
import { useLiveAddress } from "../_hooks/use-live-address";
import { useNotifications } from "../_hooks/use-notifications";
import { type CustomerOrder, useOrders } from "../_hooks/use-orders";

function formatOrderDate(input: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

function statusBadgeClass(status: CustomerOrder["status"]): string {
  if (status === "delivered") return "bg-green-100 text-green-700";
  if (status === "in_transit") return "bg-blue-100 text-blue-700";
  if (status === "accepted") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  return "bg-orange-100 text-orange-700";
}

function paymentStatusLabel(status: string): string {
  return status.replace("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

export default function CustomerTrackOrderPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const {
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const { liveAddress, loading: loadingLiveAddress } = useLiveAddress();
  const { orders, loadingOrders, loadOrders } = useOrders();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();

  const firstName = user?.fullName?.split(" ")[0] ?? "Guest";
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
  const profileAddress =
    (user as { address?: string } | null)?.address?.trim() || "";
  const userAddress = loadingLiveAddress
    ? "Detecting location..."
    : liveAddress || profileAddress || "Purwokerto Selatan";

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  useEffect(() => {
    void loadNotifications({ limit: 50 });
  }, [loadNotifications]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadOrders();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not load your orders.",
        );
      }
    })();
  }, [loadOrders]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
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

      <section className="space-y-2">
        <h1 className="text-[32px] leading-none font-semibold text-gray-900">
          Track your orders
        </h1>
        <p className="text-sm text-gray-500">
          Select an order to open a dedicated tracking details page.
        </p>
      </section>

      <section>
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-800">Order list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingOrders ? (
              <>
                <Skeleton className="h-24 rounded-xl bg-orange-100/70" />
                <Skeleton className="h-24 rounded-xl bg-orange-100/70" />
              </>
            ) : orders.length === 0 ? (
              <p className="rounded-xl bg-orange-50 px-4 py-6 text-center text-sm text-gray-500">
                You have not placed any orders yet.
              </p>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/track-order/${order.id}`)}
                  className="w-full rounded-2xl border border-orange-100 p-3 text-left transition-all hover:border-orange-200 hover:bg-orange-50/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-800">
                      Order #{order.id.slice(0, 8)}
                    </p>
                    <Badge className={statusBadgeClass(order.status)}>
                      {paymentStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatOrderDate(order.createdAt)}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <p className="font-medium text-gray-700">
                      {formatBirr(order.totalPrice)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.payment
                        ? `${paymentStatusLabel(order.payment.method)} · ${paymentStatusLabel(order.payment.status)}`
                        : "No payment info"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
