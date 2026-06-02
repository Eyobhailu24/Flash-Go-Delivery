"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock3, MapPin, PackageCheck, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { formatBirr } from "@/lib/currency";
import { useCarts } from "../../_hooks/use-carts";
import { useLiveAddress } from "../../_hooks/use-live-address";
import { useNotifications } from "@/hooks/use-notifications";
import { type CustomerOrder, useOrders } from "../../_hooks/use-orders";

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

function TrackingStep({
  label,
  isActive,
  isDone,
}: {
  label: string;
  isActive: boolean;
  isDone: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
          isDone || isActive
            ? "border-orange-500 bg-orange-500 text-white"
            : "border-orange-200 bg-white text-orange-300"
        }`}
      >
        {isDone ? "✓" : ""}
      </div>
      <p
        className={`text-sm ${
          isDone || isActive ? "text-gray-800" : "text-gray-400"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <Card className="rounded-2xl border-none bg-card shadow-md">
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-6 w-2/3 bg-orange-100/70" />
        <Skeleton className="h-20 w-full rounded-xl bg-orange-100/70" />
        <Skeleton className="h-20 w-full rounded-xl bg-orange-100/70" />
      </CardContent>
    </Card>
  );
}

export default function CustomerTrackOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = decodeURIComponent(params.orderId);
  const { user, isReady } = useAuth();
  const {
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const { liveAddress, loading: loadingLiveAddress } = useLiveAddress();
  const { selectedOrder, loadingDetail, loadOrderById, submitDriverFeedback } = useOrders();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

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
        await loadOrderById(orderId);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not load order details.",
        );
      }
    })();
  }, [loadOrderById, orderId]);

  useEffect(() => {
    if (!selectedOrder?.driverFeedback) {
      setFeedbackRating(0);
      setFeedbackComment("");
      return;
    }
    setFeedbackRating(selectedOrder.driverFeedback.rating);
    setFeedbackComment(selectedOrder.driverFeedback.comment ?? "");
  }, [selectedOrder?.driverFeedback]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  const statusProgress: Array<CustomerOrder["status"]> = [
    "pending",
    "accepted",
    "in_transit",
    "delivered",
  ];
  const activeStatusIndex = selectedOrder
    ? statusProgress.indexOf(selectedOrder.order.status)
    : -1;

  const canSubmitDriverFeedback = Boolean(
    selectedOrder &&
      selectedOrder.order.status === "delivered" &&
      selectedOrder.driver &&
      !selectedOrder.driverFeedback,
  );

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

      <section className="space-y-3">
        <Button asChild variant="outline" className="w-fit rounded-xl">
          <Link href="/track-order">Back to all orders</Link>
        </Button>
        <div className="space-y-2">
          <h1 className="text-[32px] leading-none font-semibold text-gray-900">
            Order details
          </h1>
          <p className="text-sm text-gray-500">
            View tracking progress, payment status, and item summary.
          </p>
        </div>
      </section>

      <section>
        {loadingDetail ? (
          <OrderDetailSkeleton />
        ) : !selectedOrder ? (
          <Card className="rounded-2xl border-none bg-card shadow-md">
            <CardContent className="py-10 text-center text-sm text-gray-500">
              Order details are unavailable for this order.
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-none bg-card shadow-md">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-gray-800">
                  Order #{selectedOrder.order.id.slice(0, 8)}
                </CardTitle>
                <Badge className={statusBadgeClass(selectedOrder.order.status)}>
                  {paymentStatusLabel(selectedOrder.order.status)}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                Placed on {formatOrderDate(selectedOrder.order.createdAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  Delivery progress
                </p>
                <div className="space-y-2">
                  {statusProgress.map((status, index) => (
                    <TrackingStep
                      key={status}
                      label={paymentStatusLabel(status)}
                      isActive={activeStatusIndex === index}
                      isDone={
                        selectedOrder.order.status !== "cancelled" &&
                        activeStatusIndex > index
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-orange-100 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-500">
                    {selectedOrder.order.orderType === "package"
                      ? "Pickup"
                      : "Business"}
                  </p>
                  <p className="mt-1 font-semibold text-gray-800">
                    {selectedOrder.order.orderType === "package"
                      ? "Package pickup point"
                      : (selectedOrder.business?.name ?? "Unknown business")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedOrder.order.orderType === "package"
                      ? (selectedOrder.order.pickupAddress ?? "Pickup address not provided")
                      : (selectedOrder.business?.address ?? "Address not provided")}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-500">
                    {selectedOrder.order.orderType === "package"
                      ? "Dropoff"
                      : "Driver"}
                  </p>
                  {selectedOrder.order.orderType === "package" ? (
                    <>
                      <p className="mt-1 font-semibold text-gray-800">
                        Package destination
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {selectedOrder.order.dropoffAddress ?? "Dropoff address not provided"}
                      </p>
                    </>
                  ) : null}
                  {selectedOrder.driver ? (
                    <>
                      <p className="mt-1 font-semibold text-gray-800">
                        {selectedOrder.driver.fullName}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {selectedOrder.driver.phoneNumber ?? "Phone unavailable"}
                      </p>
                    </>
                  ) : selectedOrder.order.orderType === "package" ? null : (
                    <p className="mt-1 text-sm text-gray-500">
                      Waiting for driver assignment.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-orange-50 p-3">
                  <div className="flex items-center gap-2 text-orange-600">
                    <PackageCheck className="size-4" />
                    <p className="text-xs font-semibold">Order Type</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {paymentStatusLabel(selectedOrder.order.orderType)}
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 p-3">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Truck className="size-4" />
                    <p className="text-xs font-semibold">Delivery fee</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {formatBirr(selectedOrder.order.deliveryFee)}
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 p-3">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Clock3 className="size-4" />
                    <p className="text-xs font-semibold">Payment</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {selectedOrder.payment
                      ? `${paymentStatusLabel(selectedOrder.payment.method)} · ${paymentStatusLabel(selectedOrder.payment.status)}`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedOrder.order.orderType === "package" ? (
                <div className="rounded-xl border border-orange-100 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-800">
                    Package note
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.order.packageNote?.trim() ||
                      "No package note was provided."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-orange-100 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-800">
                    Items ({selectedOrder.items.length})
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatBirr(item.unitPrice)} x {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-orange-600">
                          {formatBirr(item.lineTotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.order.orderType !== "package" && selectedOrder.driver ? (
                <div className="rounded-xl border border-orange-100 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-800">
                    Rate your driver
                  </p>
                  {selectedOrder.driverFeedback ? (
                    <div className="space-y-2 rounded-xl bg-orange-50 p-3">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={`driver-feedback-star-${index}`}
                            className={`size-4 ${
                              index < selectedOrder.driverFeedback!.rating
                                ? "fill-orange-500 text-orange-500"
                                : "text-orange-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        You rated {selectedOrder.driver.fullName}. Thank you for your feedback.
                      </p>
                      {selectedOrder.driverFeedback.comment ? (
                        <p className="text-sm text-gray-700">
                          "{selectedOrder.driverFeedback.comment}"
                        </p>
                      ) : null}
                    </div>
                  ) : canSubmitDriverFeedback ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const value = index + 1;
                          const active = feedbackRating >= value;
                          return (
                            <button
                              key={`driver-rate-star-${value}`}
                              type="button"
                              onClick={() => setFeedbackRating(value)}
                              className="rounded-full p-1 transition hover:scale-110"
                              aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                            >
                              <Star
                                className={`size-6 ${
                                  active
                                    ? "fill-orange-500 text-orange-500"
                                    : "text-orange-200"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <Textarea
                        placeholder="Optional comment about your delivery experience"
                        className="min-h-20 rounded-xl border-orange-100 bg-orange-50/30 focus-visible:ring-orange-300"
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        disabled={submittingFeedback}
                        maxLength={1000}
                      />
                      <Button
                        type="button"
                        className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                        disabled={feedbackRating < 1 || submittingFeedback}
                        onClick={() => {
                          if (!selectedOrder || feedbackRating < 1) return;
                          void (async () => {
                            setSubmittingFeedback(true);
                            try {
                              await submitDriverFeedback({
                                orderId: selectedOrder.order.id,
                                rating: feedbackRating,
                                comment: feedbackComment,
                              });
                              toast.success("Thanks for rating your driver.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Could not submit feedback.",
                              );
                            } finally {
                              setSubmittingFeedback(false);
                            }
                          })();
                        }}
                      >
                        {submittingFeedback ? "Submitting..." : "Submit rating"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Driver feedback is available after your order is delivered.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="rounded-xl border border-orange-100 bg-white p-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-gray-500">Subtotal</p>
                  <p className="font-medium text-gray-800">
                    {formatBirr(selectedOrder.order.totalPrice)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <p className="text-gray-500">Delivery fee</p>
                  <p className="font-medium text-gray-800">
                    {formatBirr(selectedOrder.order.deliveryFee)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <p className="text-gray-500">Service charge</p>
                  <p className="font-medium text-gray-800">
                    {formatBirr(selectedOrder.order.serviceCharge)}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-orange-100 pt-3">
                  <p className="font-semibold text-gray-900">Total</p>
                  <p className="text-lg font-bold text-orange-500">
                    {formatBirr(
                      Number(selectedOrder.order.totalPrice) +
                        Number(selectedOrder.order.deliveryFee) +
                        Number(selectedOrder.order.serviceCharge),
                    )}
                  </p>
                </div>
                {selectedOrder.payment?.transactionId ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Transaction Ref: {selectedOrder.payment.transactionId}
                  </p>
                ) : null}
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="size-3" />
                  Delivery to your selected customer address.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
