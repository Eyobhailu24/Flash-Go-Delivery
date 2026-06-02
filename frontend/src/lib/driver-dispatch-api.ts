"use client";

import { authFetch, readAuthJson } from "@/lib/auth-api";

export type DriverOffer = {
  id: string;
  orderId: string;
  expiresAt: string | null;
  distanceToBusinessKm: string | null;
  order: {
    id: string;
    totalPrice: string;
    deliveryFee: string;
    routeDistanceKm: string | null;
    status: string;
    createdAt: string;
  };
  business: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  customer: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  pickup: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  items: Array<{
    orderId: string;
    productName: string;
    quantity: number;
  }>;
};

export type DriverAssignedOrder = {
  id: string;
  totalPrice: string;
  deliveryFee: string;
  routeDistanceKm: string | null;
  status: string;
  createdAt: string;
  business: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  customer: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  pickup: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  items: Array<{
    orderId: string;
    productName: string;
    quantity: number;
  }>;
};

export async function postDriverLocation(input: {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}) {
  const res = await authFetch("/driver-dispatch/location", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readAuthJson<{ location: unknown }>(res);
}

export async function fetchCurrentDriverOffer() {
  const res = await authFetch("/driver-dispatch/offers/current");
  return readAuthJson<{ offer: DriverOffer | null }>(res);
}

export async function fetchCurrentAssignedOrder() {
  const res = await authFetch("/driver-dispatch/orders/current");
  return readAuthJson<{ order: DriverAssignedOrder | null }>(res);
}

export async function acceptDriverOffer(offerId: string) {
  const res = await authFetch(
    `/driver-dispatch/offers/${encodeURIComponent(offerId)}/accept`,
    {
      method: "POST",
    },
  );
  return readAuthJson<{ order: { id: string; status: string } }>(res);
}

export async function rejectDriverOffer(offerId: string) {
  const res = await authFetch(
    `/driver-dispatch/offers/${encodeURIComponent(offerId)}/reject`,
    {
      method: "POST",
    },
  );
  return readAuthJson<{ ok: boolean }>(res);
}

export async function startAssignedOrder(orderId: string) {
  const res = await authFetch(
    `/driver-dispatch/orders/${encodeURIComponent(orderId)}/start`,
    {
      method: "POST",
    },
  );
  return readAuthJson<{ order: { id: string; status: string } }>(res);
}

export async function deliverAssignedOrder(orderId: string, deliveryCode: string) {
  const res = await authFetch(
    `/driver-dispatch/orders/${encodeURIComponent(orderId)}/deliver`,
    {
      method: "POST",
      body: JSON.stringify({ deliveryCode }),
    },
  );
  return readAuthJson<{ order: { id: string; status: string } }>(res);
}
