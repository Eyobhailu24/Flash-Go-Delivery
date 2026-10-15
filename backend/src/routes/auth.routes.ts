import { Hono } from "hono";
import {
  changePassword,
  forgotPassword,
  getMyCustomerProfile,
  login,
  logout,
  logoutMobile,
  refreshMobile,
  me,
  resendSignupOtp,
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
authRoutes.post("/resend-signup-otp", resendSignupOtp);
authRoutes.post("/login", login);
authRoutes.post("/mobile/login", login);
authRoutes.post("/mobile/refresh", refreshMobile);
authRoutes.post("/mobile/logout", logoutMobile);
authRoutes.post("/change-password", changePassword);
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);
authRoutes.post("/logout", logout);
