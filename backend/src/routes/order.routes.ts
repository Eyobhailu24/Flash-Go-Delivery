import { Hono } from "hono";
import {
  approveBusinessOrder,
  cancelAdminOrder,
  cancelMyOrder,
  checkoutOrder,
  createPackageOrder,
  estimateCheckoutOrder,
  getAdminOrderById,
  getBusinessOrderById,
  getMyOrderById,
  getMyOrderTracking,
  getMyOrders,
  listAdminOrders,
  listBusinessOrders,
  patchAdminOrder,
  rejectBusinessOrder,
  submitDriverFeedback,
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
businessOrders.post("/:id/approve", approveBusinessOrder);
businessOrders.post("/:id/reject", rejectBusinessOrder);
businessOrders.get("/:id", getBusinessOrderById);

orderRoutes.route("/business", businessOrders);

const customerAdmin = new Hono<Env>();
customerAdmin.use("*", restrictTo("customer", "admin"));
customerAdmin.post("/checkout", checkoutOrder);
customerAdmin.post("/checkout/estimate", estimateCheckoutOrder);
customerAdmin.post("/package", createPackageOrder);
customerAdmin.get("/my", getMyOrders);
customerAdmin.post("/:id/feedback", submitDriverFeedback);
customerAdmin.post("/:id/cancel", cancelMyOrder);

const adminOrders = new Hono<Env>();
adminOrders.use("*", restrictTo("admin"));
adminOrders.get("/", listAdminOrders);
adminOrders.get("/:id", getAdminOrderById);
adminOrders.patch("/:id", patchAdminOrder);
adminOrders.post("/:id/cancel", cancelAdminOrder);

customerAdmin.route("/admin", adminOrders);
customerAdmin.get("/:id/tracking", getMyOrderTracking);
customerAdmin.get("/:id", getMyOrderById);

orderRoutes.route("/", customerAdmin);
