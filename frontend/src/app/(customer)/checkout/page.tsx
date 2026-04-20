"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerMapLocationPickerDialog } from "@/components/customer/customer-map-location-picker-dialog";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { catalogItemImageUrl } from "@/lib/admin-catalog-api";
import { formatBirr } from "@/lib/currency";
import { useCarts } from "../_hooks/use-carts";
import {
  estimateCheckoutOrder,
  type CheckoutPaymentMethod,
  useCheckout,
} from "../_hooks/use-checkout";
import { useLiveAddress } from "../_hooks/use-live-address";
import { useNotifications } from "../_hooks/use-notifications";
import { reverseGeocodeCoordinates } from "@/lib/location-api";
import {
  fetchMyCustomerProfile,
  patchMyCustomerProfile,
  type CustomerAddress,
} from "@/lib/customer-profile-api";

type Coordinates = {
  latitude: number;
  longitude: number;
};

function CheckoutSkeleton() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="rounded-2xl border-none bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-gray-800">Your order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 rounded-xl bg-orange-100/70" />
          <Skeleton className="h-20 rounded-xl bg-orange-100/70" />
          <Skeleton className="h-20 rounded-xl bg-orange-100/70" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-none bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-gray-800">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full bg-orange-100/70" />
          <Skeleton className="h-4 w-full bg-orange-100/70" />
          <Skeleton className="h-10 w-full rounded-xl bg-orange-200/80" />
        </CardContent>
      </Card>
    </section>
  );
}

export default function CustomerCheckoutPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const {
    activeCart,
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    changeItemQuantity,
    removeItem,
    isUpdatingItem,
    loading: cartLoading,
  } = useCarts();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();
  const { placeOrder, loading: checkoutLoading } = useCheckout();
  const [pricingPreview, setPricingPreview] = useState<{
    routeDistanceKm: string;
    deliveryFee: string;
    serviceCharge: string;
    totalAmount: string;
  } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<CheckoutPaymentMethod>("cash");
  const [addressSaving, setAddressSaving] = useState(false);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] =
    useState<CustomerAddress | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

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
  const {
    liveAddress,
    loading: loadingLiveAddress,
    refreshAddress,
  } = useLiveAddress();
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchMyCustomerProfile();
        if (cancelled) return;
        const addresses = profile?.addresses ?? [];
        const fallback = addresses[0] ?? null;
        setSelectedDeliveryAddress(
          addresses.find((entry) => entry.isDefault) ?? fallback,
        );
      } catch {
        if (!cancelled) setSelectedDeliveryAddress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  const selectedCoordinates = useMemo(() => {
    if (
      !selectedDeliveryAddress ||
      typeof selectedDeliveryAddress.lat !== "number" ||
      typeof selectedDeliveryAddress.lng !== "number" ||
      !Number.isFinite(selectedDeliveryAddress.lat) ||
      !Number.isFinite(selectedDeliveryAddress.lng)
    ) {
      return null;
    }
    return {
      latitude: selectedDeliveryAddress.lat,
      longitude: selectedDeliveryAddress.lng,
    };
  }, [selectedDeliveryAddress]);

  const saveDeliveryAddress = async (
    nextAddress: string,
    coords: Coordinates,
    label = "Current location",
  ) => {
    setAddressSaving(true);
    try {
      const profile = await fetchMyCustomerProfile();
      const existing = profile?.addresses ?? [];
      const nextAddresses: CustomerAddress[] = [
        {
          label,
          address: nextAddress,
          lat: coords.latitude,
          lng: coords.longitude,
          isDefault: true,
        },
        ...existing
          .map((entry) => ({
            ...entry,
            isDefault: false,
          }))
          .filter(
            (entry) =>
              !(
                entry.address === nextAddress &&
                entry.lat === coords.latitude &&
                entry.lng === coords.longitude
              ),
          ),
      ];
      const updated = await patchMyCustomerProfile({ addresses: nextAddresses });
      const addresses = updated.addresses ?? [];
      setSelectedDeliveryAddress(
        addresses.find((entry) => entry.isDefault) ?? addresses[0] ?? null,
      );
      toast.success("Delivery location saved.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save delivery location.",
      );
      throw e;
    } finally {
      setAddressSaving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
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
      await saveDeliveryAddress(nextAddress, { latitude: lat, longitude: lng });
    } catch {
      // toast handled upstream
    }
  };

  const handleMapConfirm = async (location: Coordinates) => {
    const resolved = await reverseGeocodeCoordinates(
      location.latitude,
      location.longitude,
    );
    const nextAddress =
      resolved?.formattedAddress ??
      `Pinned: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    await saveDeliveryAddress(nextAddress, location, "Map pin");
  };

  useEffect(() => {
    let cancelled = false;
    if (!activeCart || !selectedCoordinates || addressSaving) {
      setPricingPreview(null);
      return;
    }
    void (async () => {
      try {
        const estimate = await estimateCheckoutOrder({ cartId: activeCart.id });
        if (cancelled) return;
        setPricingPreview({
          routeDistanceKm: estimate.routeDistanceKm,
          deliveryFee: estimate.deliveryFee,
          serviceCharge: estimate.serviceCharge,
          totalAmount: estimate.totalAmount,
        });
      } catch {
        if (!cancelled) setPricingPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCart, selectedCoordinates, addressSaving]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  const onIncrement = async (itemId: string, quantity: number) => {
    if (!activeCart) return;
    try {
      await changeItemQuantity(activeCart.id, itemId, quantity + 1);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update item quantity.",
      );
    }
  };

  const onDecrement = async (itemId: string, quantity: number) => {
    if (!activeCart) return;
    try {
      if (quantity <= 1) {
        await removeItem(activeCart.id, itemId);
        toast.success("Item removed from cart.");
        return;
      }
      await changeItemQuantity(activeCart.id, itemId, quantity - 1);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update item quantity.",
      );
    }
  };

  const onRemove = async (itemId: string) => {
    if (!activeCart) return;
    try {
      await removeItem(activeCart.id, itemId);
      toast.success("Item removed from cart.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not remove item.",
      );
    }
  };

  const onPlaceOrder = async () => {
    if (!activeCart) return;
    if (!selectedCoordinates) {
      toast.error(
        "Please choose a delivery location first (current location or map pin).",
      );
      return;
    }

    try {
      const result = await placeOrder({
        cartId: activeCart.id,
        paymentMethod: selectedPaymentMethod,
      });

      if (selectedPaymentMethod === "telebirr") {
        if (!result.payment?.checkoutUrl) {
          throw new Error("Telebirr checkout URL is missing.");
        }
        window.location.href = result.payment.checkoutUrl;
        return;
      }

      toast.success("Order placed successfully.");
      router.push(
        `/payment-status?status=success&method=${selectedPaymentMethod}&order_id=${encodeURIComponent(
          result.checkout.order.id,
        )}`,
      );
      await loadPrimaryActiveCart();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not place your order.",
      );
    }
  };

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

      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[32px] leading-none font-semibold text-gray-900">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Review your items and adjust quantity before placing order.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
        >
          <Link href="/menu">Add more items</Link>
        </Button>
      </section>

      {cartLoading ? (
        <CheckoutSkeleton />
      ) : !activeCart || cartItemsView.length === 0 ? (
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-full bg-orange-50 p-4">
              <ShoppingCart className="size-7 text-orange-500" />
            </div>
            <p className="text-lg font-semibold text-gray-800">
              Your cart is empty
            </p>
            <p className="max-w-sm text-sm text-gray-500">
              Browse menu and add your favorite meals to start checkout.
            </p>
            <Button
              type="button"
              className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              onClick={() => router.push("/menu")}
            >
              Explore menu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="rounded-2xl border-none bg-card shadow-md">
            <CardHeader>
              <CardTitle className="text-gray-800">Your order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cartItemsView.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl bg-orange-50 p-3"
                >
                  <div className="size-16 overflow-hidden rounded-xl bg-orange-100">
                    {catalogItemImageUrl(item.itemImagePath) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={catalogItemImageUrl(item.itemImagePath) ?? ""}
                        alt={item.itemName}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-800">
                      {item.itemName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatBirr(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white px-1 py-1 shadow-sm">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-full text-orange-600 hover:bg-orange-50"
                      onClick={() => void onDecrement(item.id, item.quantity)}
                      disabled={isUpdatingItem(item.id)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="min-w-6 text-center text-sm font-semibold text-gray-700">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-full text-orange-600 hover:bg-orange-50"
                      onClick={() => void onIncrement(item.id, item.quantity)}
                      disabled={isUpdatingItem(item.id)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 rounded-full text-red-500 hover:bg-red-50"
                    onClick={() => void onRemove(item.id)}
                    disabled={isUpdatingItem(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none bg-card shadow-md">
            <CardHeader>
              <CardTitle className="text-gray-800">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-orange-50 p-3">
                <p className="text-sm font-semibold text-gray-800">
                  Delivery location
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {selectedDeliveryAddress?.address ??
                    "No location selected yet."}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {selectedCoordinates
                    ? `${selectedCoordinates.latitude.toFixed(6)}, ${selectedCoordinates.longitude.toFixed(6)}`
                    : "Coordinates missing"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-orange-200 bg-white text-orange-600 hover:bg-orange-100"
                    onClick={() => void handleUseCurrentLocation()}
                    disabled={addressSaving || loadingLiveAddress}
                  >
                    {addressSaving ? "Saving..." : "Use current location"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-orange-200 bg-white text-orange-600 hover:bg-orange-100"
                    onClick={() => setMapPickerOpen(true)}
                    disabled={addressSaving}
                  >
                    Pick on map
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Items</span>
                <span className="font-medium text-gray-800">
                  {activeCartSummary?.totalQuantity ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-800">
                  {formatBirr(activeCartSummary?.subtotal ?? "0")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Distance</span>
                <span className="font-medium text-gray-800">
                  {pricingPreview?.routeDistanceKm
                    ? `${Number(pricingPreview.routeDistanceKm).toFixed(2)} km`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Delivery fee</span>
                <span className="font-medium text-gray-800">
                  {pricingPreview
                    ? formatBirr(pricingPreview.deliveryFee)
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Service charge</span>
                <span className="font-medium text-gray-800">
                  {pricingPreview
                    ? formatBirr(pricingPreview.serviceCharge)
                    : formatBirr(50)}
                </span>
              </div>
              <div className="border-t border-orange-100 pt-3">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-orange-500">
                    {pricingPreview
                      ? formatBirr(pricingPreview.totalAmount)
                      : formatBirr(activeCartSummary?.subtotal ?? "0")}
                  </span>
                </div>
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-800">
                    Payment method
                  </p>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selectedPaymentMethod === "cash"
                          ? "border-orange-400 bg-orange-50 shadow-sm"
                          : "border-orange-100 bg-white hover:border-orange-300"
                      }`}
                      onClick={() => setSelectedPaymentMethod("cash")}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          Cash on Delivery
                        </p>
                        {selectedPaymentMethod === "cash" ? (
                          <Badge className="bg-orange-500 text-white">
                            Selected
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Pay in cash when your order arrives.
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selectedPaymentMethod === "telebirr"
                          ? "border-orange-400 bg-orange-50 shadow-sm"
                          : "border-orange-100 bg-white hover:border-orange-300"
                      }`}
                      onClick={() => setSelectedPaymentMethod("telebirr")}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          Telebirr
                        </p>
                        {selectedPaymentMethod === "telebirr" ? (
                          <Badge className="bg-orange-500 text-white">
                            Selected
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Continue to secure Telebirr payment checkout.
                      </p>
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                  onClick={() => void onPlaceOrder()}
                  disabled={checkoutLoading || addressSaving || !selectedCoordinates}
                >
                  {checkoutLoading ? "Placing order..." : "Place order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      <CustomerMapLocationPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLatitude={selectedCoordinates?.latitude ?? null}
        initialLongitude={selectedCoordinates?.longitude ?? null}
        onConfirm={(location) => {
          void handleMapConfirm(location);
        }}
      />
    </main>
  );
}
