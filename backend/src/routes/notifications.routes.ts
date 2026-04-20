import { Hono } from "hono";
import {
  broadcastNotifications,
  getMyNotifications,
} from "../controllers/notifications.controller.js";
import {
  protect,
  restrictTo,
  type AuthUser,
} from "../middleware/auth.middleware.js";

type Env = { Variables: { user: AuthUser } };

export const notificationsRoutes = new Hono<Env>();

notificationsRoutes.use("*", protect);

notificationsRoutes.get("/me", getMyNotifications);
notificationsRoutes.post(
  "/broadcast",
  restrictTo("admin"),
  broadcastNotifications,
);
