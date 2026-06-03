"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { CustomerMapLocationPickerDialog } from "@/components/customer/customer-map-location-picker-dialog";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { formatBirr } from "@/lib/currency";
import { reverseGeocodeCoordinates } from "@/lib/location-api";
import {
  fetchMyCustomerProfile,
  patchMyCustomerProfile,
  type CustomerAddress,
} from "@/lib/customer-profile-api";
import { useCarts } from "../_hooks/use-carts";
import {
  type CheckoutPaymentMethod,
  useCheckout,
} from "../_hooks/use-checkout";
import { useLiveAddress } from "../_hooks/use-live-address";
import { useNotifications } from "@/hooks/use-notifications";

type Coordinates = { latitude: number; longitude: number };
type LocationTarget = "pickup" | "dropoff";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const earthRadiusKm = 6371;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function computeDeliveryFee(routeDistanceKm: number): number {
  const extraKm = Math.max(0, Math.ceil(routeDistanceKm - 1));
  return 50 + extraKm * 15;
}

export default function CustomerDeliverPackagesPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const {
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const { liveAddress, loading: loadingLiveAddress, refreshAddress } =
    useLiveAddress();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();
  const { placePackageOrder, loading: checkoutLoading } = useCheckout();
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<CheckoutPaymentMethod>("cash");
  const [profileAddresses, setProfileAddresses] = useState<CustomerAddress[]>([]);
  const [pickupAddress, setPickupAddress] = useState<CustomerAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<CustomerAddress | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<LocationTarget>("pickup");
  const [packageNote, setPackageNote] = useState("");

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
    : liveAddress || profileAddress || "Addis Ababa";
  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  useEffect(() => {
    void loadNotifications({ limit: 50 });
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchMyCustomerProfile();
        if (cancelled) return;
        const addresses = profile?.addresses ?? [];
        const defaultAddress = addresses.find((entry) => entry.isDefault) ?? null;
        setProfileAddresses(addresses);
        setPickupAddress(defaultAddress ?? addresses[0] ?? null);
        setDropoffAddress(addresses[1] ?? defaultAddress ?? addresses[0] ?? null);
      } catch {
        if (!cancelled) {
          setProfileAddresses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickupCoordinates = useMemo(() => {
    if (
      typeof pickupAddress?.lat !== "number" ||
      typeof pickupAddress?.lng !== "number"
    ) {
      return null;
    }
    return { latitude: pickupAddress.lat, longitude: pickupAddress.lng };
  }, [pickupAddress]);

  const dropoffCoordinates = useMemo(() => {
    if (
      typeof dropoffAddress?.lat !== "number" ||
      typeof dropoffAddress?.lng !== "number"
    ) {
      return null;
    }
    return { latitude: dropoffAddress.lat, longitude: dropoffAddress.lng };
  }, [dropoffAddress]);

  const routeDistanceKm =
    pickupCoordinates && dropoffCoordinates
      ? haversineDistanceKm(
          { lat: pickupCoordinates.latitude, lng: pickupCoordinates.longitude },
          { lat: dropoffCoordinates.latitude, lng: dropoffCoordinates.longitude },
        )
      : null;
  const deliveryFee = routeDistanceKm === null ? null : computeDeliveryFee(routeDistanceKm);
  const serviceCharge = 50;
  const basePrice = 100;
  const payableTotal =
    deliveryFee === null ? null : basePrice + deliveryFee + serviceCharge;

  const saveAddress = async (
    nextAddress: string,
    coords: Coordinates,
    target: LocationTarget,
    label = "Map pin",
  ) => {
    setSavingAddress(true);
    try {
      const profile = await fetchMyCustomerProfile();
      const existing = profile?.addresses ?? [];
      const updated = await patchMyCustomerProfile({
        addresses: [
          {
            label,
            address: nextAddress,
            lat: coords.latitude,
            lng: coords.longitude,
            isDefault: existing.length === 0,
          },
          ...existing.filter(
            (entry) =>
              !(
                entry.address === nextAddress &&
                entry.lat === coords.latitude &&
                entry.lng === coords.longitude
              ),
          ),
        ],
      });
      const addresses = updated.addresses ?? [];
      setProfileAddresses(addresses);
      const newest = addresses[0] ?? null;
      if (target === "pickup") {
        setPickupAddress(newest);
      } else {
        setDropoffAddress(newest);
      }
      toast.success("Location saved to your profile.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save location.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleUseCurrentLocation = async (target: LocationTarget) => {
    try {
      await refreshAddress();
      const current = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });
      const lat = current.coords.latitude;
      const lng = current.coords.longitude;
      const resolved = await reverseGeocodeCoordinates(lat, lng);
      const nextAddress = resolved?.formattedAddress ?? `Pinned: ${lat}, ${lng}`;
      await saveAddress(nextAddress, { latitude: lat, longitude: lng }, target, "Current location");
    } catch {
      // handled by saveAddress
    }
  };

  const handleMapConfirm = async (coords: Coordinates) => {
    const resolved = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
    const nextAddress =
      resolved?.formattedAddress ??
      `Pinned: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    await saveAddress(nextAddress, coords, mapTarget);
  };

  const onPlacePackageOrder = async () => {
    if (!pickupCoordinates || !dropoffCoordinates || !pickupAddress || !dropoffAddress) {
      toast.error("Pick both pickup and dropoff locations first.");
      return;
    }
    try {
      const result = await placePackageOrder({
        paymentMethod: selectedPaymentMethod,
        pickup: {
          address: pickupAddress.address,
          lat: pickupCoordinates.latitude,
          lng: pickupCoordinates.longitude,
        },
        dropoff: {
          address: dropoffAddress.address,
          lat: dropoffCoordinates.latitude,
          lng: dropoffCoordinates.longitude,
        },
        packageNote: packageNote.trim() ? packageNote.trim() : undefined,
      });
      if (selectedPaymentMethod === "telebirr") {
        if (!result.payment?.checkoutUrl) {
          throw new Error("Telebirr checkout URL is missing.");
        }
        window.location.href = result.payment.checkoutUrl;
        return;
      }
      toast.success("Package delivery order created.");
      router.push(
        `/track-order/${encodeURIComponent(result.checkout.order.id)}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place package order.");
    }
  };

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

      <section>
        <h1 className="text-[32px] leading-none font-semibold text-gray-900">
          Deliver Packages
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose pickup and dropoff points. We calculate distance and assign the nearest driver.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-800">Route details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["pickup", "dropoff"] as const).map((target) => {
              const selected = target === "pickup" ? pickupAddress : dropoffAddress;
              const selectedValue = selected?.address ?? "";
              const coords = target === "pickup" ? pickupCoordinates : dropoffCoordinates;
              return (
                <div key={target} className="rounded-2xl bg-orange-50 p-3">
                  <p className="text-sm font-semibold text-gray-800 capitalize">
                    {target} location
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {selected?.address ?? "No location selected yet."}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {coords
                      ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                      : "Coordinates missing"}
                  </p>
                  <div className="mt-2">
                    <Select
                      value={selectedValue}
                      onValueChange={(value) => {
                        const picked = profileAddresses.find((entry) => entry.address === value);
                        if (!picked) return;
                        if (target === "pickup") {
                          setPickupAddress(picked);
                        } else {
                          setDropoffAddress(picked);
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl border-orange-200 bg-white text-left text-sm">
                        <SelectValue placeholder="Choose from saved addresses" />
                      </SelectTrigger>
                      <SelectContent>
                        {profileAddresses.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No saved addresses
                          </SelectItem>
                        ) : (
                          profileAddresses.map((entry, index) => (
                            <SelectItem
                              key={`${entry.address}-${index}`}
                              value={entry.address}
                            >
                              {entry.label ? `${entry.label} - ` : ""}
                              {entry.address}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-orange-200 bg-white text-orange-600 hover:bg-orange-100"
                      onClick={() => void handleUseCurrentLocation(target)}
                      disabled={savingAddress}
                    >
                      Use current location
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-orange-200 bg-white text-orange-600 hover:bg-orange-100"
                      onClick={() => {
                        setMapTarget(target);
                        setMapPickerOpen(true);
                      }}
                      disabled={savingAddress}
                    >
                      Pick on map
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="rounded-2xl bg-orange-50 p-3">
              <p className="mb-2 text-sm font-semibold text-gray-800">
                Package note
              </p>
              <Textarea
                value={packageNote}
                onChange={(event) => setPackageNote(event.target.value)}
                placeholder="Add recipient details, landmarks, or handling instructions..."
                className="min-h-[96px] rounded-xl border-orange-200 bg-white"
                maxLength={2000}
              />
              <p className="mt-1 text-[11px] text-gray-500">
                {packageNote.length}/2000 characters
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-800">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <div className="flex items-center gap-2 text-orange-600">
                <Package className="size-4" />
                <p className="text-sm font-semibold">Package order</p>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Price includes a base package charge + distance delivery fee.
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Distance</span>
              <span className="font-medium text-gray-800">
                {routeDistanceKm === null ? "--" : `${routeDistanceKm.toFixed(2)} km`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Base price</span>
              <span className="font-medium text-gray-800">{formatBirr(basePrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Delivery fee</span>
              <span className="font-medium text-gray-800">
                {deliveryFee === null ? "--" : formatBirr(deliveryFee)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Service charge</span>
              <span className="font-medium text-gray-800">
                {formatBirr(serviceCharge)}
              </span>
            </div>
            <div className="border-t border-orange-100 pt-3">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total payable</span>
                <span className="text-xl font-bold text-orange-500">
                  {payableTotal === null ? "--" : formatBirr(payableTotal)}
                </span>
              </div>
              <div className="mb-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800">Payment method</p>
                <div className="grid gap-2">
                  {(["cash", "telebirr"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selectedPaymentMethod === method
                          ? "border-orange-400 bg-orange-50 shadow-sm"
                          : "border-orange-100 bg-white hover:border-orange-300"
                      }`}
                      onClick={() => setSelectedPaymentMethod(method)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          {method === "cash" ? "Cash on Delivery" : "Telebirr"}
                        </p>
                        {selectedPaymentMethod === method ? (
                          <Badge className="bg-orange-500 text-white">Selected</Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => void onPlacePackageOrder()}
                disabled={
                  checkoutLoading ||
                  savingAddress ||
                  !pickupCoordinates ||
                  !dropoffCoordinates
                }
              >
                {checkoutLoading ? "Placing order..." : "Place package order"}
              </Button>
              <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="size-3" />
                Driver assignment follows the existing nearest-driver flow.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <CustomerMapLocationPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLatitude={
          mapTarget === "pickup"
            ? (pickupCoordinates?.latitude ?? null)
            : (dropoffCoordinates?.latitude ?? null)
        }
        initialLongitude={
          mapTarget === "pickup"
            ? (pickupCoordinates?.longitude ?? null)
            : (dropoffCoordinates?.longitude ?? null)
        }
        onConfirm={(location) => {
          void handleMapConfirm(location);
        }}
      />
    </main>
  );
}
