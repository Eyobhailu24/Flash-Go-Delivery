"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, MapPin, Route, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryTopNavbar } from "@/components/delivery/delivery-top-navbar";
import { DriverRouteMap } from "@/components/delivery/driver-route-map";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
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

type LatLng = {
  latitude: number;
  longitude: number;
};

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
  const { user } = useAuth();
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
  const [deliveryCodeDialogOpen, setDeliveryCodeDialogOpen] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState("");
  const firstName = user?.fullName?.split(" ")[0] ?? "Driver";

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

  const assignedPickupPoint = useMemo<LatLng | null>(() => {
    if (!assignedOrder) return null;
    const pickup = assignedOrder.pickup;
    if (
      pickup &&
      typeof pickup.latitude === "number" &&
      typeof pickup.longitude === "number"
    ) {
      return { latitude: pickup.latitude, longitude: pickup.longitude };
    }
    if (
      assignedOrder.business &&
      typeof assignedOrder.business.latitude === "number" &&
      typeof assignedOrder.business.longitude === "number"
    ) {
      return {
        latitude: assignedOrder.business.latitude,
        longitude: assignedOrder.business.longitude,
      };
    }
    return null;
  }, [assignedOrder]);
  const assignedDestinationPoint = useMemo<LatLng | null>(() => {
    if (
      !assignedOrder ||
      typeof assignedOrder.customer.latitude !== "number" ||
      typeof assignedOrder.customer.longitude !== "number"
    ) {
      return null;
    }
    return {
      latitude: assignedOrder.customer.latitude,
      longitude: assignedOrder.customer.longitude,
    };
  }, [assignedOrder]);

  const offerPickupPoint = useMemo<LatLng | null>(() => {
    if (!offer) return null;
    const pickup = offer.pickup;
    if (
      pickup &&
      typeof pickup.latitude === "number" &&
      typeof pickup.longitude === "number"
    ) {
      return { latitude: pickup.latitude, longitude: pickup.longitude };
    }
    if (
      offer.business &&
      typeof offer.business.latitude === "number" &&
      typeof offer.business.longitude === "number"
    ) {
      return {
        latitude: offer.business.latitude,
        longitude: offer.business.longitude,
      };
    }
    return null;
  }, [offer]);
  const offerDestinationPoint = useMemo<LatLng | null>(() => {
    if (
      !offer ||
      typeof offer.customer.latitude !== "number" ||
      typeof offer.customer.longitude !== "number"
    ) {
      return null;
    }
    return {
      latitude: offer.customer.latitude,
      longitude: offer.customer.longitude,
    };
  }, [offer]);

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
    if (deliveryCode.trim().length !== 5) {
      toast.error("Please enter the 5-digit code from customer.");
      return;
    }
    setOrderActionLoading("deliver");
    try {
      await deliverAssignedOrder(assignedOrder.id, deliveryCode.trim());
      toast.success("Order marked delivered.");
      const [offerResult, assignedResult] = await Promise.all([
        fetchCurrentDriverOffer(),
        fetchCurrentAssignedOrder(),
      ]);
      setOffer(offerResult.offer);
      setAssignedOrder(assignedResult.order);
      setDeliveryCode("");
      setDeliveryCodeDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark delivered.");
    } finally {
      setOrderActionLoading(null);
    }
  };

  return (
    <>
      <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
        <DeliveryTopNavbar firstName={firstName} statusLabel={locationLabel} />

      <section className="space-y-2">
        <h1 className="text-[32px] leading-none font-semibold text-gray-900">
          Delivery dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Incoming offers and active trips update automatically every few seconds.
        </p>
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

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Live route map</p>
              <DriverRouteMap
                pickup={assignedPickupPoint}
                destination={assignedDestinationPoint}
              />
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
                onClick={() => setDeliveryCodeDialogOpen(true)}
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

            <div className="space-y-2 rounded-xl border border-orange-100 p-3">
              <p className="text-xs font-semibold text-gray-500">Live route map</p>
              <DriverRouteMap
                pickup={offerPickupPoint}
                destination={offerDestinationPoint}
              />
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

      {assignedOrder || offer ? (
        <section className="sticky bottom-3 z-20 mt-auto md:hidden">
          <Card className="rounded-2xl border-none bg-white/95 shadow-xl backdrop-blur">
            <CardContent className="space-y-3 pt-4">
              <p className="text-xs font-semibold text-orange-600">
                {assignedOrder ? "Current trip brief" : "Incoming offer brief"}
              </p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Pickup</p>
                <p className="text-sm font-medium text-gray-800">
                  {assignedOrder
                    ? assignedOrder.pickup?.address ??
                      assignedOrder.business?.address ??
                      "Pickup unavailable"
                    : offer?.pickup?.address ??
                      offer?.business?.address ??
                      "Pickup unavailable"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Drop-off</p>
                <p className="text-sm font-medium text-gray-800">
                  {assignedOrder?.customer.address ?? offer?.customer.address}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
      </main>
      <Dialog open={deliveryCodeDialogOpen} onOpenChange={setDeliveryCodeDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle>Confirm delivery with customer code</DialogTitle>
            <DialogDescription>
              Ask the customer for their 5-digit delivery code and enter it below.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <InputOTP
              maxLength={5}
              value={deliveryCode}
              onChange={setDeliveryCode}
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={orderActionLoading === "deliver"}
              containerClassName="justify-center"
            >
              <InputOTPGroup className="gap-2 rounded-none bg-transparent">
                <InputOTPSlot
                  index={0}
                  className="size-12 rounded-xl border border-gray-900 bg-black text-lg font-semibold text-white data-[active=true]:z-10 data-[active=true]:border-orange-400 data-[active=true]:ring-2 data-[active=true]:ring-orange-300"
                />
                <InputOTPSlot
                  index={1}
                  className="size-12 rounded-xl border border-gray-900 bg-black text-lg font-semibold text-white data-[active=true]:z-10 data-[active=true]:border-orange-400 data-[active=true]:ring-2 data-[active=true]:ring-orange-300"
                />
                <InputOTPSlot
                  index={2}
                  className="size-12 rounded-xl border border-gray-900 bg-black text-lg font-semibold text-white data-[active=true]:z-10 data-[active=true]:border-orange-400 data-[active=true]:ring-2 data-[active=true]:ring-orange-300"
                />
                <InputOTPSlot
                  index={3}
                  className="size-12 rounded-xl border border-gray-900 bg-black text-lg font-semibold text-white data-[active=true]:z-10 data-[active=true]:border-orange-400 data-[active=true]:ring-2 data-[active=true]:ring-orange-300"
                />
                <InputOTPSlot
                  index={4}
                  className="size-12 rounded-xl border border-gray-900 bg-black text-lg font-semibold text-white data-[active=true]:z-10 data-[active=true]:border-orange-400 data-[active=true]:ring-2 data-[active=true]:ring-orange-300"
                />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeliveryCodeDialogOpen(false);
                setDeliveryCode("");
              }}
              disabled={orderActionLoading === "deliver"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-orange-500 text-white hover:bg-orange-400"
              disabled={
                deliveryCode.trim().length !== 5 || orderActionLoading === "deliver"
              }
              onClick={() => void handleMarkDelivered()}
            >
              {orderActionLoading === "deliver" ? "Verifying..." : "Verify & complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
