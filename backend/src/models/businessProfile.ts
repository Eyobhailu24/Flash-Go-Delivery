import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businessStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const businessProfile = pgTable("business_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  businessType: text("business_type"),
  address: text("address"),
  status: businessStatusEnum("status").notNull().default("pending"),
  approvedDate: timestamp("approved_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
