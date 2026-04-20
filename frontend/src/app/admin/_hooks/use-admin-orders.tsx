"use client";

import { useCallback, useState } from "react";
import {
  authFetch,
  AuthApiError,
  readAuthJson,
} from "@/lib/auth-api";
import type { User } from "@/app/admin/_hooks/use-users";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type OrderCore = {
  id: string;
  customerId: string;
  driverId: string | null;
  businessId: string;
  orderType: string;
  status: OrderStatus;
  totalPrice: string;
  deliveryFee: string;
  routeDistanceKm: string | null;
  createdAt: string;
};

export type AdminOrderRow = OrderCore & {
  payment: {
    paymentId: string;
    orderId: string;
    amount: string;
    method: string;
    status: string;
    transactionId: string | null;
    createdAt: string;
  } | null;
  business: { name: string; address: string | null } | null;
  customer: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
  } | null;
  driver: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
    isAvailable: boolean | null;
    rating: string | null;
    vehicleType: string | null;
  } | null;
};

export type AdminOrderItemRow = {
  id: string;
  orderId: string;
  categoryItemId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

export type AdminOrderDetail = {
  order: OrderCore;
  items: AdminOrderItemRow[];
  payment: AdminOrderRow["payment"];
  business: AdminOrderRow["business"];
  customer: AdminOrderRow["customer"];
  driver: AdminOrderRow["driver"];
};

type AdminOrdersListResponse = {
  orders: AdminOrderRow[];
  limit: number;
  offset: number;
};

export async function fetchAdminOrders(
  params: { limit?: number; offset?: number } = {},
): Promise<AdminOrdersListResponse> {
  const limit = params.limit ?? 80;
  const offset = params.offset ?? 0;
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await authFetch(`/orders/admin?${q.toString()}`);
  return readAuthJson<AdminOrdersListResponse>(res);
}

export async function fetchAdminOrderById(
  id: string,
): Promise<AdminOrderDetail> {
  const res = await authFetch(
    `/orders/admin/${encodeURIComponent(id)}`,
  );
  return readAuthJson<AdminOrderDetail>(res);
}

export type PatchAdminOrderInput = {
  items?: Array<{ categoryItemId: string; quantity: number }>;
  driverId?: string | null;
};

export async function patchAdminOrder(
  id: string,
  body: PatchAdminOrderInput,
): Promise<AdminOrderDetail> {
  const res = await authFetch(
    `/orders/admin/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  return readAuthJson<AdminOrderDetail>(res);
}

export async function fetchAvailableDrivers(): Promise<User[]> {
  const q = new URLSearchParams({
    role: "driver",
    driverAvailable: "true",
    limit: "200",
    offset: "0",
  });
  const res = await authFetch(`/users?${q.toString()}`);
  const data = await readAuthJson<{ users: User[] }>(res);
  return data.users;
}

export function useAdminOrders() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOrders({ limit: 100, offset: 0 });
      setOrders(data.orders);
    } catch (e) {
      const msg =
        e instanceof AuthApiError ? e.message : "Failed to load orders.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, error, refetch };
}
