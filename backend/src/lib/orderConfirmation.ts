import { and, eq, lte, or } from "drizzle-orm";
import { db } from "../db.js";
import {
  businessProfile,
  driverLocations,
  driverProfile,
  notifications,
  orderDriverOffers,
  orders,
  payments,
  users,
} from "../schema.js";

export const CUSTOMER_CANCEL_WINDOW_MS = 60_000;

type OrderRow = typeof orders.$inferSelect;

export function computeCancelExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + CUSTOMER_CANCEL_WINDOW_MS);
}

export function orderActionFlags(
  order: Pick<OrderRow, "status" | "cancelExpiresAt" | "businessId">,
  now: Date = new Date(),
) {
  const canCancel =
    order.status === "pending_confirmation" &&
    order.cancelExpiresAt != null &&
    order.cancelExpiresAt.getTime() > now.getTime();
  const canApproveOrReject =
    order.status === "awaiting_business" && Boolean(order.businessId);
  const canAdminCancel =
    order.status !== "delivered" && order.status !== "cancelled";
  return {
    canCancel,
    canApprove: canApproveOrReject,
    canReject: canApproveOrReject,
    canAdminCancel,
  };
}

export function withOrderActionFlags<T extends OrderRow>(
  order: T,
  now: Date = new Date(),
) {
  return {
    ...order,
    ...orderActionFlags(order, now),
  };
}

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

function rankDriversByDistanceToPoint(
  drivers: Array<{
    id: string;
    location: { lat?: number; lng?: number } | null;
  }>,
  origin: { lat: number; lng: number },
): Array<{ driverId: string; distanceToBusinessKm: number }> {
  return drivers
    .map((driver) => {
      const lat = driver.location?.lat;
      const lng = driver.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return {
        driverId: driver.id,
        distanceToBusinessKm: haversineDistanceKm({ lat, lng }, origin),
      };
    })
    .filter(
      (
        entry,
      ): entry is { driverId: string; distanceToBusinessKm: number } =>
        Boolean(entry),
    )
    .sort((a, b) => a.distanceToBusinessKm - b.distanceToBusinessKm);
}

type QueryDb = Pick<typeof db, "select" | "insert" | "update">;

export async function cancelOpenDriverOffers(
  orderId: string,
  now: Date = new Date(),
  queryDb: QueryDb = db,
): Promise<void> {
  await queryDb
    .update(orderDriverOffers)
    .set({
      status: "cancelled",
      respondedAt: now,
    })
    .where(
      and(
        eq(orderDriverOffers.orderId, orderId),
        or(
          eq(orderDriverOffers.status, "pending"),
          eq(orderDriverOffers.status, "queued"),
        ),
      ),
    );
}

export async function markOrderPaymentFailed(
  orderId: string,
  queryDb: QueryDb = db,
): Promise<void> {
  await queryDb
    .update(payments)
    .set({ status: "failed" })
    .where(
      and(eq(payments.orderId, orderId), eq(payments.status, "pending")),
    );
}

export async function releaseDriverIfAssigned(
  driverId: string | null,
  queryDb: QueryDb = db,
): Promise<void> {
  if (!driverId) return;
  await queryDb
    .update(driverProfile)
    .set({ isAvailable: true })
    .where(eq(driverProfile.userId, driverId));
}

export async function startDriverDispatchForOrder(
  orderId: string,
  queryDb: QueryDb = db,
): Promise<{ offeredDriversCount: number }> {
  const [order] = await queryDb
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || !order.businessId) {
    return { offeredDriversCount: 0 };
  }

  const [businessRow] = await queryDb
    .select({
      latitude: businessProfile.latitude,
      longitude: businessProfile.longitude,
    })
    .from(businessProfile)
    .where(eq(businessProfile.userId, order.businessId))
    .limit(1);

  const origin =
    typeof businessRow?.latitude === "number" &&
    typeof businessRow?.longitude === "number"
      ? { lat: businessRow.latitude, lng: businessRow.longitude }
      : null;
  if (!origin) {
    return { offeredDriversCount: 0 };
  }

  const driverCandidates = await queryDb
    .select({
      id: users.id,
      location: driverLocations.location,
    })
    .from(users)
    .innerJoin(driverProfile, eq(driverProfile.userId, users.id))
    .innerJoin(driverLocations, eq(driverLocations.driverId, users.id))
    .where(
      and(
        eq(users.role, "driver"),
        eq(users.status, "active"),
        eq(driverProfile.isAvailable, true),
      ),
    );

  const rankedDrivers = rankDriversByDistanceToPoint(driverCandidates, origin);
  if (rankedDrivers.length === 0) {
    return { offeredDriversCount: 0 };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30_000);
  await queryDb.insert(orderDriverOffers).values(
    rankedDrivers.map((driver, index) => ({
      orderId,
      driverId: driver.driverId,
      rank: index + 1,
      status: index === 0 ? "pending" : "queued",
      distanceToBusinessKm: driver.distanceToBusinessKm.toFixed(2),
      offeredAt: index === 0 ? now : null,
      expiresAt: index === 0 ? expiresAt : null,
    })),
  );

  await queryDb.insert(notifications).values({
    userId: rankedDrivers[0].driverId,
    type: "order_incoming",
    title: "Order incoming",
    message:
      "A new nearby delivery request is waiting for your response.",
  });

  return { offeredDriversCount: rankedDrivers.length };
}

export async function promoteDueCustomerCancelOrders(
  now: Date = new Date(),
): Promise<number> {
  const dueOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending_confirmation"),
        lte(orders.cancelExpiresAt, now),
      ),
    );

  let promoted = 0;
  for (const order of dueOrders) {
    if (!order.businessId) continue;

    const updated = await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.status, "pending_confirmation"),
          ),
        )
        .limit(1);
      if (!fresh || !fresh.businessId) return null;
      if (!fresh.cancelExpiresAt || fresh.cancelExpiresAt.getTime() > now.getTime()) {
        return null;
      }

      const shouldNotify = !fresh.businessNotifiedAt;
      const [row] = await tx
        .update(orders)
        .set({
          status: "awaiting_business",
          businessNotifiedAt: fresh.businessNotifiedAt ?? now,
        })
        .where(
          and(
            eq(orders.id, fresh.id),
            eq(orders.status, "pending_confirmation"),
          ),
        )
        .returning();

      if (!row) return null;

      if (shouldNotify) {
        const shortId = fresh.id.slice(0, 8);
        await tx.insert(notifications).values({
          userId: fresh.businessId,
          type: "order_ready_for_business",
          title: "New order to review",
          message: `Order ${shortId} is ready. Approve or reject it in your orders list.`,
        });
      }

      return row;
    });

    if (updated) promoted += 1;
  }

  return promoted;
}
