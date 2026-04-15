"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  type CheckoutPaymentMethod,
  useCheckout,
} from "../_hooks/use-checkout";
import { useLiveAddress } from "../_hooks/use-live-address";

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
  const { placeOrder, loading: checkoutLoading } = useCheckout();
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<CheckoutPaymentMethod>("cash");

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
  const { liveAddress, loading: loadingLiveAddress } = useLiveAddress();
  const profileAddress =
    (user as { address?: string } | null)?.address?.trim() || "";
  const userAddress = loadingLiveAddress
    ? "Detecting location..."
    : liveAddress || profileAddress || "Purwokerto Selatan";

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

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
              <div className="border-t border-orange-100 pt-3">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-orange-500">
                    {formatBirr(activeCartSummary?.subtotal ?? "0")}
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
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? "Placing order..." : "Place order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}
