import { Hono } from "hono";
import {
  acceptDriverOffer,
  getCurrentAssignedOrder,
  getCurrentDriverOffer,
  markDriverOrderDelivered,
  rejectDriverOffer,
  startDriverTrip,
  upsertDriverLocation,
} from "../controllers/driverDispatch.controller.js";
import {
  protect,
  restrictTo,
  type AuthUser,
} from "../middleware/auth.middleware.js";

type Env = { Variables: { user: AuthUser } };

export const driverDispatchRoutes = new Hono<Env>();

driverDispatchRoutes.use("*", protect);
driverDispatchRoutes.use("*", restrictTo("driver", "admin"));

driverDispatchRoutes.post("/location", upsertDriverLocation);
driverDispatchRoutes.get("/offers/current", getCurrentDriverOffer);
driverDispatchRoutes.get("/orders/current", getCurrentAssignedOrder);
driverDispatchRoutes.post("/orders/:orderId/start", startDriverTrip);
driverDispatchRoutes.post("/orders/:orderId/deliver", markDriverOrderDelivered);
driverDispatchRoutes.post("/offers/:offerId/accept", acceptDriverOffer);
driverDispatchRoutes.post("/offers/:offerId/reject", rejectDriverOffer);
