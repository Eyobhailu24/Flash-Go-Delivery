import { and, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db.js";
import { notifications, users } from "../schema.js";
import type { AuthUser } from "../middleware/auth.middleware.js";

type NotificationsEnv = { Variables: { user: AuthUser } };

const userRoleValues = [
  "customer",
  "driver",
  "business",
  "admin",
] as const;

const audienceSchema = z.enum([
  "customer",
  "business",
  "admin",
  "driver",
  "customers_and_businesses",
  "all",
]);

const broadcastBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(10_000),
  type: z.string().trim().min(1).max(80),
  audience: audienceSchema,
});

const INSERT_CHUNK = 500;

const myNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
});

function rolesForAudience(
  audience: z.infer<typeof audienceSchema>,
): (typeof userRoleValues)[number][] {
  switch (audience) {
    case "customer":
      return ["customer"];
    case "business":
      return ["business"];
    case "admin":
      return ["admin"];
    case "driver":
      return ["driver"];
    case "customers_and_businesses":
      return ["customer", "business"];
    case "all":
      return [...userRoleValues];
    default: {
      const _exhaustive: never = audience;
      return _exhaustive;
    }
  }
}

export const getMyNotifications = async (c: Context<NotificationsEnv>) => {
  const parsed = myNotificationsQuerySchema.safeParse({
    limit: c.req.query("limit"),
    unreadOnly: c.req.query("unreadOnly"),
  });
  if (!parsed.success) {
    return c.json({ message: "Invalid query parameters." }, 400);
  }

  const limit = parsed.data.limit ?? 50;
  const unreadOnly = parsed.data.unreadOnly === "true";

  const where = unreadOnly
    ? and(
        eq(notifications.userId, c.var.user.id),
        eq(notifications.readStatus, false),
      )
    : eq(notifications.userId, c.var.user.id);

  const rows = await db
    .select({
      notificationId: notifications.notificationId,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      readStatus: notifications.readStatus,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return c.json({ notifications: rows });
};

export const broadcastNotifications = async (
  c: Context<NotificationsEnv>,
) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON body." }, 400);
  }

  const parsed = broadcastBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const { title, message, type, audience } = parsed.data;
  const roles = rolesForAudience(audience);

  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, roles), eq(users.status, "active")));

  if (recipients.length === 0) {
    return c.json({
      inserted: 0,
      audience,
      roles,
      message: "No active users matched this audience.",
    });
  }

  const rows = recipients.map((r) => ({
    userId: r.id,
    type,
    title,
    message,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db.insert(notifications).values(rows.slice(i, i + INSERT_CHUNK));
  }

  return c.json({
    inserted: rows.length,
    audience,
    roles,
  });
};
