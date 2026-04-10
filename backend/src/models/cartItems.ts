import { index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { carts } from "./carts.js";
import { products } from "./products.js";

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    specialInstructions: text("special_instructions"),
  },
  (table) => [index("cart_items_cart_idx").on(table.cartId)]
);
