import { Hono } from "hono";
import {
  checkoutOrder,
  createPackageOrder,
  estimateCheckoutOrder,
  getAdminOrderById,
  getBusinessOrderById,
  getMyOrderById,
  getMyOrders,
  listAdminOrders,
  listBusinessOrders,
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

const businessOrders = new Hono<Env>();
businessOrders.use("*", restrictTo("business"));
businessOrders.get("/", listBusinessOrders);
businessOrders.get("/:id", getBusinessOrderById);

orderRoutes.route("/business", businessOrders);

const customerAdmin = new Hono<Env>();
customerAdmin.use("*", restrictTo("customer", "admin"));
customerAdmin.post("/checkout", checkoutOrder);
customerAdmin.post("/checkout/estimate", estimateCheckoutOrder);
customerAdmin.post("/package", createPackageOrder);
customerAdmin.get("/my", getMyOrders);

const adminOrders = new Hono<Env>();
adminOrders.use("*", restrictTo("admin"));
adminOrders.get("/", listAdminOrders);
adminOrders.get("/:id", getAdminOrderById);
adminOrders.patch("/:id", patchAdminOrder);

customerAdmin.route("/admin", adminOrders);
customerAdmin.get("/:id", getMyOrderById);

orderRoutes.route("/", customerAdmin);
