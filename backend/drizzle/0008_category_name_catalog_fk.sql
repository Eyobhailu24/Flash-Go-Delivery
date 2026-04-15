CREATE TABLE "category_name_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_name_catalog_name_unique_idx" ON "category_name_catalog" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "category_name_catalog_active_idx" ON "category_name_catalog" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "category_name_catalog_created_idx" ON "category_name_catalog" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO "category_name_catalog" ("name")
SELECT DISTINCT trim("name")
FROM "product_categories"
WHERE trim("name") <> '';
--> statement-breakpoint
ALTER TABLE "product_categories"
ADD COLUMN "category_name_id" uuid;
--> statement-breakpoint
UPDATE "product_categories" pc
SET "category_name_id" = cnc."id"
FROM "category_name_catalog" cnc
WHERE trim(pc."name") = cnc."name";
--> statement-breakpoint
ALTER TABLE "product_categories"
ALTER COLUMN "category_name_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_category_name_id_category_name_catalog_id_fk"
FOREIGN KEY ("category_name_id")
REFERENCES "public"."category_name_catalog"("id")
ON DELETE restrict
ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_categories_name_id_idx"
ON "product_categories" USING btree ("category_name_id");
--> statement-breakpoint
ALTER TABLE "product_categories"
DROP COLUMN "name";
