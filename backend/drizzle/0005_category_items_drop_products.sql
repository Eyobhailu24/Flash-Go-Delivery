ALTER TABLE "product_categories" ADD COLUMN "image_url" text;--> statement-breakpoint
CREATE TABLE "category_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2),
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_items_category_sort_idx" ON "category_items" USING btree ("category_id","sort_order");--> statement-breakpoint
DELETE FROM "cart_items";--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_product_id_products_product_id_fk";--> statement-breakpoint
ALTER TABLE "cart_items" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "category_item_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_category_item_id_category_items_id_fk" FOREIGN KEY ("category_item_id") REFERENCES "public"."category_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_product_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "category_item_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_category_item_id_category_items_id_fk" FOREIGN KEY ("category_item_id") REFERENCES "public"."category_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP TABLE "products" CASCADE;
