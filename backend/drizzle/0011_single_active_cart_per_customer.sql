DROP INDEX IF EXISTS "carts_one_active_per_customer_business";
CREATE UNIQUE INDEX "carts_one_active_per_customer"
ON "carts" USING btree ("customer_id")
WHERE "status" = 'active';
