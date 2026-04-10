import {
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { adminLevelEnum } from "./enums.js";
import { users } from "./users.js";

export const adminProfile = pgTable("admin_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  level: adminLevelEnum("level").notNull().default("call_center"),
  permissions: jsonb("permissions").$type<Record<string, boolean>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});