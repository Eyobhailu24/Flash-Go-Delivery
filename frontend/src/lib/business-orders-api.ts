import { authFetch, readAuthJson } from "@/lib/auth-api";
import type {
  AdminOrderDetail,
  AdminOrderRow,
} from "@/app/admin/_hooks/use-admin-orders";

type BusinessOrdersListResponse = {
  orders: AdminOrderRow[];
  limit: number;
  offset: number;
};

export async function fetchBusinessOrders(
  params: { limit?: number; offset?: number } = {},
): Promise<BusinessOrdersListResponse> {
  const limit = params.limit ?? 80;
  const offset = params.offset ?? 0;
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await authFetch(`/orders/business?${q.toString()}`);
  return readAuthJson<BusinessOrdersListResponse>(res);
}

export async function fetchBusinessOrderById(
  id: string,
): Promise<AdminOrderDetail> {
  const res = await authFetch(
    `/orders/business/${encodeURIComponent(id)}`,
  );
  return readAuthJson<AdminOrderDetail>(res);
}
