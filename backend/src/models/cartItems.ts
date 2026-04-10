import { index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { carts } from "./carts.js";
import { categoryItems } from "./categoryItems.js";

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    categoryItemId: uuid("category_item_id")
      .notNull()
      .references(() => categoryItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    specialInstructions: text("special_instructions"),
  },
  (table) => [index("cart_items_cart_idx").on(table.cartId)]
);
