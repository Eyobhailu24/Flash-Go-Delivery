ALTER TABLE "category_name_catalog"
ADD COLUMN "image_path" text;
--> statement-breakpoint
ALTER TABLE "product_categories"
DROP COLUMN "image_url";
