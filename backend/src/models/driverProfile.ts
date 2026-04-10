import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const driverProfile = pgTable("driver_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type"),
  licenseNumber: text("license_number"),
  rating: doublePrecision("rating").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(false),
  joiningDate: timestamp("joining_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
