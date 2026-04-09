CREATE TYPE "public"."otp_purpose" AS ENUM('signup_verification', 'reset_password');--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "otp_phone_purpose_idx" ON "otp_verifications" USING btree ("phone_number","purpose");--> statement-breakpoint
CREATE INDEX "otp_expires_at_idx" ON "otp_verifications" USING btree ("expires_at");