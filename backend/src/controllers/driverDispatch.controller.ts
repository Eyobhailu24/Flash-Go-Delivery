import { and, asc, eq, or } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db.js";
import type { AuthUser } from "../middleware/auth.middleware.js";
import {
  businessProfile,
  customerProfile,
  driverProfile,
  notifications,
  orderDriverOffers,
  orderItems,
  orders,
  driverLocations,
} from "../schema.js";

type DriverEnv = { Variables: { user: AuthUser } };

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

const offerParamSchema = z.object({
  offerId: z.string().uuid(),
});

async function promoteNextOffer(orderId: string): Promise<void> {
  const now = new Date();
  const currentPending = await db
    .select()
    .from(orderDriverOffers)
    .where(
      and(
        eq(orderDriverOffers.orderId, orderId),
        eq(orderDriverOffers.status, "pending"),
      ),
    )
    .limit(1);
  if (currentPending.length > 0) return;

  const nextQueued = await db
    .select()
    .from(orderDriverOffers)
    .where(
      and(
        eq(orderDriverOffers.orderId, orderId),
        eq(orderDriverOffers.status, "queued"),
      ),
    )
    .orderBy(asc(orderDriverOffers.rank))
    .limit(1);
  const next = nextQueued[0];
  if (!next) return;

  const expiresAt = new Date(now.getTime() + 30_000);
  await db
    .update(orderDriverOffers)
    .set({
      status: "pending",
      offeredAt: now,
      expiresAt,
    })
    .where(eq(orderDriverOffers.id, next.id));

  await db.insert(notifications).values({
    userId: next.driverId,
    type: "order_incoming",
    title: "Order incoming",
    message: "A nearby order is available. Accept or reject quickly.",
  });
}

async function expireStaleOffersForDriver(driverId: string): Promise<void> {
  const now = new Date();
  const stale = await db
    .select({ id: orderDriverOffers.id, orderId: orderDriverOffers.orderId })
    .from(orderDriverOffers)
    .where(
      and(
        eq(orderDriverOffers.driverId, driverId),
        eq(orderDriverOffers.status, "pending"),
      ),
    );

  for (const offer of stale) {
    const offerRow = await db
      .select()
      .from(orderDriverOffers)
      .where(eq(orderDriverOffers.id, offer.id))
      .limit(1);
    const current = offerRow[0];
    if (!current) continue;
    if (current.expiresAt && current.expiresAt > now) continue;
    await db
      .update(orderDriverOffers)
      .set({
        status: "expired",
        respondedAt: now,
      })
      .where(eq(orderDriverOffers.id, current.id));
    await promoteNextOffer(current.orderId);
  }
}

export const upsertDriverLocation = async (c: Context<DriverEnv>) => {
  const parsed = updateLocationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const driverId = c.var.user.id;
  const now = new Date();
  const location = {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    heading: parsed.data.heading,
    speed: parsed.data.speed,
  };

  const existing = await db
    .select({ driverId: driverLocations.driverId })
    .from(driverLocations)
    .where(eq(driverLocations.driverId, driverId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(driverLocations)
      .set({ location, updatedAt: now })
      .where(eq(driverLocations.driverId, driverId))
      .returning();
    return c.json({ location: updated });
  }

  const [created] = await db
    .insert(driverLocations)
    .values({
      driverId,
      location,
      updatedAt: now,
    })
    .returning();
  return c.json({ location: created }, 201);
};

export const getCurrentDriverOffer = async (c: Context<DriverEnv>) => {
  const driverId = c.var.user.id;
  await expireStaleOffersForDriver(driverId);

  const pendingRows = await db
    .select()
    .from(orderDriverOffers)
    .where(
      and(
        eq(orderDriverOffers.driverId, driverId),
        eq(orderDriverOffers.status, "pending"),
      ),
    )
    .orderBy(asc(orderDriverOffers.rank))
    .limit(1);
  const offer = pendingRows[0];
  if (!offer) {
    return c.json({ offer: null });
  }

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, offer.orderId))
    .limit(1);
  const order = orderRows[0];
  if (!order || order.driverId) {
    return c.json({ offer: null });
  }

  const [businessRows, customerRows, itemRows] = await Promise.all([
    order.businessId
      ? db
          .select({
            userId: businessProfile.userId,
            businessName: businessProfile.businessName,
            address: businessProfile.address,
          })
          .from(businessProfile)
          .where(eq(businessProfile.userId, order.businessId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        userId: customerProfile.userId,
        addresses: customerProfile.addresses,
      })
      .from(customerProfile)
      .where(eq(customerProfile.userId, order.customerId))
      .limit(1),
    db
      .select({
        orderId: orderItems.orderId,
        productName: orderItems.productName,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, offer.orderId)),
  ]);
  const business = businessRows[0] ?? null;
  const customer = customerRows[0] ?? null;
  const defaultCustomerAddress =
    customer?.addresses?.find((entry) => entry.isDefault)?.address ??
    customer?.addresses?.[0]?.address ??
    "Customer address";
  const customerAddress =
    order.orderType === "package"
      ? (order.dropoffAddress ?? defaultCustomerAddress)
      : defaultCustomerAddress;

  return c.json({
    offer: {
      id: offer.id,
      orderId: offer.orderId,
      expiresAt: offer.expiresAt,
      distanceToBusinessKm: offer.distanceToBusinessKm,
      order: {
        id: order.id,
        totalPrice: order.totalPrice,
        deliveryFee: order.deliveryFee,
        routeDistanceKm: order.routeDistanceKm,
        status: order.status,
        createdAt: order.createdAt,
      },
      business: business
        ? {
            name: business.businessName,
            address: business.address,
          }
        : null,
      customer: {
        address: customerAddress,
      },
      pickup: order.pickupAddress
        ? {
            address: order.pickupAddress,
          }
        : null,
      items: itemRows,
    },
  });
};

export const acceptDriverOffer = async (c: Context<DriverEnv>) => {
  const params = offerParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid offer id." }, 400);
  }
  const driverId = c.var.user.id;
  const now = new Date();

  const offerRows = await db
    .select()
    .from(orderDriverOffers)
    .where(eq(orderDriverOffers.id, params.data.offerId))
    .limit(1);
  const offer = offerRows[0];
  if (!offer || offer.driverId !== driverId) {
    return c.json({ message: "Offer not found." }, 404);
  }
  if (offer.status !== "pending") {
    return c.json({ message: "Offer is no longer pending." }, 409);
  }
  if (offer.expiresAt && offer.expiresAt < now) {
    await db
      .update(orderDriverOffers)
      .set({ status: "expired", respondedAt: now })
      .where(eq(orderDriverOffers.id, offer.id));
    await promoteNextOffer(offer.orderId);
    return c.json({ message: "Offer expired." }, 409);
  }

  const acceptedOrder = await db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, offer.orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) return null;
    if (order.driverId) {
      return { alreadyAssigned: true as const };
    }

    const [updatedOrder] = await tx
      .update(orders)
      .set({
        driverId,
        status: "accepted",
      })
      .where(eq(orders.id, order.id))
      .returning();

    await tx
      .update(orderDriverOffers)
      .set({
        status: "accepted",
        respondedAt: now,
      })
      .where(eq(orderDriverOffers.id, offer.id));

    await tx
      .update(orderDriverOffers)
      .set({
        status: "cancelled",
        respondedAt: now,
      })
      .where(
        and(
          eq(orderDriverOffers.orderId, order.id),
          or(
            eq(orderDriverOffers.status, "queued"),
            eq(orderDriverOffers.status, "pending"),
          ),
        ),
      );

    await tx
      .update(driverProfile)
      .set({ isAvailable: false })
      .where(eq(driverProfile.userId, driverId));

    return updatedOrder;
  });

  if (!acceptedOrder) {
    return c.json({ message: "Order not found." }, 404);
  }
  if ("alreadyAssigned" in acceptedOrder) {
    return c.json({ message: "Order already assigned." }, 409);
  }
  return c.json({ order: acceptedOrder });
};

export const rejectDriverOffer = async (c: Context<DriverEnv>) => {
  const params = offerParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid offer id." }, 400);
  }
  const driverId = c.var.user.id;
  const now = new Date();

  const offerRows = await db
    .select()
    .from(orderDriverOffers)
    .where(eq(orderDriverOffers.id, params.data.offerId))
    .limit(1);
  const offer = offerRows[0];
  if (!offer || offer.driverId !== driverId) {
    return c.json({ message: "Offer not found." }, 404);
  }
  if (offer.status !== "pending") {
    return c.json({ message: "Offer is no longer pending." }, 409);
  }

  await db
    .update(orderDriverOffers)
    .set({
      status: "rejected",
      respondedAt: now,
    })
    .where(eq(orderDriverOffers.id, offer.id));

  await promoteNextOffer(offer.orderId);
  return c.json({ ok: true });
};

export const getCurrentAssignedOrder = async (c: Context<DriverEnv>) => {
  const driverId = c.var.user.id;
  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        or(eq(orders.status, "accepted"), eq(orders.status, "in_transit")),
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(1);
  const order = orderRows[0];
  if (!order) {
    return c.json({ order: null });
  }

  const [businessRows, customerRows, itemRows] = await Promise.all([
    order.businessId
      ? db
          .select({
            userId: businessProfile.userId,
            businessName: businessProfile.businessName,
            address: businessProfile.address,
          })
          .from(businessProfile)
          .where(eq(businessProfile.userId, order.businessId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        userId: customerProfile.userId,
        addresses: customerProfile.addresses,
      })
      .from(customerProfile)
      .where(eq(customerProfile.userId, order.customerId))
      .limit(1),
    db
      .select({
        orderId: orderItems.orderId,
        productName: orderItems.productName,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
  ]);

  const business = businessRows[0] ?? null;
  const customer = customerRows[0] ?? null;
  const defaultCustomerAddress =
    customer?.addresses?.find((entry) => entry.isDefault)?.address ??
    customer?.addresses?.[0]?.address ??
    "Customer address";
  const customerAddress =
    order.orderType === "package"
      ? (order.dropoffAddress ?? defaultCustomerAddress)
      : defaultCustomerAddress;

  return c.json({
    order: {
      id: order.id,
      totalPrice: order.totalPrice,
      deliveryFee: order.deliveryFee,
      routeDistanceKm: order.routeDistanceKm,
      status: order.status,
      createdAt: order.createdAt,
      business: business
        ? {
            name: business.businessName,
            address: business.address,
          }
        : null,
      customer: {
        address: customerAddress,
      },
      pickup: order.pickupAddress
        ? {
            address: order.pickupAddress,
          }
        : null,
      items: itemRows,
    },
  });
};

const orderParamSchema = z.object({
  orderId: z.string().uuid(),
});

export const startDriverTrip = async (c: Context<DriverEnv>) => {
  const params = orderParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }
  const driverId = c.var.user.id;

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, params.data.orderId), eq(orders.driverId, driverId)),
    )
    .limit(1);
  const order = orderRows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (order.status !== "accepted") {
    return c.json(
      { message: "Only accepted orders can be moved to in transit." },
      409,
    );
  }

  const [updated] = await db
    .update(orders)
    .set({ status: "in_transit" })
    .where(eq(orders.id, order.id))
    .returning();
  return c.json({ order: updated });
};

export const markDriverOrderDelivered = async (c: Context<DriverEnv>) => {
  const params = orderParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }
  const driverId = c.var.user.id;

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, params.data.orderId), eq(orders.driverId, driverId)),
    )
    .limit(1);
  const order = orderRows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (order.status !== "in_transit") {
    return c.json(
      { message: "Only in transit orders can be marked delivered." },
      409,
    );
  }

  const [updated] = await db
    .update(orders)
    .set({ status: "delivered" })
    .where(eq(orders.id, order.id))
    .returning();

  await db
    .update(driverProfile)
    .set({ isAvailable: true })
    .where(eq(driverProfile.userId, driverId));

  return c.json({ order: updated });
};
