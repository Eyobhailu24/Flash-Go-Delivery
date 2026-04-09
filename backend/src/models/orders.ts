import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { orderStatusEnum, orderTypeEnum } from "./enums.js";
import { users } from "./users.js";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    driverId: uuid("driver_id").references(() => users.id, {
      onDelete: "set null",
    }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orderType: orderTypeEnum("order_type").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("orders_customer_created_idx").on(table.customerId, table.createdAt),
    index("orders_driver_status_idx").on(table.driverId, table.status),
    index("orders_business_status_idx").on(table.businessId, table.status),
  ]
);
