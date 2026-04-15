import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const categoryNameCatalog = pgTable(
  'category_name_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    imagePath: text('image_path'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('category_name_catalog_name_unique_idx').on(
      table.name,
    ),
    index('category_name_catalog_active_idx').on(table.isActive),
    index('category_name_catalog_created_idx').on(table.createdAt),
  ],
);
