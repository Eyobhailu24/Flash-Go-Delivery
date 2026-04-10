import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const customerProfile = pgTable("customer_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  addresses: jsonb("addresses").$type<
    Array<{
      label?: string;
      address: string;
      lat?: number;
      lng?: number;
      isDefault?: boolean;
    }>
  >(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
