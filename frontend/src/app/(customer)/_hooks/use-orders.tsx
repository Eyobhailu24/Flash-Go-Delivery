"use client";

import { useCallback, useMemo, useState } from "react";
import { authFetch, readAuthJson } from "@/lib/auth-api";

type OrderStatus =
  | "pending"
  | "pending_confirmation"
  | "awaiting_business"
  | "business_approved"
  | "accepted"
  | "in_transit"
  | "delivered"
  | "cancelled";

type PaymentSummary = {
  paymentId: string;
  orderId: string;
  amount: string;
  method: "cash" | "telebirr" | "card" | "wallet" | "transfer";
  status: "pending" | "paid" | "failed" | "refunded";
  transactionId: string | null;
  createdAt: string;
};

type DriverSummary = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  isAvailable: boolean | null;
  rating: number | null;
  vehicleType: string | null;
};

type BusinessSummary = {
  name: string;
  address: string | null;
};

type DriverFeedbackSummary = {
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type CustomerOrderTracking = {
  orderId: string;
  status: OrderStatus;
  orderType: "food" | "package" | "shop";
  cancelExpiresAt?: string | null;
  canCancel?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canAdminCancel?: boolean;
  pickup: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  destination: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  driver: {
    id: string;
    fullName: string;
    location: {
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
    } | null;
    locationUpdatedAt: string | null;
  } | null;
  payment: PaymentSummary | null;
};

export type CustomerOrder = {
  id: string;
  customerId: string;
  driverId: string | null;
  businessId: string | null;
  orderType: "food" | "package" | "shop";
  status: OrderStatus;
  totalPrice: string;
  deliveryFee: string;
  serviceCharge: string;
  routeDistanceKm: string | null;
  packageNote: string | null;
  pickupAddress: string | null;
  pickupLat: string | null;
  pickupLng: string | null;
  dropoffAddress: string | null;
  dropoffLat: string | null;
  dropoffLng: string | null;
  cancelExpiresAt?: string | null;
  businessRejectionNote?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  canCancel?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canAdminCancel?: boolean;
  createdAt: string;
  payment: PaymentSummary | null;
  business: BusinessSummary | null;
  driver: DriverSummary | null;
};

export type CustomerOrderDetail = {
  order: CustomerOrder;
  items: Array<{
    id: string;
    orderId: string;
    categoryItemId: string | null;
    productName: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }>;
  payment: PaymentSummary | null;
  business: BusinessSummary | null;
  driver: DriverSummary | null;
  driverFeedback: DriverFeedbackSummary | null;
};

type SubmitDriverFeedbackInput = {
  orderId: string;
  rating: number;
  comment?: string;
};

async function fetchMyOrders(): Promise<CustomerOrder[]> {
  const response = await authFetch("/orders/my");
  const data = await readAuthJson<{ orders: CustomerOrder[] }>(response);
  return data.orders;
}

async function fetchMyOrderById(orderId: string): Promise<CustomerOrderDetail> {
  const response = await authFetch(`/orders/${encodeURIComponent(orderId)}`);
  return readAuthJson<CustomerOrderDetail>(response);
}

async function fetchMyOrderTracking(orderId: string): Promise<CustomerOrderTracking> {
  const response = await authFetch(
    `/orders/${encodeURIComponent(orderId)}/tracking`,
  );
  return readAuthJson<CustomerOrderTracking>(response);
}

async function postDriverFeedback(
  input: SubmitDriverFeedbackInput,
): Promise<{
  feedback: DriverFeedbackSummary;
  driverAverageRating: number;
}> {
  const response = await authFetch(`/orders/${encodeURIComponent(input.orderId)}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      rating: input.rating,
      comment: input.comment,
    }),
  });
  return readAuthJson<{
    feedback: DriverFeedbackSummary;
    driverAverageRating: number;
  }>(response);
}

async function postCancelMyOrder(orderId: string): Promise<{
  order: CustomerOrder;
  message: string;
}> {
  const response = await authFetch(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: "POST" },
  );
  return readAuthJson<{ order: CustomerOrder; message: string }>(response);
}

export function useOrders() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetail | null>(
    null,
  );
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [tracking, setTracking] = useState<CustomerOrderTracking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError(null);
    try {
      const list = await fetchMyOrders();
      setOrders(list);
      return list;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not load your orders.";
      setError(message);
      throw e;
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadOrderTracking = useCallback(async (orderId: string) => {
    setLoadingTracking(true);
    try {
      const data = await fetchMyOrderTracking(orderId);
      setTracking(data);
      setSelectedOrder((prev) => {
        if (!prev || prev.order.id !== orderId) return prev;
        return {
          ...prev,
          order: {
            ...prev.order,
            status: data.status,
            cancelExpiresAt: data.cancelExpiresAt ?? prev.order.cancelExpiresAt,
            canCancel: data.canCancel ?? prev.order.canCancel,
          },
          payment: data.payment ?? prev.payment,
        };
      });
      return data;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not load live tracking.";
      setError(message);
      throw e;
    } finally {
      setLoadingTracking(false);
    }
  }, []);

  const loadOrderById = useCallback(
    async (orderId: string, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoadingDetail(true);
        setError(null);
      }
      try {
        const detail = await fetchMyOrderById(orderId);
        setSelectedOrder(detail);
        return detail;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not load order details.";
        if (!options?.silent) {
          setError(message);
        }
        throw e;
      } finally {
        if (!options?.silent) {
          setLoadingDetail(false);
        }
      }
    },
    [],
  );

  const cancelOrder = useCallback(async (orderId: string) => {
    const result = await postCancelMyOrder(orderId);
    setSelectedOrder((prev) => {
      if (!prev || prev.order.id !== orderId) return prev;
      return {
        ...prev,
        order: {
          ...prev.order,
          ...result.order,
          payment: prev.order.payment,
          business: prev.order.business,
          driver: prev.order.driver,
        },
      };
    });
    setTracking((prev) => {
      if (!prev || prev.orderId !== orderId) return prev;
      return {
        ...prev,
        status: result.order.status,
        canCancel: false,
      };
    });
    setOrders((prev) =>
      prev.map((row) =>
        row.id === orderId
          ? {
              ...row,
              ...result.order,
              payment: row.payment,
              business: row.business,
              driver: row.driver,
            }
          : row,
      ),
    );
    return result;
  }, []);

  const submitDriverFeedback = useCallback(
    async (input: SubmitDriverFeedbackInput) => {
      const result = await postDriverFeedback(input);
      setSelectedOrder((prev) => {
        if (!prev || prev.order.id !== input.orderId) return prev;
        return {
          ...prev,
          driverFeedback: result.feedback,
          driver: prev.driver
            ? {
                ...prev.driver,
                rating: result.driverAverageRating,
              }
            : prev.driver,
        };
      });
      return result;
    },
    [],
  );

  return useMemo(
    () => ({
      orders,
      selectedOrder,
      tracking,
      loadingOrders,
      loadingDetail,
      loadingTracking,
      error,
      loadOrders,
      loadOrderById,
      loadOrderTracking,
      cancelOrder,
      submitDriverFeedback,
      setSelectedOrder,
      setTracking,
    }),
    [
      cancelOrder,
      error,
      loadOrderById,
      loadOrderTracking,
      loadOrders,
      submitDriverFeedback,
      loadingDetail,
      loadingTracking,
      loadingOrders,
      orders,
      selectedOrder,
      tracking,
    ],
  );
}
