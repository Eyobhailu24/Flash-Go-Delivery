import { index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { orders } from "./orders.js";
import { categoryItems } from "./categoryItems.js";

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    categoryItemId: uuid("category_item_id").references(
      () => categoryItems.id,
      { onDelete: "set null" }
    ),
    productName: text("product_name").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)]
);
