ALTER TABLE "orders"
ALTER COLUMN "business_id" DROP NOT NULL;

ALTER TABLE "orders"
DROP CONSTRAINT IF EXISTS "orders_business_id_users_id_fk";

ALTER TABLE "orders"
ADD CONSTRAINT "orders_business_id_users_id_fk"
FOREIGN KEY ("business_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "orders"
ADD COLUMN "pickup_address" text;

ALTER TABLE "orders"
ADD COLUMN "pickup_lat" numeric(10, 7);

ALTER TABLE "orders"
ADD COLUMN "pickup_lng" numeric(10, 7);

ALTER TABLE "orders"
ADD COLUMN "dropoff_address" text;

ALTER TABLE "orders"
ADD COLUMN "dropoff_lat" numeric(10, 7);

ALTER TABLE "orders"
ADD COLUMN "dropoff_lng" numeric(10, 7);
