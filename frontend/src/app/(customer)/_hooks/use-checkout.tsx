"use client";

import { useCallback, useMemo, useState } from "react";
import { authFetch, readAuthJson } from "@/lib/auth-api";

export type CheckoutPaymentMethod = "cash" | "telebirr";

type CheckoutOrderResponse = {
  order: {
    id: string;
    customerId: string;
    businessId: string;
    driverId: string | null;
    orderType: "food" | "package" | "shop";
    status: string;
    totalPrice: string;
    deliveryFee: string;
    createdAt: string;
  };
  payment: {
    paymentId: string;
    orderId: string;
    amount: string;
    method: CheckoutPaymentMethod;
    status: string;
    transactionId: string | null;
    createdAt: string;
  };
  orderItemsCount: number;
  assignedDriverId: string | null;
};

type InitializeTelebirrResponse = {
  orderId: string;
  paymentId: string;
  checkoutUrl: string;
  txRef: string;
};

export async function createCheckoutOrder(input: {
  cartId: string;
  paymentMethod: CheckoutPaymentMethod;
}): Promise<CheckoutOrderResponse> {
  const response = await authFetch("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readAuthJson<CheckoutOrderResponse>(response);
}

export async function initializeTelebirrPayment(
  orderId: string,
): Promise<InitializeTelebirrResponse> {
  const response = await authFetch("/payments/telebirr/initialize", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
  return readAuthJson<InitializeTelebirrResponse>(response);
}

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeOrder = useCallback(
    async (input: { cartId: string; paymentMethod: CheckoutPaymentMethod }) => {
      setLoading(true);
      setError(null);
      try {
        const checkout = await createCheckoutOrder(input);
        if (input.paymentMethod === "telebirr") {
          const payment = await initializeTelebirrPayment(checkout.order.id);
          return { checkout, payment };
        }
        return { checkout, payment: null };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not place order.";
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return useMemo(
    () => ({
      loading,
      error,
      placeOrder,
    }),
    [error, loading, placeOrder],
  );
}
