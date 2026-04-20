import { Hono } from "hono";
import {
  checkoutOrder,
  getAdminOrderById,
  getMyOrderById,
  getMyOrders,
  listAdminOrders,
  patchAdminOrder,
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

const adminOrders = new Hono<Env>();
adminOrders.use("*", restrictTo("admin"));
adminOrders.get("/", listAdminOrders);
adminOrders.get("/:id", getAdminOrderById);
adminOrders.patch("/:id", patchAdminOrder);

orderRoutes.post("/checkout", checkoutOrder);
orderRoutes.get("/my", getMyOrders);
orderRoutes.route("/admin", adminOrders);
orderRoutes.get("/:id", getMyOrderById);
