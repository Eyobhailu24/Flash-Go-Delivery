import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const driverLocations = pgTable(
  "driver_locations",
  {
    driverId: uuid("driver_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    location: jsonb("location").$type<{
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
    }>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("driver_locations_updated_idx").on(table.updatedAt)]
);
