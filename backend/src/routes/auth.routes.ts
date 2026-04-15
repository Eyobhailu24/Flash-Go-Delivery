import { Hono } from "hono";
import {
  changePassword,
  forgotPassword,
  getMyCustomerProfile,
  login,
  logout,
  me,
  resetPassword,
  signup,
  updateMe,
  upsertMyCustomerProfile,
  verifySignupOtp,
} from "../controllers/auth.controller.js";

export const authRoutes = new Hono();

authRoutes.get("/me", me);
authRoutes.patch("/me", updateMe);
authRoutes.get("/customer-profile", getMyCustomerProfile);
authRoutes.patch("/customer-profile", upsertMyCustomerProfile);
authRoutes.post("/signup", signup);
authRoutes.post("/verify-otp", verifySignupOtp);
authRoutes.post("/login", login);
authRoutes.post("/change-password", changePassword);
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);
authRoutes.post("/logout", logout);
