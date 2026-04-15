import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db.js";
import type { AuthUser } from "../middleware/auth.middleware.js";
import {
  categoryItems,
  businessProfile,
  cartItems,
  carts,
  driverProfile,
  orderItems,
  orders,
  payments,
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

  const driverRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "driver"), eq(users.status, "active")))
    .orderBy(asc(users.createdAt))
    .limit(1);
  const assignedDriverId = driverRows[0]?.id ?? null;

  const result = await db.transaction(async (tx) => {
    const createdOrders = await tx
      .insert(orders)
      .values({
        customerId,
        businessId: activeCart.businessId,
        driverId: assignedDriverId,
        orderType,
        status: "pending",
        totalPrice: toMoneyString(subtotal),
        deliveryFee: "0.00",
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

    return {
      order: createdOrder,
      payment: createdPayments[0],
      orderItemsCount: values.length,
      assignedDriverId,
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
