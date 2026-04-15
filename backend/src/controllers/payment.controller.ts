import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import type { AuthUser } from "../middleware/auth.middleware.js";
import { orders, payments, users } from "../schema.js";

type PaymentEnv = { Variables: { user: AuthUser } };

const initializeTelebirrSchema = z.object({
  orderId: z.string().uuid(),
});

const chapaInitializeResponseSchema = z.object({
  status: z.string(),
  data: z
    .object({
      checkout_url: z.string().url(),
    })
    .optional(),
});

const chapaVerifyResponseSchema = z.object({
  status: z.string(),
  data: z
    .object({
      status: z.string().optional(),
    })
    .optional(),
});

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "FlashGo", lastName: "Customer" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Customer" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function toPaymentStatusRedirect(status: "success" | "failed", txRef: string): string {
  const frontendOrigin =
    process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  return `${frontendOrigin.replace(/\/$/, "")}/payment-status?status=${status}&tx_ref=${encodeURIComponent(txRef)}`;
}

export const initializeTelebirrPayment = async (c: Context<PaymentEnv>) => {
  const parsed = initializeTelebirrSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const currentUser = c.var.user;
  const orderRows = await db
    .select({
      order: orders,
      payment: payments,
      customer: users,
    })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .innerJoin(users, eq(users.id, orders.customerId))
    .where(eq(orders.id, parsed.data.orderId))
    .limit(1);

  const row = orderRows[0];
  if (!row) {
    return c.json({ message: "Order not found." }, 404);
  }

  if (
    currentUser.role === "customer" &&
    row.order.customerId !== currentUser.id
  ) {
    return c.json({ message: "Forbidden." }, 403);
  }

  if (row.payment.method !== "telebirr") {
    return c.json(
      { message: "Telebirr payment is not selected for this order." },
      409,
    );
  }

  if (row.payment.status === "paid") {
    return c.json({ message: "This payment is already completed." }, 409);
  }

  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    return c.json(
      { message: "CHAPA_SECRET_KEY is missing in environment." },
      500,
    );
  }

  const chapaBaseUrl =
    process.env.CHAPA_BASE_URL ?? "https://api.chapa.co/v1";
  const backendBaseUrl =
    process.env.BACKEND_BASE_URL ?? "http://localhost:3001";
  const txRef = randomUUID().replace(/-/g, "");
  const { firstName, lastName } = splitName(row.customer.fullName);

  const response = await fetch(
    `${chapaBaseUrl.replace(/\/$/, "")}/transaction/initialize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: row.payment.amount,
        currency: "ETB",
        email: row.customer.email,
        first_name: firstName,
        last_name: lastName,
        phone_number: row.customer.phoneNumber ?? undefined,
        tx_ref: txRef,
        return_url: `${backendBaseUrl.replace(/\/$/, "")}/payments/telebirr/verify?tx_ref=${txRef}`,
      }),
    },
  );

  const payload = chapaInitializeResponseSchema.safeParse(
    await response.json(),
  );
  if (
    !response.ok ||
    !payload.success ||
    payload.data.status !== "success" ||
    !payload.data.data?.checkout_url
  ) {
    return c.json(
      { message: "Failed to initialize Telebirr payment." },
      502,
    );
  }

  await db
    .update(payments)
    .set({
      transactionId: txRef,
      status: "pending",
    })
    .where(eq(payments.paymentId, row.payment.paymentId));

  return c.json({
    orderId: row.order.id,
    paymentId: row.payment.paymentId,
    checkoutUrl: payload.data.data.checkout_url,
    txRef,
  });
};

export const verifyTelebirrPayment = async (c: Context) => {
  const txRef = c.req.query("tx_ref")?.trim();
  if (!txRef) {
    return c.redirect(toPaymentStatusRedirect("failed", "unknown"));
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.transactionId, txRef))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment) {
    return c.redirect(toPaymentStatusRedirect("failed", txRef));
  }

  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(eq(payments.paymentId, payment.paymentId));
    return c.redirect(toPaymentStatusRedirect("failed", txRef));
  }

  try {
    const chapaBaseUrl =
      process.env.CHAPA_BASE_URL ?? "https://api.chapa.co/v1";
    const response = await fetch(
      `${chapaBaseUrl.replace(/\/$/, "")}/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );
    const payload = chapaVerifyResponseSchema.safeParse(
      await response.json(),
    );

    const verified =
      response.ok &&
      payload.success &&
      payload.data.status === "success" &&
      payload.data.data?.status === "success";

    await db
      .update(payments)
      .set({ status: verified ? "paid" : "failed" })
      .where(eq(payments.paymentId, payment.paymentId));

    return c.redirect(
      toPaymentStatusRedirect(verified ? "success" : "failed", txRef),
    );
  } catch {
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(eq(payments.paymentId, payment.paymentId));
    return c.redirect(toPaymentStatusRedirect("failed", txRef));
  }
};
