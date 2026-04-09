import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { feedbackTargetEnum } from "./enums.js";
import { orders } from "./orders.js";
import { users } from "./users.js";

export const feedback = pgTable(
  "feedback",
  {
    feedbackId: uuid("feedback_id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: feedbackTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("feedback_order_idx").on(table.orderId)]
);
