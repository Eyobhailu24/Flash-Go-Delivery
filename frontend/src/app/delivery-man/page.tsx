"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, MapPin, Route, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBirr } from "@/lib/currency";
import {
  acceptDriverOffer,
  deliverAssignedOrder,
  fetchCurrentAssignedOrder,
  fetchCurrentDriverOffer,
  postDriverLocation,
  rejectDriverOffer,
  startAssignedOrder,
  type DriverAssignedOrder,
  type DriverOffer,
} from "@/lib/driver-dispatch-api";

function formatKm(value: string | null): string {
  if (!value) return "N/A";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "N/A";
  if (numeric < 1) return `${numeric.toFixed(2)} km`;
  return `${numeric.toFixed(1)} km`;
}

function OfferSkeleton() {
  return (
    <Card className="rounded-2xl border-none bg-card shadow-md">
      <CardHeader>
        <CardTitle>Incoming order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-6 w-2/5 bg-orange-100/80" />
        <Skeleton className="h-16 w-full bg-orange-100/80" />
        <Skeleton className="h-16 w-full bg-orange-100/80" />
      </CardContent>
    </Card>
  );
}

export default function DeliveryManPage() {
  const [offer, setOffer] = useState<DriverOffer | null>(null);
  const [assignedOrder, setAssignedOrder] = useState<DriverAssignedOrder | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [actionLoading, setActionLoading] = useState<"accept" | "reject" | null>(
    null,
  );
  const [orderActionLoading, setOrderActionLoading] = useState<
    "start" | "deliver" | null
  >(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "tracking" | "unsupported" | "denied"
  >("idle");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadOffer = async () => {
      try {
        const [offerResult, assignedResult] = await Promise.all([
          fetchCurrentDriverOffer(),
          fetchCurrentAssignedOrder(),
        ]);
        if (!isMounted) return;
        setOffer(offerResult.offer);
        setAssignedOrder(assignedResult.order);
      } catch (e) {
        if (!isMounted) return;
        toast.error(e instanceof Error ? e.message : "Could not load offers.");
      } finally {
        if (isMounted) setLoadingOffer(false);
      }
    };
    void loadOffer();
    const interval = window.setInterval(() => {
      void loadOffer();
    }, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLocationStatus("tracking");
        void postDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading:
            typeof position.coords.heading === "number"
              ? position.coords.heading
              : undefined,
          speed:
            typeof position.coords.speed === "number"
              ? position.coords.speed
              : undefined,
        });
      },
      () => {
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watcher);
    };
  }, []);

  useEffect(() => {
    if (!offer?.expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diffMs = new Date(offer.expiresAt as string).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(diffMs / 1000)));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [offer?.expiresAt]);

  const locationLabel = useMemo(() => {
    if (locationStatus === "tracking") return "Live location tracking on";
    if (locationStatus === "unsupported")
      return "Geolocation is not supported on this device";
    if (locationStatus === "denied")
      return "Location permission denied. Enable it for dispatch";
    return "Detecting location...";
  }, [locationStatus]);

  const handleAccept = async () => {
    if (!offer) return;
    setActionLoading("accept");
    try {
      await acceptDriverOffer(offer.id);
      toast.success("Order accepted.");
      const [offerResult, assignedResult] = await Promise.all([
        fetchCurrentDriverOffer(),
        fetchCurrentAssignedOrder(),
      ]);
      setOffer(offerResult.offer);
      setAssignedOrder(assignedResult.order);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!offer) return;
    setActionLoading("reject");
    try {
      await rejectDriverOffer(offer.id);
      toast.success("Order rejected. Sending to next nearest driver.");
      const [offerResult, assignedResult] = await Promise.all([
        fetchCurrentDriverOffer(),
        fetchCurrentAssignedOrder(),
      ]);
      setOffer(offerResult.offer);
      setAssignedOrder(assignedResult.order);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartTrip = async () => {
    if (!assignedOrder) return;
    setOrderActionLoading("start");
    try {
      await startAssignedOrder(assignedOrder.id);
      toast.success("Trip started.");
      const assignedResult = await fetchCurrentAssignedOrder();
      setAssignedOrder(assignedResult.order);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start trip.");
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleMarkDelivered = async () => {
    if (!assignedOrder) return;
    setOrderActionLoading("deliver");
    try {
      await deliverAssignedOrder(assignedOrder.id);
      toast.success("Order marked delivered.");
      const [offerResult, assignedResult] = await Promise.all([
        fetchCurrentDriverOffer(),
        fetchCurrentAssignedOrder(),
      ]);
      setOffer(offerResult.offer);
      setAssignedOrder(assignedResult.order);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark delivered.");
    } finally {
      setOrderActionLoading(null);
    }
  };

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
      <section className="space-y-2">
        <h1 className="text-[32px] leading-none font-semibold text-gray-900">
          Delivery dashboard
        </h1>
        <p className="text-sm text-gray-500">{locationLabel}</p>
      </section>

      {loadingOffer ? (
        <OfferSkeleton />
      ) : assignedOrder ? (
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-900">Current delivery</CardTitle>
            <p className="text-xs text-gray-500">
              Order #{assignedOrder.id.slice(0, 8)} · {assignedOrder.status}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">Route distance</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatKm(assignedOrder.routeDistanceKm)}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">Delivery fee</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatBirr(assignedOrder.deliveryFee)}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">Order total</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatBirr(assignedOrder.totalPrice)}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Business</p>
              <p className="font-semibold text-gray-800">
                {assignedOrder.business?.name ?? "Unknown business"}
              </p>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="size-3.5" />
                {assignedOrder.business?.address ?? "Address unavailable"}
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Drop-off</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <Route className="size-4 text-orange-500" />
                {assignedOrder.customer.address}
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void handleStartTrip()}
                disabled={
                  assignedOrder.status !== "accepted" ||
                  orderActionLoading !== null
                }
              >
                {orderActionLoading === "start" ? "Starting..." : "Start trip"}
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => void handleMarkDelivered()}
                disabled={
                  assignedOrder.status !== "in_transit" ||
                  orderActionLoading !== null
                }
              >
                {orderActionLoading === "deliver"
                  ? "Marking..."
                  : "Mark delivered"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !offer ? (
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardContent className="py-10 text-center text-sm text-gray-500">
            No incoming orders at the moment.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <BellRing className="size-5 text-orange-500" />
                Order incoming
              </CardTitle>
              {secondsLeft !== null ? (
                <p className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                  <Timer className="size-3.5" />
                  {secondsLeft}s left
                </p>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">Order #{offer.order.id.slice(0, 8)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">To business</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatKm(offer.distanceToBusinessKm)}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">Route distance</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatKm(offer.order.routeDistanceKm)}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-xs text-gray-500">Delivery fee</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {formatBirr(offer.order.deliveryFee)}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Business</p>
              <p className="font-semibold text-gray-800">
                {offer.business?.name ?? "Unknown business"}
              </p>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="size-3.5" />
                {offer.business?.address ?? "Address unavailable"}
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Drop-off</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <Route className="size-4 text-orange-500" />
                {offer.customer.address}
              </p>
            </div>

            <div className="rounded-xl border border-orange-100 p-3">
              <p className="mb-2 text-xs font-semibold text-gray-500">Items</p>
              <div className="space-y-1.5">
                {offer.items.slice(0, 4).map((item, index) => (
                  <p key={`${item.orderId}-${index}`} className="text-sm text-gray-700">
                    {item.productName} x {item.quantity}
                  </p>
                ))}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => void handleReject()}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "reject" ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => void handleAccept()}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "accept" ? "Accepting..." : "Accept Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
