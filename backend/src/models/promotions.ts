import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { discountTypeEnum } from "./enums.js";

export const promotions = pgTable(
  "promotions",
  {
    promoId: uuid("promo_id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    applicableTo: text("applicable_to"),
  },
  (table) => [index("promotions_code_idx").on(table.code)]
);
