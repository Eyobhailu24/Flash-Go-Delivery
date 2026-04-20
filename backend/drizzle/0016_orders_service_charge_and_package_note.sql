ALTER TABLE "orders"
ADD COLUMN "service_charge" numeric(12, 2) NOT NULL DEFAULT '50';

ALTER TABLE "orders"
ADD COLUMN "package_note" text;
