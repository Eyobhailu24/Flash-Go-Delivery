import { Hono } from "hono";
import {
  initializeTelebirrPayment,
  verifyTelebirrPayment,
} from "../controllers/payment.controller.js";
import {
  protect,
  restrictTo,
  type AuthUser,
} from "../middleware/auth.middleware.js";

type Env = { Variables: { user: AuthUser } };

export const paymentRoutes = new Hono<Env>();

paymentRoutes.get("/telebirr/verify", verifyTelebirrPayment);
paymentRoutes.post(
  "/telebirr/initialize",
  protect,
  restrictTo("customer", "admin"),
  initializeTelebirrPayment,
);
