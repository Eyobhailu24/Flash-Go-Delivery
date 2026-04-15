import { Hono } from "hono";
import {
  checkoutOrder,
  getMyOrderById,
  getMyOrders,
} from "../controllers/order.controller.js";
import {
  protect,
  restrictTo,
  type AuthUser,
} from "../middleware/auth.middleware.js";

type Env = { Variables: { user: AuthUser } };

export const orderRoutes = new Hono<Env>();

orderRoutes.use("*", protect);
orderRoutes.use("*", restrictTo("customer", "admin"));

orderRoutes.post("/checkout", checkoutOrder);
orderRoutes.get("/my", getMyOrders);
orderRoutes.get("/:id", getMyOrderById);
