import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db.js";
import type { AuthUser } from "../middleware/auth.middleware.js";
import {
  categoryItems,
  businessProfile,
  cartItems,
  carts,
  customerProfile,
  driverProfile,
  driverLocations,
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

const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

function toMoneyNumber(value: string | null): number {
  if (value === null) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

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

export const checkoutOrder = async (c: Context<OrderEnv>) => {
  const parsed = checkoutSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const customerId = c.var.user.id;
  const { cartId, paymentMethod, orderType = "food" } = parsed.data;

  const cart = await db
    .select()
    .from(carts)
    .where(
      and(eq(carts.id, cartId), eq(carts.customerId, customerId)),
    )
    .limit(1);
  const activeCart = cart[0];

  if (!activeCart) {
    return c.json({ message: "Cart not found." }, 404);
  }

  if (activeCart.status !== "active") {
    return c.json(
      { message: "Only active carts can be checked out." },
      409,
    );
  }

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
  if (items.length === 0) {
    return c.json({ message: "Your cart is empty." }, 400);
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
      ? {
          lat: businessRow[0].latitude,
          lng: businessRow[0].longitude,
        }
      : null;
  const customerCoords = pickCustomerAddressCoordinates(
    customerProfileRow[0]?.addresses,
  );

  if (!businessCoords) {
    return c.json(
      { message: "Business location coordinates are missing." },
      400,
    );
  }
  if (!customerCoords) {
    return c.json(
      {
        message:
          "Customer default address with coordinates is required for checkout.",
      },
      400,
    );
  }

  const routeDistanceKm = haversineDistanceKm(businessCoords, customerCoords);
  const deliveryFee = computeDeliveryFee(routeDistanceKm);

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

  const rankedDrivers = driverCandidates
    .map((driver) => {
      const lat = driver.location?.lat;
      const lng = driver.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      const distanceToBusinessKm = haversineDistanceKm(
        { lat, lng },
        businessCoords,
      );
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

  const result = await db.transaction(async (tx) => {
    const createdOrders = await tx
      .insert(orders)
      .values({
        customerId,
        businessId: activeCart.businessId,
        driverId: null,
        orderType,
        status: "pending",
        totalPrice: toMoneyString(subtotal),
        deliveryFee: toMoneyString(deliveryFee),
        routeDistanceKm: toMoneyString(routeDistanceKm),
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
        amount: toMoneyString(subtotal),
        method: paymentMethod,
        status: "pending",
      })
      .returning();

    await tx
      .update(carts)
      .set({ status: "checked_out" })
      .where(eq(carts.id, activeCart.id));

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
        title: "Order incoming",
        message:
          "A new nearby delivery request is waiting for your response.",
      });
    }

    return {
      order: createdOrder,
      payment: createdPayments[0],
      orderItemsCount: values.length,
      assignedDriverId: null,
      offeredDriversCount: rankedDrivers.length,
    };
  });

  return c.json(result, 201);
};

export const getMyOrders = async (c: Context<OrderEnv>) => {
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
    new Set(rows.map((row) => row.businessId)),
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
      db
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

  return c.json({
    orders: rows.map((order) => {
      const business = businessByUserId.get(order.businessId);
      const driver = order.driverId
        ? driverById.get(order.driverId)
        : null;
      const driverExtra = order.driverId
        ? driverProfileById.get(order.driverId)
        : null;
      return {
        ...order,
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
  const [businessRows, driverRows, driverProfileRows] = await Promise.all([
    db
      .select({
        userId: businessProfile.userId,
        businessName: businessProfile.businessName,
        address: businessProfile.address,
      })
      .from(businessProfile)
      .where(eq(businessProfile.userId, order.businessId))
      .limit(1),
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
  ]);

  const business = businessRows[0] ?? null;
  const driver = driverRows[0] ?? null;
  const driverExtra = driverProfileRows[0] ?? null;

  return c.json({
    order,
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
  });
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
  const businessIds = Array.from(new Set(rows.map((row) => row.businessId)));
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
    db
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

  return c.json({
    orders: rows.map((order) => {
      const business = businessByUserId.get(order.businessId);
      const driver = order.driverId
        ? driverById.get(order.driverId)
        : null;
      const driverExtra = order.driverId
        ? driverProfileById.get(order.driverId)
        : null;
      const customer = customerById.get(order.customerId);
      return {
        ...order,
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
      db
        .select({
          userId: businessProfile.userId,
          businessName: businessProfile.businessName,
          address: businessProfile.address,
        })
        .from(businessProfile)
        .where(eq(businessProfile.userId, order.businessId))
        .limit(1),
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
    order,
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

  if (parsed.data.driverId !== undefined) {
    if (existing.status === "delivered") {
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
                    eq(productCategories.businessId, order.businessId),
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
          await tx
            .update(payments)
            .set({ amount: toMoneyString(subtotal) })
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
            await tx
              .update(orders)
              .set({
                driverId: null,
                status:
                  fresh.status === "accepted" ? "pending" : fresh.status,
              })
              .where(eq(orders.id, orderId));
          } else {
            const nextStatus =
              fresh.status === "pending" ? "accepted" : fresh.status;
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
      db
        .select({
          userId: businessProfile.userId,
          businessName: businessProfile.businessName,
          address: businessProfile.address,
        })
        .from(businessProfile)
        .where(eq(businessProfile.userId, refreshed[0]!.businessId))
        .limit(1),
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
    order,
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
