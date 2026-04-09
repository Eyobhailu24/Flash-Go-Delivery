import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { otpPurposeEnum } from "./enums.js";

export const otpVerifications = pgTable(
  "otp_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneNumber: text("phone_number").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    otpHash: text("otp_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("otp_phone_purpose_idx").on(table.phoneNumber, table.purpose),
    index("otp_expires_at_idx").on(table.expiresAt),
  ]
);
