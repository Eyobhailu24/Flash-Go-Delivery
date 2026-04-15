import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { categoryNameCatalog } from './categoryNameCatalog.js';
import { users } from './users.js';

export const productCategories = pgTable(
  'product_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryNameId: uuid('category_name_id')
      .notNull()
      .references(() => categoryNameCatalog.id, {
        onDelete: 'restrict',
      }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('product_categories_business_sort_idx').on(
      table.businessId,
      table.sortOrder,
    ),
    index('product_categories_name_id_idx').on(
      table.categoryNameId,
    ),
  ],
);
