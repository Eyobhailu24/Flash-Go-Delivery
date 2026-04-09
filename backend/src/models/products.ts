import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const products = pgTable(
  "products",
  {
    productId: uuid("product_id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
  },
  (table) => [
    index("products_business_available_idx").on(table.businessId, table.isAvailable),
  ]
);
