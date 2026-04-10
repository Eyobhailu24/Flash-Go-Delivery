import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "driver",
  "business",
  "admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
]);

export const businessStatusEnum = pgEnum("business_status", [
  "pending",
  "approved",
  "rejected",
]);

export const orderTypeEnum = pgEnum("order_type", ["food", "package", "shop"]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "wallet",
  "transfer",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const applicationTypeEnum = pgEnum("application_type", [
  "driver",
  "business",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

export const adminLevelEnum = pgEnum("admin_level", [
  "call_center",
  "manager",
  "super_admin",
]);

export const feedbackTargetEnum = pgEnum("feedback_target_type", [
  "driver",
  "business",
]);

export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);

export const otpPurposeEnum = pgEnum("otp_purpose", [
  "signup_verification",
  "reset_password",
]);

export const cartStatusEnum = pgEnum("cart_status", [
  "active",
  "checked_out",
  "abandoned",
]);
