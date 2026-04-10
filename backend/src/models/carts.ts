import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cartStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: cartStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("carts_customer_idx").on(table.customerId),
    index("carts_business_idx").on(table.businessId),
    index("carts_customer_business_status_idx").on(
      table.customerId,
      table.businessId,
      table.status
    ),
    uniqueIndex("carts_one_active_per_customer_business")
      .on(table.customerId, table.businessId)
      .where(sql`${table.status} = 'active'`),
  ]
);
