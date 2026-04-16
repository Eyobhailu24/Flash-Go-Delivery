ALTER TABLE "orders"
ADD COLUMN "route_distance_km" numeric(8, 2);

CREATE TABLE "order_driver_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "driver_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "rank" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "distance_to_business_km" text,
  "offered_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "order_driver_offers_order_idx"
ON "order_driver_offers" ("order_id", "rank");

CREATE INDEX "order_driver_offers_driver_status_idx"
ON "order_driver_offers" ("driver_id", "status");
