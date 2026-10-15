'use client';

import { useCallback, useMemo, useState } from 'react';
import { authFetch, readAuthJson } from '@/lib/auth-api';

export type CheckoutPaymentMethod = 'cash' | 'telebirr';

type CheckoutOrderResponse = {
  order: {
    id: string;
    customerId: string;
    businessId: string | null;
    driverId: string | null;
    orderType: 'food' | 'package' | 'shop';
    status: string;
    totalPrice: string;
    deliveryFee: string;
    serviceCharge: string;
    packageNote: string | null;
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
  const response = await authFetch('/orders/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return readAuthJson<CheckoutOrderResponse>(response);
}

export async function createPackageDeliveryOrder(input: {
  paymentMethod: CheckoutPaymentMethod;
  packageNote?: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
}): Promise<CheckoutOrderResponse> {
  const response = await authFetch('/orders/package', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return readAuthJson<CheckoutOrderResponse>(response);
}

export type CheckoutEstimate = {
  subtotal: string;
  routeDistanceKm: string;
  deliveryFee: string;
  serviceCharge: string;
  totalAmount: string;
};

export async function estimateCheckoutOrder(input: {
  cartId: string;
}): Promise<CheckoutEstimate> {
  const response = await authFetch('/orders/checkout/estimate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return readAuthJson<CheckoutEstimate>(response);
}

export async function initializeTelebirrPayment(
  orderId: string,
): Promise<InitializeTelebirrResponse> {
  const response = await authFetch('/payments/telebirr/initialize', {
    method: 'POST',
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
        if (input.paymentMethod === 'telebirr') {
          const payment = await initializeTelebirrPayment(checkout.order.id);
          return { checkout, payment };
        }
        return { checkout, payment: null };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not place order.';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const placePackageOrder = useCallback(
    async (input: {
      paymentMethod: CheckoutPaymentMethod;
      packageNote?: string;
      pickup: { address: string; lat: number; lng: number };
      dropoff: { address: string; lat: number; lng: number };
    }) => {
      setLoading(true);
      setError(null);
      try {
        const checkout = await createPackageDeliveryOrder(input);
        if (input.paymentMethod === 'telebirr') {
          const payment = await initializeTelebirrPayment(checkout.order.id);
          return { checkout, payment };
        }
        return { checkout, payment: null };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not place package order.';
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
      placePackageOrder,
    }),
    [error, loading, placeOrder, placePackageOrder],
  );
}
