import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { applicationStatusEnum, applicationTypeEnum } from "./enums.js";

export const applications = pgTable("applications", {
  applicationId: uuid("application_id").defaultRandom().primaryKey(),
  type: applicationTypeEnum("type").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  status: applicationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
