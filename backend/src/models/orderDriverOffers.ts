import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orders } from "./orders.js";
import { users } from "./users.js";

export const orderDriverOffers = pgTable(
  "order_driver_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    status: text("status").notNull().default("queued"),
    distanceToBusinessKm: text("distance_to_business_km"),
    offeredAt: timestamp("offered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_driver_offers_order_idx").on(table.orderId, table.rank),
    index("order_driver_offers_driver_status_idx").on(table.driverId, table.status),
  ],
);
