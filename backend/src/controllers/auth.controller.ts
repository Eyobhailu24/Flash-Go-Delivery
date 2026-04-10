import { and, desc, eq, gt, isNull } from "drizzle-orm";
import argon2 from "argon2";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import jwt from "jsonwebtoken";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { otpVerifications, users } from "../schema.js";

const signupSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phoneNumber: z.string().trim().min(8),
  password: z.string().min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

const verifyOtpSchema = z.object({
  phoneNumber: z.string().trim().min(8),
  otp: z.string().trim().min(4).max(8),
});

const loginSchema = z.object({
  phoneNumber: z.string().trim().min(8),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  phoneNumber: z.string().trim().min(8),
});

const resetPasswordSchema = z.object({
  phoneNumber: z.string().trim().min(8),
  otp: z.string().trim().min(4).max(8),
  newPassword: z.string().min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

type OtpPurpose = "signup_verification" | "reset_password";

type AccessPayload = {
  sub: string;
  role: string;
  phoneNumber: string;
};

const accessSecret = process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret";
const refreshSecret =
  process.env.JWT_REFRESH_SECRET ?? "change-me-refresh-secret";
const accessExpiry = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const refreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

const cookieSecure = (process.env.COOKIE_SECURE ?? "false") === "true";
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const otpLength = Number(process.env.OTP_LENGTH ?? 6);
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES ?? 5);
const otpMaxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const otpTemplate =
  process.env.AFRO_SMS_TEMPLATE_OTP ??
  "Your FlashGo OTP is {{CODE}}. It expires in {{MINUTES}} minutes.";

function normalizePhone(phoneNumber: string): string {
  return phoneNumber.replace(/\s+/g, "");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseDurationToSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 15 * 60;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "s") return value;
  if (unit === "m") return value * 60;
  if (unit === "h") return value * 3600;
  return value * 86400;
}

function getSameSite(): "Lax" | "Strict" | "None" {
  const raw = (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase();
  if (raw === "strict") return "Strict";
  if (raw === "none") return "None";
  return "Lax";
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  const min = 10 ** (otpLength - 1);
  const max = 10 ** otpLength;
  return String(randomInt(min, max));
}

async function sendOtpSms(phoneNumber: string, otp: string): Promise<void> {
  const message = otpTemplate
    .replace("{{CODE}}", otp)
    .replace("{{MINUTES}}", String(otpExpiryMinutes));

  if ((process.env.OTP_DEBUG_LOG ?? "true") === "true") {
    console.log(`[OTP-DEBUG] ${phoneNumber} -> ${otp}`);
  }

  if ((process.env.OTP_BYPASS ?? "false") === "true") {
    return;
  }

  const baseUrl = process.env.AFRO_SMS_BASE_URL;
  const apiKey = process.env.AFRO_SMS_API_KEY;
  if (!baseUrl || !apiKey || apiKey.includes("change-me")) {
    throw new Error("Afro SMS is not configured.");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/challenge/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.AFRO_SMS_SENDER_ID ?? "FlashGo",
        to: phoneNumber,
        message,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Afro SMS failed: ${response.status} ${body}`);
  }
}

async function createOtp(
  phoneNumber: string,
  purpose: OtpPurpose
): Promise<string> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

  await db
    .update(otpVerifications)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.consumedAt)
      )
    );

  await db.insert(otpVerifications).values({
    phoneNumber,
    purpose,
    otpHash: hashOtp(otp),
    expiresAt,
    maxAttempts: otpMaxAttempts,
  });

  return otp;
}

async function verifyOtp(
  phoneNumber: string,
  purpose: OtpPurpose,
  otp: string
): Promise<boolean> {
  const row = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.consumedAt),
        gt(otpVerifications.expiresAt, new Date())
      )
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  const record = row[0];
  if (!record) return false;
  if (record.attemptCount >= record.maxAttempts) return false;

  const matches = hashOtp(otp) === record.otpHash;
  if (!matches) {
    await db
      .update(otpVerifications)
      .set({ attemptCount: record.attemptCount + 1 })
      .where(eq(otpVerifications.id, record.id));
    return false;
  }

  await db
    .update(otpVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(otpVerifications.id, record.id));

  return true;
}

function createTokens(payload: AccessPayload): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: parseDurationToSeconds(accessExpiry),
  });
  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: parseDurationToSeconds(refreshExpiry),
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(c: Context, accessToken: string, refreshToken: string) {
  const sameSite = getSameSite();
  setCookie(c, "access_token", accessToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite,
    domain: cookieDomain,
    path: "/",
    maxAge: parseDurationToSeconds(accessExpiry),
  });
  setCookie(c, "refresh_token", refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite,
    domain: cookieDomain,
    path: "/",
    maxAge: parseDurationToSeconds(refreshExpiry),
  });
}

function requireAuth(c: Context): AccessPayload | null {
  const token = getCookie(c, "access_token");
  if (!token) return null;
  try {
    return jwt.verify(token, accessSecret) as AccessPayload;
  } catch {
    return null;
  }
}

export const signup = async (c: Context) => {
  const parsed = signupSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const fullName = parsed.data.fullName.trim();
  const email = normalizeEmail(parsed.data.email);
  const phoneNumber = normalizePhone(parsed.data.phoneNumber);
  const passwordHash = await argon2.hash(parsed.data.password);

  const existing = await db
    .select({
      id: users.id,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (existing[0]?.isVerified) {
    return c.json({ message: "Phone number is already registered." }, 409);
  }

  const emailOwner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const emailTakenByOther =
    emailOwner[0] && (!existing[0] || emailOwner[0].id !== existing[0].id);
  if (emailTakenByOther) {
    return c.json({ message: "Email is already registered." }, 409);
  }

  if (!existing[0]) {
    await db.insert(users).values({
      fullName,
      email,
      phoneNumber,
      passwordHash,
      role: "customer",
      isVerified: false,
    });
  } else {
    await db
      .update(users)
      .set({ fullName, email, passwordHash, role: "customer" })
      .where(eq(users.id, existing[0].id));
  }

  const otp = await createOtp(phoneNumber, "signup_verification");
  await sendOtpSms(phoneNumber, otp);

  return c.json({
    message: "Signup started. OTP sent to phone number.",
    phoneNumber,
  });
};

export const verifySignupOtp = async (c: Context) => {
  const parsed = verifyOtpSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const phoneNumber = normalizePhone(parsed.data.phoneNumber);
  const ok = await verifyOtp(
    phoneNumber,
    "signup_verification",
    parsed.data.otp.trim()
  );
  if (!ok) {
    return c.json({ message: "Invalid or expired OTP." }, 400);
  }

  await db
    .update(users)
    .set({ isVerified: true, verifiedAt: new Date() })
    .where(eq(users.phoneNumber, phoneNumber));

  return c.json({ message: "Phone number verified successfully." });
};

export const login = async (c: Context) => {
  const parsed = loginSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const phoneNumber = normalizePhone(parsed.data.phoneNumber);
  const result = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  const user = result[0];
  if (!user) return c.json({ message: "Invalid phone number or password." }, 401);

  const isPasswordValid = await argon2.verify(
    user.passwordHash,
    parsed.data.password
  );
  if (!isPasswordValid) {
    return c.json({ message: "Invalid phone number or password." }, 401);
  }

  if (!user.isVerified) {
    return c.json({ message: "Please verify your phone number first." }, 403);
  }

  const { accessToken, refreshToken } = createTokens({
    sub: user.id,
    role: user.role,
    phoneNumber: user.phoneNumber ?? "",
  });
  setAuthCookies(c, accessToken, refreshToken);

  return c.json({
    message: "Login successful.",
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
    },
  });
};

export const changePassword = async (c: Context) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ message: "Unauthorized." }, 401);

  const parsed = changePasswordSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const result = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1);
  const user = result[0];
  if (!user) return c.json({ message: "User not found." }, 404);

  const matches = await argon2.verify(user.passwordHash, parsed.data.currentPassword);
  if (!matches) {
    return c.json({ message: "Current password is incorrect." }, 400);
  }

  const passwordHash = await argon2.hash(parsed.data.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return c.json({ message: "Password changed successfully." });
};

export const forgotPassword = async (c: Context) => {
  const parsed = forgotPasswordSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const phoneNumber = normalizePhone(parsed.data.phoneNumber);
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (result[0]) {
    const otp = await createOtp(phoneNumber, "reset_password");
    await sendOtpSms(phoneNumber, otp);
  }

  return c.json({
    message: "If the account exists, a reset OTP has been sent.",
  });
};

export const resetPassword = async (c: Context) => {
  const parsed = resetPasswordSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ message: "Invalid request payload." }, 400);
  }

  const phoneNumber = normalizePhone(parsed.data.phoneNumber);
  const isOtpValid = await verifyOtp(
    phoneNumber,
    "reset_password",
    parsed.data.otp.trim()
  );
  if (!isOtpValid) {
    return c.json({ message: "Invalid or expired OTP." }, 400);
  }

  const passwordHash = await argon2.hash(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.phoneNumber, phoneNumber));

  return c.json({ message: "Password reset successful." });
};

export const logout = async (c: Context) => {
  deleteCookie(c, "access_token", { path: "/", domain: cookieDomain });
  deleteCookie(c, "refresh_token", { path: "/", domain: cookieDomain });
  return c.json({ message: "Logged out successfully." });
};

export const me = async (c: Context) => {
  const auth = requireAuth(c);
  if (!auth) {
    return c.json({ message: "Unauthorized." }, 401);
  }

  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, auth.sub))
    .limit(1);

  const user = result[0];
  if (!user) {
    return c.json({ message: "User not found." }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
    },
  });
};
