import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./orders.js";

export const packages = pgTable("packages", {
  orderId: uuid("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  pickupAddress: text("pickup_address").notNull(),
  pickupLocation: jsonb("pickup_location").$type<{
    lat: number;
    lng: number;
  }>(),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLocation: jsonb("dropoff_location").$type<{
    lat: number;
    lng: number;
  }>(),
  size: text("size"),
  weight: doublePrecision("weight"),
  description: text("description"),
});
