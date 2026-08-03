import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import {
  cancelOpenDriverOffers,
  computeCancelExpiresAt,
  markOrderPaymentFailed,
  orderActionFlags,
  promoteDueCustomerCancelOrders,
  releaseDriverIfAssigned,
  startDriverDispatchForOrder,
  withOrderActionFlags,
} from "../lib/orderConfirmation.js";
import type { AuthUser } from "../middleware/auth.middleware.js";
import {
  categoryItems,
  businessProfile,
  cartItems,
  carts,
  customerProfile,
  driverProfile,
  driverLocations,
  feedback,
  notifications,
  orderDriverOffers,
  orderItems,
  orders,
  payments,
  productCategories,
  users,
} from "../schema.js";

type OrderEnv = { Variables: { user: AuthUser } };

const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "telebirr"]),
  orderType: z.enum(["food", "package", "shop"]).optional(),
});

const checkoutEstimateSchema = z.object({
  cartId: z.string().uuid(),
});

const packageCheckoutSchema = z.object({
  paymentMethod: z.enum(["cash", "telebirr"]),
  packageNote: z.string().trim().max(2000).optional(),
  pickup: z.object({
    address: z.string().trim().min(2).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  dropoff: z.object({
    address: z.string().trim().min(2).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

const submitDriverFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

function toMoneyNumber(value: string | null): number {
  if (value === null) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

const DEFAULT_SERVICE_CHARGE = 50;

function applyDiscountedUnitPrice(
  price: string | null,
  discount: string | null,
): string {
  const priceNum = toMoneyNumber(price ?? "0");
  const discountNum = toMoneyNumber(discount ?? null);
  return toMoneyString(Math.max(priceNum - discountNum, 0));
}

function mergeOrderLineInputs(
  items: Array<{ categoryItemId: string; quantity: number }>,
): Array<{ categoryItemId: string; quantity: number }> {
  const map = new Map<string, number>();
  for (const row of items) {
    map.set(
      row.categoryItemId,
      (map.get(row.categoryItemId) ?? 0) + row.quantity,
    );
  }
  return [...map.entries()].map(([categoryItemId, quantity]) => ({
    categoryItemId,
    quantity,
  }));
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

function computeDeliveryFee(routeDistanceKm: number): number {
  const extraKm = Math.max(0, Math.ceil(routeDistanceKm - 1));
  return 50 + extraKm * 15;
}

const deliveryCodeLength = Number(process.env.DELIVERY_CODE_LENGTH ?? 5);

function hashDeliveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateDeliveryCode(): string {
  const min = 10 ** (deliveryCodeLength - 1);
  const max = 10 ** deliveryCodeLength;
  return String(randomInt(min, max));
}

function emitDeliveryCodeOtpLog(input: {
  customerPhoneNumber: string | null;
  orderId: string;
  code: string;
}): void {
  if ((process.env.OTP_BYPASS ?? "false") === "true") {
    console.log(
      `[DELIVERY-OTP] order=${input.orderId} customer=${input.customerPhoneNumber ?? "unknown"} code=${input.code}`,
    );
  }
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
      const distanceToBusinessKm = haversineDistanceKm({ lat, lng }, origin);
      return {
        driverId: driver.id,
        distanceToBusinessKm,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        driverId: string;
        distanceToBusinessKm: number;
      } => Boolean(entry),
    )
    .sort((a, b) => a.distanceToBusinessKm - b.distanceToBusinessKm);
}

function pickCustomerAddressCoordinates(
  addresses:
    | Array<{
        label?: string;
        address: string;
        lat?: number;
        lng?: number;
        isDefault?: boolean;
      }>
    | null
    | undefined,
): { lat: number; lng: number } | null {
  if (!addresses || addresses.length === 0) return null;
  const defaultAddress = addresses.find((entry) => entry.isDefault);
  const candidate = defaultAddress ?? addresses[0];
  if (
    typeof candidate?.lat !== "number" ||
    typeof candidate?.lng !== "number" ||
    !Number.isFinite(candidate.lat) ||
    !Number.isFinite(candidate.lng)
  ) {
    return null;
  }
  return {
    lat: candidate.lat,
    lng: candidate.lng,
  };
}

function pickCustomerAddressWithCoordinates(
  addresses:
    | Array<{
        label?: string;
        address: string;
        lat?: number;
        lng?: number;
        isDefault?: boolean;
      }>
    | null
    | undefined,
): { address: string; lat: number | null; lng: number | null } | null {
  if (!addresses || addresses.length === 0) return null;
  const defaultAddress = addresses.find((entry) => entry.isDefault);
  const candidate = defaultAddress ?? addresses[0];
  return {
    address: candidate.address,
    lat:
      typeof candidate.lat === "number" && Number.isFinite(candidate.lat)
        ? candidate.lat
        : null,
    lng:
      typeof candidate.lng === "number" && Number.isFinite(candidate.lng)
        ? candidate.lng
        : null,
  };
}

async function estimateCheckoutAmounts(input: {
  customerId: string;
  cartId: string;
}): Promise<
  | { ok: false; status: 400 | 404 | 409; message: string }
  | {
      ok: true;
      cart: (typeof carts.$inferSelect) & { status: string };
      subtotal: number;
      businessCoords: { lat: number; lng: number };
      routeDistanceKm: number;
      deliveryFee: number;
      serviceCharge: number;
      totalAmount: number;
    }
> {
  const { customerId, cartId } = input;
  const cartRows = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, cartId), eq(carts.customerId, customerId)))
    .limit(1);
  const activeCart = cartRows[0];
  if (!activeCart) {
    return { ok: false, status: 404, message: "Cart not found." };
  }
  if (activeCart.status !== "active") {
    return {
      ok: false,
      status: 409,
      message: "Only active carts can be checked out.",
    };
  }

  const items = await db
    .select({
      unitPrice: cartItems.unitPrice,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, activeCart.id));
  if (items.length === 0) {
    return { ok: false, status: 400, message: "Your cart is empty." };
  }
  const subtotal = items.reduce(
    (sum, item) => sum + toMoneyNumber(item.unitPrice) * item.quantity,
    0,
  );

  const [businessRow, customerProfileRow] = await Promise.all([
    db
      .select({
        latitude: businessProfile.latitude,
        longitude: businessProfile.longitude,
      })
      .from(businessProfile)
      .where(eq(businessProfile.userId, activeCart.businessId))
      .limit(1),
    db
      .select({
        addresses: customerProfile.addresses,
      })
      .from(customerProfile)
      .where(eq(customerProfile.userId, customerId))
      .limit(1),
  ]);
  const businessCoords =
    typeof businessRow[0]?.latitude === "number" &&
    typeof businessRow[0]?.longitude === "number"
      ? { lat: businessRow[0].latitude, lng: businessRow[0].longitude }
      : null;
  const customerCoords = pickCustomerAddressCoordinates(
    customerProfileRow[0]?.addresses,
  );
  if (!businessCoords) {
    return {
      ok: false,
      status: 400,
      message: "Business location coordinates are missing.",
    };
  }
  if (!customerCoords) {
    return {
      ok: false,
      status: 400,
      message:
        "Customer default address with coordinates is required for checkout.",
    };
  }

  const routeDistanceKm = haversineDistanceKm(businessCoords, customerCoords);
  const deliveryFee = computeDeliveryFee(routeDistanceKm);
  const serviceCharge = DEFAULT_SERVICE_CHARGE;
  const totalAmount = subtotal + deliveryFee + serviceCharge;
  return {
    ok: true,
    cart: activeCart,
    subtotal,
    businessCoords,
    routeDistanceKm,
    deliveryFee,
    serviceCharge,
    totalAmount,
  };
}

export const checkoutOrder = async (c: Context<OrderEnv>) => {
  const parsed = checkoutSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const customerId = c.var.user.id;
  const { cartId, paymentMethod, orderType = "food" } = parsed.data;
  const estimate = await estimateCheckoutAmounts({ customerId, cartId });
  if (!estimate.ok) {
    return c.json({ message: estimate.message }, estimate.status);
  }
  const activeCart = estimate.cart;
  const subtotal = estimate.subtotal;
  const routeDistanceKm = estimate.routeDistanceKm;
  const deliveryFee = estimate.deliveryFee;
  const serviceCharge = estimate.serviceCharge;

  const items = await db
    .select({
      id: cartItems.id,
      categoryItemId: cartItems.categoryItemId,
      quantity: cartItems.quantity,
      unitPrice: cartItems.unitPrice,
      itemName: categoryItems.name,
    })
    .from(cartItems)
    .leftJoin(
      categoryItems,
      eq(cartItems.categoryItemId, categoryItems.id),
    )
    .where(eq(cartItems.cartId, activeCart.id));

  const customerRows = await db
    .select({
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, customerId))
    .limit(1);
  const deliveryCode = generateDeliveryCode();
  const now = new Date();
  const cancelExpiresAt = computeCancelExpiresAt(now);

  const result = await db.transaction(async (tx) => {
    const createdOrders = await tx
      .insert(orders)
      .values({
        customerId,
        businessId: activeCart.businessId,
        driverId: null,
        orderType,
        status: "pending_confirmation",
        totalPrice: toMoneyString(subtotal),
        deliveryFee: toMoneyString(deliveryFee),
        serviceCharge: toMoneyString(serviceCharge),
        routeDistanceKm: toMoneyString(routeDistanceKm),
        deliveryCodeHash: hashDeliveryCode(deliveryCode),
        cancelExpiresAt,
      })
      .returning();
    const createdOrder = createdOrders[0];

    const values = items.map((item) => ({
      orderId: createdOrder.id,
      categoryItemId: item.categoryItemId,
      productName: item.itemName ?? "Cart item",
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: toMoneyString(
        toMoneyNumber(item.unitPrice) * item.quantity,
      ),
    }));
    await tx.insert(orderItems).values(values);

    const createdPayments = await tx
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        amount: toMoneyString(subtotal + deliveryFee + serviceCharge),
        method: paymentMethod,
        status: "pending",
      })
      .returning();

    await tx
      .update(carts)
      .set({ status: "checked_out" })
      .where(eq(carts.id, activeCart.id));

    return {
      order: withOrderActionFlags(createdOrder, now),
      payment: createdPayments[0],
      orderItemsCount: values.length,
      assignedDriverId: null,
      offeredDriversCount: 0,
    };
  });

  emitDeliveryCodeOtpLog({
    customerPhoneNumber: customerRows[0]?.phoneNumber ?? null,
    orderId: result.order.id,
    code: deliveryCode,
  });

  return c.json(result, 201);
};

export const estimateCheckoutOrder = async (c: Context<OrderEnv>) => {
  const parsed = checkoutEstimateSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }
  const estimate = await estimateCheckoutAmounts({
    customerId: c.var.user.id,
    cartId: parsed.data.cartId,
  });
  if (!estimate.ok) {
    return c.json({ message: estimate.message }, estimate.status);
  }
  return c.json({
    subtotal: toMoneyString(estimate.subtotal),
    routeDistanceKm: toMoneyString(estimate.routeDistanceKm),
    deliveryFee: toMoneyString(estimate.deliveryFee),
    serviceCharge: toMoneyString(estimate.serviceCharge),
    totalAmount: toMoneyString(estimate.totalAmount),
  });
};

export const createPackageOrder = async (c: Context<OrderEnv>) => {
  const parsed = packageCheckoutSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const customerId = c.var.user.id;
  const { paymentMethod, pickup, dropoff, packageNote } = parsed.data;
  const routeDistanceKm = haversineDistanceKm(
    { lat: pickup.lat, lng: pickup.lng },
    { lat: dropoff.lat, lng: dropoff.lng },
  );
  const deliveryFee = computeDeliveryFee(routeDistanceKm);
  const basePackagePrice = 100;
  const serviceCharge = DEFAULT_SERVICE_CHARGE;
  const payableAmount = basePackagePrice + deliveryFee + serviceCharge;

  const driverCandidates = await db
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
  const rankedDrivers = rankDriversByDistanceToPoint(driverCandidates, {
    lat: pickup.lat,
    lng: pickup.lng,
  });
  const customerRows = await db
    .select({
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, customerId))
    .limit(1);
  const deliveryCode = generateDeliveryCode();

  const result = await db.transaction(async (tx) => {
    const createdOrders = await tx
      .insert(orders)
      .values({
        customerId,
        businessId: null,
        driverId: null,
        orderType: "package",
        status: "pending",
        totalPrice: toMoneyString(basePackagePrice),
        deliveryFee: toMoneyString(deliveryFee),
        serviceCharge: toMoneyString(serviceCharge),
        routeDistanceKm: toMoneyString(routeDistanceKm),
        packageNote: packageNote?.trim() ? packageNote.trim() : null,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat.toFixed(7),
        pickupLng: pickup.lng.toFixed(7),
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat.toFixed(7),
        dropoffLng: dropoff.lng.toFixed(7),
        deliveryCodeHash: hashDeliveryCode(deliveryCode),
      })
      .returning();
    const createdOrder = createdOrders[0];

    const createdPayments = await tx
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        amount: toMoneyString(payableAmount),
        method: paymentMethod,
        status: "pending",
      })
      .returning();

    if (rankedDrivers.length > 0) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30_000);
      await tx.insert(orderDriverOffers).values(
        rankedDrivers.map((driver, index) => ({
          orderId: createdOrder.id,
          driverId: driver.driverId,
          rank: index + 1,
          status: index === 0 ? "pending" : "queued",
          distanceToBusinessKm: driver.distanceToBusinessKm.toFixed(2),
          offeredAt: index === 0 ? now : null,
          expiresAt: index === 0 ? expiresAt : null,
        })),
      );

      const firstDriver = rankedDrivers[0];
      await tx.insert(notifications).values({
        userId: firstDriver.driverId,
        type: "order_incoming",
        title: "Package delivery request",
        message:
          "A nearby package pickup request is waiting for your response.",
      });
    }

    return {
      order: createdOrder,
      payment: createdPayments[0],
      orderItemsCount: 0,
      assignedDriverId: null,
      offeredDriversCount: rankedDrivers.length,
    };
  });

  emitDeliveryCodeOtpLog({
    customerPhoneNumber: customerRows[0]?.phoneNumber ?? null,
    orderId: result.order.id,
    code: deliveryCode,
  });

  return c.json(result, 201);
};

export const getMyOrders = async (c: Context<OrderEnv>) => {
  await promoteDueCustomerCancelOrders();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, c.var.user.id))
    .orderBy(desc(orders.createdAt));
  if (rows.length === 0) {
    return c.json({ orders: [] });
  }

  const orderIds = rows.map((row) => row.id);
  const businessIds = Array.from(
    new Set(
      rows
        .map((row) => row.businessId)
        .filter((businessId): businessId is string => Boolean(businessId)),
    ),
  );
  const driverIds = Array.from(
    new Set(
      rows
        .map((row) => row.driverId)
        .filter((driverId): driverId is string => Boolean(driverId)),
    ),
  );

  const [paymentRows, businessRows, driverUserRows, driverProfileRows] =
    await Promise.all([
      db
        .select()
        .from(payments)
        .where(inArray(payments.orderId, orderIds)),
      businessIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              userId: businessProfile.userId,
              businessName: businessProfile.businessName,
              address: businessProfile.address,
            })
            .from(businessProfile)
            .where(inArray(businessProfile.userId, businessIds)),
      driverIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              id: users.id,
              fullName: users.fullName,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(inArray(users.id, driverIds)),
      driverIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              userId: driverProfile.userId,
              isAvailable: driverProfile.isAvailable,
              rating: driverProfile.rating,
              vehicleType: driverProfile.vehicleType,
            })
            .from(driverProfile)
            .where(inArray(driverProfile.userId, driverIds)),
    ]);

  const paymentByOrderId = new Map(
    paymentRows.map((payment) => [payment.orderId, payment]),
  );
  const businessByUserId = new Map(
    businessRows.map((business) => [business.userId, business]),
  );
  const driverById = new Map(
    driverUserRows.map((driver) => [driver.id, driver]),
  );
  const driverProfileById = new Map(
    driverProfileRows.map((profile) => [profile.userId, profile]),
  );
  const now = new Date();

  return c.json({
    orders: rows.map((order) => {
      const business = order.businessId
        ? businessByUserId.get(order.businessId)
        : null;
      const driver = order.driverId
        ? driverById.get(order.driverId)
        : null;
      const driverExtra = order.driverId
        ? driverProfileById.get(order.driverId)
        : null;
      return {
        ...withOrderActionFlags(order, now),
        payment: paymentByOrderId.get(order.id) ?? null,
        business: business
          ? {
              name: business.businessName,
              address: business.address,
            }
          : null,
        driver: driver
          ? {
              id: driver.id,
              fullName: driver.fullName,
              phoneNumber: driver.phoneNumber,
              isAvailable: driverExtra?.isAvailable ?? null,
              rating: driverExtra?.rating ?? null,
              vehicleType: driverExtra?.vehicleType ?? null,
            }
          : null,
      };
    }),
  });
};

export const getMyOrderById = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();

  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.customerId, c.var.user.id),
      ),
    )
    .limit(1);
  const order = rows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }

  const relatedItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);
  const [businessRows, driverRows, driverProfileRows, feedbackRows] = await Promise.all([
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
    order.driverId
      ? db
          .select({
            id: users.id,
            fullName: users.fullName,
            phoneNumber: users.phoneNumber,
          })
          .from(users)
          .where(eq(users.id, order.driverId))
          .limit(1)
      : Promise.resolve([]),
    order.driverId
      ? db
          .select({
            userId: driverProfile.userId,
            isAvailable: driverProfile.isAvailable,
            rating: driverProfile.rating,
            vehicleType: driverProfile.vehicleType,
          })
          .from(driverProfile)
          .where(eq(driverProfile.userId, order.driverId))
          .limit(1)
      : Promise.resolve([]),
    order.driverId
      ? db
          .select({
            rating: feedback.rating,
            comment: feedback.comment,
            createdAt: feedback.createdAt,
          })
          .from(feedback)
          .where(
            and(
              eq(feedback.orderId, order.id),
              eq(feedback.customerId, c.var.user.id),
              eq(feedback.targetType, "driver"),
              eq(feedback.targetId, order.driverId),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;

  return c.json({
    order: withOrderActionFlags(order),
    items: relatedItems,
    payment: paymentRows[0] ?? null,
    business: business
      ? {
          name: business.businessName,
          address: business.address,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber,
          isAvailable: driverExtra?.isAvailable ?? null,
          rating: driverExtra?.rating ?? null,
          vehicleType: driverExtra?.vehicleType ?? null,
        }
      : null,
    driverFeedback: feedbackRows[0] ?? null,
  });
};

export const getMyOrderTracking = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.customerId, c.var.user.id),
      ),
    )
    .limit(1);
  const order = orderRows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }

  const [businessRows, customerRows, driverRows] = await Promise.all([
    order.businessId
      ? db
          .select({
            businessName: businessProfile.businessName,
            address: businessProfile.address,
            latitude: businessProfile.latitude,
            longitude: businessProfile.longitude,
          })
          .from(businessProfile)
          .where(eq(businessProfile.userId, order.businessId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        addresses: customerProfile.addresses,
      })
      .from(customerProfile)
      .where(eq(customerProfile.userId, order.customerId))
      .limit(1),
    order.driverId
      ? db
          .select({
            id: users.id,
            fullName: users.fullName,
            location: driverLocations.location,
            locationUpdatedAt: driverLocations.updatedAt,
          })
          .from(users)
          .leftJoin(driverLocations, eq(driverLocations.driverId, users.id))
          .where(eq(users.id, order.driverId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const business = businessRows[0] ?? null;
  const customerAddress = pickCustomerAddressWithCoordinates(
    customerRows[0]?.addresses,
  );

  const pickup =
    order.orderType === "package"
      ? {
          address: order.pickupAddress ?? "Pickup address",
          latitude: order.pickupLat !== null ? Number(order.pickupLat) : null,
          longitude:
            order.pickupLng !== null ? Number(order.pickupLng) : null,
        }
      : {
          address: business?.address ?? "Business address",
          latitude: business?.latitude ?? null,
          longitude: business?.longitude ?? null,
        };

  const destination =
    order.orderType === "package"
      ? {
          address:
            order.dropoffAddress ??
            customerAddress?.address ??
            "Destination address",
          latitude: order.dropoffLat !== null ? Number(order.dropoffLat) : null,
          longitude:
            order.dropoffLng !== null ? Number(order.dropoffLng) : null,
        }
      : {
          address: customerAddress?.address ?? "Customer address",
          latitude: customerAddress?.lat ?? null,
          longitude: customerAddress?.lng ?? null,
        };

  const driver = driverRows[0]
    ? {
        id: driverRows[0].id,
        fullName: driverRows[0].fullName,
        location: driverRows[0].location ?? null,
        locationUpdatedAt: driverRows[0].locationUpdatedAt ?? null,
      }
    : null;

  const paymentRows = await db
    .select({
      paymentId: payments.paymentId,
      orderId: payments.orderId,
      amount: payments.amount,
      method: payments.method,
      status: payments.status,
      transactionId: payments.transactionId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);
  const payment = paymentRows[0] ?? null;

  return c.json({
    orderId: order.id,
    status: order.status,
    orderType: order.orderType,
    cancelExpiresAt: order.cancelExpiresAt,
    ...orderActionFlags(order),
    pickup,
    destination,
    driver,
    payment,
  });
};

export const submitDriverFeedback = async (c: Context<OrderEnv>) => {
  if (c.var.user.role !== "customer") {
    return c.json({ message: "Only customers can submit driver feedback." }, 403);
  }

  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  const parsed = submitDriverFeedbackSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const orderRows = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      driverId: orders.driverId,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.customerId, c.var.user.id),
      ),
    )
    .limit(1);
  const order = orderRows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (order.status !== "delivered") {
    return c.json(
      { message: "You can only rate a driver after delivery." },
      409,
    );
  }
  if (!order.driverId) {
    return c.json({ message: "This order has no assigned driver." }, 409);
  }

  const existingFeedbackRows = await db
    .select({
      feedbackId: feedback.feedbackId,
    })
    .from(feedback)
    .where(
      and(
        eq(feedback.orderId, order.id),
        eq(feedback.customerId, c.var.user.id),
        eq(feedback.targetType, "driver"),
        eq(feedback.targetId, order.driverId),
      ),
    )
    .limit(1);
  if (existingFeedbackRows[0]) {
    return c.json({ message: "You have already rated this driver." }, 409);
  }

  const comment = parsed.data.comment?.trim();
  const insertedRows = await db
    .insert(feedback)
    .values({
      orderId: order.id,
      customerId: c.var.user.id,
      targetType: "driver",
      targetId: order.driverId,
      rating: parsed.data.rating,
      comment: comment && comment.length > 0 ? comment : null,
    })
    .returning({
      feedbackId: feedback.feedbackId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
    });
  const inserted = insertedRows[0];

  const averageRows = await db
    .select({
      averageRating: sql<string>`avg(${feedback.rating})`,
    })
    .from(feedback)
    .where(
      and(
        eq(feedback.targetType, "driver"),
        eq(feedback.targetId, order.driverId),
      ),
    );
  const averageRating = Number(averageRows[0]?.averageRating ?? parsed.data.rating);

  await db
    .update(driverProfile)
    .set({
      rating: Number.isFinite(averageRating)
        ? Number(averageRating.toFixed(2))
        : parsed.data.rating,
    })
    .where(eq(driverProfile.userId, order.driverId));

  return c.json(
    {
      message: "Feedback submitted.",
      feedback: inserted,
      driverAverageRating: Number.isFinite(averageRating)
        ? Number(averageRating.toFixed(2))
        : parsed.data.rating,
    },
    201,
  );
};

const adminOrderLineSchema = z.object({
  categoryItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

const adminPatchOrderSchema = z
  .object({
    items: z.array(adminOrderLineSchema).min(1).optional(),
    driverId: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .refine((body) => body.items !== undefined || body.driverId !== undefined, {
    message: "At least one of items or driverId is required.",
  });

export const listAdminOrders = async (c: Context<OrderEnv>) => {
  const limitRaw = c.req.query("limit");
  const offsetRaw = c.req.query("offset");
  const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);

  await promoteDueCustomerCancelOrders();

  const rows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return c.json({ orders: [], limit, offset });
  }

  const orderIds = rows.map((row) => row.id);
  const businessIds = Array.from(
    new Set(
      rows
        .map((row) => row.businessId)
        .filter((businessId): businessId is string => Boolean(businessId)),
    ),
  );
  const driverIds = Array.from(
    new Set(
      rows
        .map((row) => row.driverId)
        .filter((driverId): driverId is string => Boolean(driverId)),
    ),
  );
  const customerIds = Array.from(new Set(rows.map((row) => row.customerId)));

  const [
    paymentRows,
    businessRows,
    driverUserRows,
    driverProfileRows,
    customerRows,
  ] = await Promise.all([
    db.select().from(payments).where(inArray(payments.orderId, orderIds)),
    businessIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            userId: businessProfile.userId,
            businessName: businessProfile.businessName,
            address: businessProfile.address,
          })
          .from(businessProfile)
          .where(inArray(businessProfile.userId, businessIds)),
    driverIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: users.id,
            fullName: users.fullName,
            phoneNumber: users.phoneNumber,
          })
          .from(users)
          .where(inArray(users.id, driverIds)),
    driverIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            userId: driverProfile.userId,
            isAvailable: driverProfile.isAvailable,
            rating: driverProfile.rating,
            vehicleType: driverProfile.vehicleType,
          })
          .from(driverProfile)
          .where(inArray(driverProfile.userId, driverIds)),
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(inArray(users.id, customerIds)),
  ]);

  const paymentByOrderId = new Map(
    paymentRows.map((payment) => [payment.orderId, payment]),
  );
  const businessByUserId = new Map(
    businessRows.map((business) => [business.userId, business]),
  );
  const driverById = new Map(
    driverUserRows.map((driver) => [driver.id, driver]),
  );
  const driverProfileById = new Map(
    driverProfileRows.map((profile) => [profile.userId, profile]),
  );
  const customerById = new Map(
    customerRows.map((customer) => [customer.id, customer]),
  );
  const now = new Date();

  return c.json({
    orders: rows.map((order) => {
      const business = order.businessId
        ? businessByUserId.get(order.businessId)
        : null;
      const driver = order.driverId
        ? driverById.get(order.driverId)
        : null;
      const driverExtra = order.driverId
        ? driverProfileById.get(order.driverId)
        : null;
      const customer = customerById.get(order.customerId);
      return {
        ...withOrderActionFlags(order, now),
        payment: paymentByOrderId.get(order.id) ?? null,
        business: business
          ? {
              name: business.businessName,
              address: business.address,
            }
          : null,
        customer: customer
          ? {
              id: customer.id,
              fullName: customer.fullName,
              phoneNumber: customer.phoneNumber,
            }
          : null,
        driver: driver
          ? {
              id: driver.id,
              fullName: driver.fullName,
              phoneNumber: driver.phoneNumber,
              isAvailable: driverExtra?.isAvailable ?? null,
              rating: driverExtra?.rating ?? null,
              vehicleType: driverExtra?.vehicleType ?? null,
            }
          : null,
      };
    }),
    limit,
    offset,
  });
};

export const getAdminOrderById = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.data.id))
    .limit(1);
  const order = rows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }

  const relatedItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);
  const [businessRows, driverRows, driverProfileRows, customerRows] =
    await Promise.all([
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
      order.driverId
        ? db
            .select({
              id: users.id,
              fullName: users.fullName,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(eq(users.id, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      order.driverId
        ? db
            .select({
              userId: driverProfile.userId,
              isAvailable: driverProfile.isAvailable,
              rating: driverProfile.rating,
              vehicleType: driverProfile.vehicleType,
            })
            .from(driverProfile)
            .where(eq(driverProfile.userId, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, order.customerId))
        .limit(1),
    ]);

  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;
  const customer = customerRows[0] ?? null;

  return c.json({
    order: withOrderActionFlags(order),
    items: relatedItems,
    payment: paymentRows[0] ?? null,
    business: business
      ? {
          name: business.businessName,
          address: business.address,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber,
          isAvailable: driverExtra?.isAvailable ?? null,
          rating: driverExtra?.rating ?? null,
          vehicleType: driverExtra?.vehicleType ?? null,
        }
      : null,
  });
};

export const listBusinessOrders = async (c: Context<OrderEnv>) => {
  const limitRaw = c.req.query("limit");
  const offsetRaw = c.req.query("offset");
  const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);
  const businessUserId = c.var.user.id;

  await promoteDueCustomerCancelOrders();

  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessUserId),
        ne(orders.status, "pending_confirmation"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return c.json({ orders: [], limit, offset });
  }

  const orderIds = rows.map((row) => row.id);
  const businessIds = Array.from(
    new Set(
      rows
        .map((row) => row.businessId)
        .filter((businessId): businessId is string => Boolean(businessId)),
    ),
  );
  const driverIds = Array.from(
    new Set(
      rows
        .map((row) => row.driverId)
        .filter((driverId): driverId is string => Boolean(driverId)),
    ),
  );
  const customerIds = Array.from(new Set(rows.map((row) => row.customerId)));

  const [
    paymentRows,
    businessRows,
    driverUserRows,
    driverProfileRows,
    customerRows,
  ] = await Promise.all([
    db.select().from(payments).where(inArray(payments.orderId, orderIds)),
    businessIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            userId: businessProfile.userId,
            businessName: businessProfile.businessName,
            address: businessProfile.address,
          })
          .from(businessProfile)
          .where(inArray(businessProfile.userId, businessIds)),
    driverIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: users.id,
            fullName: users.fullName,
            phoneNumber: users.phoneNumber,
          })
          .from(users)
          .where(inArray(users.id, driverIds)),
    driverIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            userId: driverProfile.userId,
            isAvailable: driverProfile.isAvailable,
            rating: driverProfile.rating,
            vehicleType: driverProfile.vehicleType,
          })
          .from(driverProfile)
          .where(inArray(driverProfile.userId, driverIds)),
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(inArray(users.id, customerIds)),
  ]);

  const paymentByOrderId = new Map(
    paymentRows.map((payment) => [payment.orderId, payment]),
  );
  const businessByUserId = new Map(
    businessRows.map((business) => [business.userId, business]),
  );
  const driverById = new Map(
    driverUserRows.map((driver) => [driver.id, driver]),
  );
  const driverProfileById = new Map(
    driverProfileRows.map((profile) => [profile.userId, profile]),
  );
  const customerById = new Map(
    customerRows.map((customer) => [customer.id, customer]),
  );
  const now = new Date();

  return c.json({
    orders: rows.map((order) => {
      const business = order.businessId
        ? businessByUserId.get(order.businessId)
        : null;
      const driver = order.driverId ? driverById.get(order.driverId) : null;
      const driverExtra = order.driverId
        ? driverProfileById.get(order.driverId)
        : null;
      const customer = customerById.get(order.customerId);
      return {
        ...withOrderActionFlags(order, now),
        payment: paymentByOrderId.get(order.id) ?? null,
        business: business
          ? {
              name: business.businessName,
              address: business.address,
            }
          : null,
        customer: customer
          ? {
              id: customer.id,
              fullName: customer.fullName,
              phoneNumber: customer.phoneNumber,
            }
          : null,
        driver: driver
          ? {
              id: driver.id,
              fullName: driver.fullName,
              phoneNumber: driver.phoneNumber,
              isAvailable: driverExtra?.isAvailable ?? null,
              rating: driverExtra?.rating ?? null,
              vehicleType: driverExtra?.vehicleType ?? null,
            }
          : null,
      };
    }),
    limit,
    offset,
  });
};

export const getBusinessOrderById = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();

  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.businessId, c.var.user.id),
      ),
    )
    .limit(1);
  const order = rows[0];
  if (!order) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (order.status === "pending_confirmation") {
    return c.json(
      { message: "Order is still in the customer cancellation window." },
      409,
    );
  }

  const relatedItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);
  const [businessRows, driverRows, driverProfileRows, customerRows] =
    await Promise.all([
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
      order.driverId
        ? db
            .select({
              id: users.id,
              fullName: users.fullName,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(eq(users.id, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      order.driverId
        ? db
            .select({
              userId: driverProfile.userId,
              isAvailable: driverProfile.isAvailable,
              rating: driverProfile.rating,
              vehicleType: driverProfile.vehicleType,
            })
            .from(driverProfile)
            .where(eq(driverProfile.userId, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, order.customerId))
        .limit(1),
    ]);

  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;
  const customer = customerRows[0] ?? null;

  return c.json({
    order: withOrderActionFlags(order),
    items: relatedItems,
    payment: paymentRows[0] ?? null,
    business: business
      ? {
          name: business.businessName,
          address: business.address,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber,
          isAvailable: driverExtra?.isAvailable ?? null,
          rating: driverExtra?.rating ?? null,
          vehicleType: driverExtra?.vehicleType ?? null,
        }
      : null,
  });
};

export const patchAdminOrder = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  const parsed = adminPatchOrderSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: "Invalid request payload.", issues: parsed.error.flatten() },
      400,
    );
  }

  const orderId = params.data.id;
  const now = new Date();

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const existing = orderRows[0];
  if (!existing) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (existing.status === "cancelled") {
    return c.json({ message: "Cannot modify a cancelled order." }, 409);
  }

  const initialPaymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  const payment = initialPaymentRows[0] ?? null;

  if (parsed.data.items !== undefined && payment && payment.status !== "pending") {
    return c.json(
      {
        message:
          "Line items can only be edited while the payment is still pending.",
      },
      409,
    );
  }
  if (parsed.data.items !== undefined && !existing.businessId) {
    return c.json(
      { message: "Package orders do not support editable catalog line items." },
      409,
    );
  }

  if (parsed.data.driverId !== undefined) {
    if (
      existing.status === "delivered" ||
      existing.status === "pending_confirmation" ||
      existing.status === "awaiting_business"
    ) {
      return c.json(
        { message: "Driver cannot be changed for this order status." },
        409,
      );
    }
    if (existing.status === "in_transit" && parsed.data.driverId !== null) {
      if (parsed.data.driverId !== existing.driverId) {
        return c.json(
          { message: "Cannot reassign driver while the order is in transit." },
          409,
        );
      }
    }
    if (parsed.data.driverId === null && existing.status === "in_transit") {
      return c.json(
        { message: "Cannot unassign driver while the order is in transit." },
        409,
      );
    }
  }

  const newDriverId =
    parsed.data.driverId === undefined ? undefined : parsed.data.driverId;

  if (newDriverId !== undefined && newDriverId !== null) {
    const [driverUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, newDriverId))
      .limit(1);
    if (!driverUser || driverUser.role !== "driver") {
      return c.json({ message: "Invalid driver user." }, 400);
    }
    if (driverUser.status !== "active") {
      return c.json({ message: "Driver account is not active." }, 400);
    }
    const [dp] = await db
      .select()
      .from(driverProfile)
      .where(eq(driverProfile.userId, newDriverId))
      .limit(1);
    if (!dp) {
      return c.json({ message: "Driver profile not found." }, 400);
    }
  }

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!order) {
        throw new Error("missing_order");
      }

      if (parsed.data.items !== undefined) {
        if (!order.businessId) {
          throw new Error("items_not_supported");
        }
        const orderBusinessId = order.businessId;
        const merged = mergeOrderLineInputs(parsed.data.items);
        const categoryIds = merged.map((m) => m.categoryItemId);
        const catalogRows =
          categoryIds.length === 0
            ? []
            : await tx
                .select({
                  id: categoryItems.id,
                  name: categoryItems.name,
                  price: categoryItems.price,
                  discount: categoryItems.discount,
                  isAvailable: categoryItems.isAvailable,
                  businessId: productCategories.businessId,
                })
                .from(categoryItems)
                .innerJoin(
                  productCategories,
                  eq(categoryItems.categoryId, productCategories.id),
                )
                .where(
                  and(
                    inArray(categoryItems.id, categoryIds),
                    eq(productCategories.businessId, orderBusinessId),
                  ),
                );

        if (catalogRows.length !== new Set(categoryIds).size) {
          throw new Error("invalid_items");
        }
        for (const row of catalogRows) {
          if (!row.isAvailable) {
            throw new Error("unavailable_item");
          }
        }

        await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

        const values = merged.map((line) => {
          const cat = catalogRows.find((r) => r.id === line.categoryItemId)!;
          const unitPrice = applyDiscountedUnitPrice(cat.price, cat.discount);
          const lineTotal = toMoneyString(
            toMoneyNumber(unitPrice) * line.quantity,
          );
          return {
            orderId,
            categoryItemId: line.categoryItemId,
            productName: cat.name,
            unitPrice,
            quantity: line.quantity,
            lineTotal,
          };
        });
        if (values.length > 0) {
          await tx.insert(orderItems).values(values);
        }

        const subtotal = values.reduce(
          (sum, v) => sum + toMoneyNumber(v.unitPrice) * v.quantity,
          0,
        );
        await tx
          .update(orders)
          .set({ totalPrice: toMoneyString(subtotal) })
          .where(eq(orders.id, orderId));

        const [pay] = await tx
          .select()
          .from(payments)
          .where(eq(payments.orderId, orderId))
          .limit(1);
        if (pay && pay.status === "pending") {
          const deliveryFee = toMoneyNumber(order.deliveryFee);
          const serviceCharge = toMoneyNumber(order.serviceCharge);
          await tx
            .update(payments)
            .set({
              amount: toMoneyString(subtotal + deliveryFee + serviceCharge),
            })
            .where(eq(payments.paymentId, pay.paymentId));
        }
      }

      if (newDriverId !== undefined) {
        const [fresh] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        if (!fresh) {
          throw new Error("missing_order");
        }
        const prevDriverId = fresh.driverId;

        if (newDriverId !== prevDriverId) {
          await tx
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

          if (prevDriverId) {
            await tx
              .update(driverProfile)
              .set({ isAvailable: true })
              .where(eq(driverProfile.userId, prevDriverId));
          }

          if (newDriverId === null) {
            const unassignStatus =
              fresh.status === "accepted"
                ? fresh.businessId
                  ? "business_approved"
                  : "pending"
                : fresh.status;
            await tx
              .update(orders)
              .set({
                driverId: null,
                status: unassignStatus,
              })
              .where(eq(orders.id, orderId));
          } else {
            const nextStatus =
              fresh.status === "pending" ||
              fresh.status === "business_approved"
                ? "accepted"
                : fresh.status;
            await tx
              .update(orders)
              .set({ driverId: newDriverId, status: nextStatus })
              .where(eq(orders.id, orderId));

            await tx
              .update(driverProfile)
              .set({ isAvailable: false })
              .where(eq(driverProfile.userId, newDriverId));

            await tx.insert(notifications).values({
              userId: newDriverId,
              type: "order_assigned",
              title: "Order assigned",
              message:
                "An order has been assigned to you by support. Open the driver app to continue.",
            });
          }
        }
      }
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "invalid_items") {
        return c.json(
          { message: "One or more items are invalid for this business." },
          400,
        );
      }
      if (err.message === "unavailable_item") {
        return c.json(
          { message: "One or more catalog items are not available." },
          409,
        );
      }
      if (err.message === "items_not_supported") {
        return c.json(
          { message: "Package orders do not support editable catalog line items." },
          409,
        );
      }
    }
    throw err;
  }

  const refreshed = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const relatedItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const finalPaymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  const [businessRows, driverRows, driverProfileRows, customerRows] =
    await Promise.all([
      refreshed[0]!.businessId
        ? db
            .select({
              userId: businessProfile.userId,
              businessName: businessProfile.businessName,
              address: businessProfile.address,
            })
            .from(businessProfile)
            .where(eq(businessProfile.userId, refreshed[0]!.businessId))
            .limit(1)
        : Promise.resolve([]),
      refreshed[0]!.driverId
        ? db
            .select({
              id: users.id,
              fullName: users.fullName,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(eq(users.id, refreshed[0]!.driverId!))
            .limit(1)
        : Promise.resolve([]),
      refreshed[0]!.driverId
        ? db
            .select({
              userId: driverProfile.userId,
              isAvailable: driverProfile.isAvailable,
              rating: driverProfile.rating,
              vehicleType: driverProfile.vehicleType,
            })
            .from(driverProfile)
            .where(eq(driverProfile.userId, refreshed[0]!.driverId!))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, refreshed[0]!.customerId))
        .limit(1),
    ]);

  const order = refreshed[0]!;
  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;
  const customer = customerRows[0] ?? null;

  return c.json({
    order: withOrderActionFlags(order),
    items: relatedItems,
    payment: finalPaymentRows[0] ?? null,
    business: business
      ? {
          name: business.businessName,
          address: business.address,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber,
          isAvailable: driverExtra?.isAvailable ?? null,
          rating: driverExtra?.rating ?? null,
          vehicleType: driverExtra?.vehicleType ?? null,
        }
      : null,
  });
};

const businessRejectSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

async function loadOrderDetailPayload(orderId: string) {
  const refreshed = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const order = refreshed[0];
  if (!order) return null;

  const relatedItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  const [businessRows, driverRows, driverProfileRows, customerRows] =
    await Promise.all([
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
      order.driverId
        ? db
            .select({
              id: users.id,
              fullName: users.fullName,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(eq(users.id, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      order.driverId
        ? db
            .select({
              userId: driverProfile.userId,
              isAvailable: driverProfile.isAvailable,
              rating: driverProfile.rating,
              vehicleType: driverProfile.vehicleType,
            })
            .from(driverProfile)
            .where(eq(driverProfile.userId, order.driverId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, order.customerId))
        .limit(1),
    ]);

  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;
  const customer = customerRows[0] ?? null;

  return {
    order: withOrderActionFlags(order),
    items: relatedItems,
    payment: paymentRows[0] ?? null,
    business: business
      ? {
          name: business.businessName,
          address: business.address,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
        }
      : null,
    driver: driver
      ? {
          id: driver.id,
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber,
          isAvailable: driverExtra?.isAvailable ?? null,
          rating: driverExtra?.rating ?? null,
          vehicleType: driverExtra?.vehicleType ?? null,
        }
      : null,
  };
}

export const cancelMyOrder = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.customerId, c.var.user.id),
      ),
    )
    .limit(1);
  if (!existing) {
    return c.json({ message: "Order not found." }, 404);
  }

  const flags = orderActionFlags(existing, now);
  if (!flags.canCancel) {
    return c.json(
      {
        message:
          existing.status === "pending_confirmation"
            ? "The cancellation window has expired."
            : "This order can no longer be cancelled.",
      },
      409,
    );
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledBy: "customer",
      cancelledAt: now,
    })
    .where(
      and(
        eq(orders.id, existing.id),
        eq(orders.status, "pending_confirmation"),
      ),
    )
    .returning();

  if (!updated) {
    return c.json({ message: "The cancellation window has expired." }, 409);
  }

  await markOrderPaymentFailed(existing.id);

  return c.json({
    order: withOrderActionFlags(updated, now),
    message: "Order cancelled.",
  });
};

export const approveBusinessOrder = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.businessId, c.var.user.id),
      ),
    )
    .limit(1);
  if (!existing) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (!orderActionFlags(existing, now).canApprove) {
    return c.json(
      { message: "This order is not waiting for business approval." },
      409,
    );
  }

  let offeredDriversCount = 0;
  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({
          status: "business_approved",
          businessRespondedAt: now,
        })
        .where(
          and(
            eq(orders.id, existing.id),
            eq(orders.status, "awaiting_business"),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("approve_race");
      }
      const dispatch = await startDriverDispatchForOrder(existing.id, tx);
      offeredDriversCount = dispatch.offeredDriversCount;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "approve_race") {
      return c.json(
        { message: "This order is not waiting for business approval." },
        409,
      );
    }
    throw err;
  }

  const payload = await loadOrderDetailPayload(existing.id);
  if (!payload) {
    return c.json({ message: "Order not found." }, 404);
  }
  return c.json({
    ...payload,
    offeredDriversCount,
    message: "Order approved.",
  });
};

export const rejectBusinessOrder = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }
  const parsed = businessRejectSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "A rejection note is required." }, 400);
  }

  await promoteDueCustomerCancelOrders();
  const now = new Date();
  const note = parsed.data.note;

  const [existing] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, params.data.id),
        eq(orders.businessId, c.var.user.id),
      ),
    )
    .limit(1);
  if (!existing) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (!orderActionFlags(existing, now).canReject) {
    return c.json(
      { message: "This order is not waiting for business approval." },
      409,
    );
  }

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelledBy: "business",
          cancelledAt: now,
          businessRespondedAt: now,
          businessRejectionNote: note,
        })
        .where(
          and(
            eq(orders.id, existing.id),
            eq(orders.status, "awaiting_business"),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("reject_race");
      }
      await markOrderPaymentFailed(existing.id, tx);
      await tx.insert(notifications).values({
        userId: existing.customerId,
        type: "order_rejected",
        title: "Order declined",
        message: `Your order was declined by the restaurant. Note: ${note}`,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "reject_race") {
      return c.json(
        { message: "This order is not waiting for business approval." },
        409,
      );
    }
    throw err;
  }

  const payload = await loadOrderDetailPayload(existing.id);
  if (!payload) {
    return c.json({ message: "Order not found." }, 404);
  }
  return c.json({
    ...payload,
    message: "Order rejected.",
  });
};

export const cancelAdminOrder = async (c: Context<OrderEnv>) => {
  const params = orderIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: "Invalid order id." }, 400);
  }

  await promoteDueCustomerCancelOrders();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.data.id))
    .limit(1);
  if (!existing) {
    return c.json({ message: "Order not found." }, 404);
  }
  if (!orderActionFlags(existing, now).canAdminCancel) {
    return c.json(
      {
        message:
          existing.status === "cancelled"
            ? "Order is already cancelled."
            : "Delivered orders cannot be cancelled.",
      },
      409,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        cancelledBy: "admin",
        cancelledAt: now,
        driverId: null,
      })
      .where(eq(orders.id, existing.id));

    await cancelOpenDriverOffers(existing.id, now, tx);
    await releaseDriverIfAssigned(existing.driverId, tx);
    await markOrderPaymentFailed(existing.id, tx);

    await tx.insert(notifications).values({
      userId: existing.customerId,
      type: "order_cancelled",
      title: "Order cancelled",
      message: "Your order was cancelled by FlashGo support.",
    });

    if (existing.businessId) {
      await tx.insert(notifications).values({
        userId: existing.businessId,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order ${existing.id.slice(0, 8)} was cancelled by support.`,
      });
    }
  });

  const payload = await loadOrderDetailPayload(existing.id);
  if (!payload) {
    return c.json({ message: "Order not found." }, 404);
  }
  return c.json({
    ...payload,
    message: "Order cancelled by admin.",
  });
};
