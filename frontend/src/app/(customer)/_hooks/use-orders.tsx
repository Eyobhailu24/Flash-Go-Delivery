"use client";

import { useCallback, useMemo, useState } from "react";
import { authFetch, readAuthJson } from "@/lib/auth-api";

type OrderStatus =
  | "pending"
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

export type CustomerOrder = {
  id: string;
  customerId: string;
  driverId: string | null;
  businessId: string;
  orderType: "food" | "package" | "shop";
  status: OrderStatus;
  totalPrice: string;
  deliveryFee: string;
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

export function useOrders() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetail | null>(
    null,
  );
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
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

  const loadOrderById = useCallback(async (orderId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchMyOrderById(orderId);
      setSelectedOrder(detail);
      return detail;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not load order details.";
      setError(message);
      throw e;
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  return useMemo(
    () => ({
      orders,
      selectedOrder,
      loadingOrders,
      loadingDetail,
      error,
      loadOrders,
      loadOrderById,
      setSelectedOrder,
    }),
    [
      error,
      loadOrderById,
      loadOrders,
      loadingDetail,
      loadingOrders,
      orders,
      selectedOrder,
    ],
  );
}
