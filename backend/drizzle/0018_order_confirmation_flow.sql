ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'pending_confirmation';--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'awaiting_business';--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'business_approved';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "business_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "business_rejection_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "business_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "orders_cancel_expires_status_idx" ON "orders" USING btree ("status","cancel_expires_at");
