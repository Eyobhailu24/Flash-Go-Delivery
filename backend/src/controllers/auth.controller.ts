import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import argon2 from 'argon2';
import {
  deleteCookie,
  setCookie,
} from 'hono/cookie';
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { issueMobileSession, readAccessPayload, rotateMobileSession, revokeMobileSession } from '../lib/mobile-auth.js';
import {
  ETHIOPIA_PHONE_E164,
  normalizePhone,
} from '../lib/ethiopia-phone.js';
import {
  customerProfile,
  mobileSessions,
  otpVerifications,
  users,
} from '../schema.js';

const ethiopiaPhoneSchema = z
  .string()
  .trim()
  .transform((s) => normalizePhone(s))
  .pipe(
    z.string().regex(ETHIOPIA_PHONE_E164, {
      message:
        'Invalid Ethiopian phone number. Use +251 followed by nine digits (e.g. 7xx or 9xx).',
    }),
  );

const signupSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phoneNumber: ethiopiaPhoneSchema,
  password: z
    .string()
    .min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

const verifyOtpSchema = z.object({
  phoneNumber: ethiopiaPhoneSchema,
  otp: z.string().trim().min(4).max(8),
});

const loginSchema = z.object({
  phoneNumber: ethiopiaPhoneSchema,
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  phoneNumber: ethiopiaPhoneSchema,
});

const resetPasswordSchema = z.object({
  phoneNumber: ethiopiaPhoneSchema,
  otp: z.string().trim().min(4).max(8),
  newPassword: z
    .string()
    .min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(Number(process.env.PASSWORD_MIN_LENGTH ?? 8)),
});

const updateMeSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  phoneNumber: z.string().trim().optional(),
});

const upsertMyCustomerProfileSchema = z
  .object({
    addresses: z
      .array(
        z.object({
          label: z.string().optional(),
          address: z.string().trim().min(1),
          lat: z.number().optional(),
          lng: z.number().optional(),
          isDefault: z.boolean().optional(),
        }),
      )
      .optional(),
    preferences: z
      .record(z.string(), z.unknown())
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

type OtpPurpose = 'signup_verification' | 'reset_password';

type AccessPayload = {
  sub: string;
  role: string;
  phoneNumber: string;
};

const accessSecret =
  process.env.JWT_ACCESS_SECRET ??
  'change-me-access-secret';
const refreshSecret =
  process.env.JWT_REFRESH_SECRET ??
  'change-me-refresh-secret';
const accessExpiry =
  process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const refreshExpiry =
  process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

const cookieSecure =
  (process.env.COOKIE_SECURE ?? 'false') === 'true';
const otpLength = Number(process.env.OTP_LENGTH ?? 6);
const otpExpiryMinutes = Number(
  process.env.OTP_EXPIRY_MINUTES ?? 5,
);
const otpMaxAttempts = Number(
  process.env.OTP_MAX_ATTEMPTS ?? 5,
);
const otpResendCooldownSeconds = Number(
  process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 45,
);
const otpTemplate =
  process.env.AFRO_SMS_TEMPLATE_OTP ??
  'Your FlashGo OTP is {{CODE}}. It expires in {{MINUTES}} minutes.';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseDurationToSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 15 * 60;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 3600;
  return value * 86400;
}

function getSameSite(): 'Lax' | 'Strict' | 'None' {
  const raw = (
    process.env.COOKIE_SAME_SITE ?? 'lax'
  ).toLowerCase();
  if (raw === 'strict') return 'Strict';
  if (raw === 'none') return 'None';
  return 'Lax';
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

function generateOtp(): string {
  const min = 10 ** (otpLength - 1);
  const max = 10 ** otpLength;
  return String(randomInt(min, max));
}

async function sendOtpSms(
  phoneNumber: string,
  otp: string,
): Promise<void> {
  const message = otpTemplate
    .replace('{{CODE}}', otp)
    .replace('{{MINUTES}}', String(otpExpiryMinutes));

  if ((process.env.OTP_DEBUG_LOG ?? 'true') === 'true') {
    console.log(`[OTP-DEBUG] ${phoneNumber} -> ${otp}`);
  }

  if ((process.env.OTP_BYPASS ?? 'false') === 'true') {
    return;
  }

  const baseUrl = process.env.AFRO_SMS_BASE_URL;
  const apiKey = process.env.AFRO_SMS_API_KEY;
  if (!baseUrl || !apiKey || apiKey.includes('change-me')) {
    throw new Error('Afro SMS is not configured.');
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/challenge/send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.AFRO_SMS_SENDER_ID ?? 'FlashGo',
        to: phoneNumber,
        message,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Afro SMS failed: ${response.status} ${body}`,
    );
  }
}

async function createOtp(
  phoneNumber: string,
  purpose: OtpPurpose,
): Promise<string> {
  const otp = generateOtp();
  const expiresAt = new Date(
    Date.now() + otpExpiryMinutes * 60 * 1000,
  );

  await db
    .update(otpVerifications)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.consumedAt),
      ),
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

async function issueSignupOtpWithCooldown(
  phoneNumber: string,
): Promise<{ sent: boolean; waitSeconds: number }> {
  const latest = await db
    .select({
      createdAt: otpVerifications.createdAt,
    })
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, 'signup_verification'),
      ),
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  const nowMs = Date.now();
  const latestCreatedAt = latest[0]?.createdAt;
  if (latestCreatedAt) {
    const elapsedSeconds = Math.floor(
      (nowMs - latestCreatedAt.getTime()) / 1000,
    );
    if (elapsedSeconds < otpResendCooldownSeconds) {
      return {
        sent: false,
        waitSeconds:
          otpResendCooldownSeconds - elapsedSeconds,
      };
    }
  }

  const otp = await createOtp(
    phoneNumber,
    'signup_verification',
  );
  await sendOtpSms(phoneNumber, otp);
  return { sent: true, waitSeconds: 0 };
}

async function verifyOtp(
  phoneNumber: string,
  purpose: OtpPurpose,
  otp: string,
): Promise<boolean> {
  const row = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.consumedAt),
        gt(otpVerifications.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  const record = row[0];
  if (!record) return false;
  if (record.attemptCount >= record.maxAttempts)
    return false;

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

function setAuthCookies(
  c: Context,
  accessToken: string,
  refreshToken: string,
) {
  const sameSite = getSameSite();
  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite,
    path: '/',
    maxAge: parseDurationToSeconds(accessExpiry),
  });
  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite,
    path: '/',
    maxAge: parseDurationToSeconds(refreshExpiry),
  });
}

const requireAuth = readAccessPayload;

export const refreshMobile = async (c: Context) => {
  const body = z.object({ refreshToken: z.string().min(32).max(512) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ message: 'Invalid refresh token.' }, 400);
  const tokens = await rotateMobileSession(body.data.refreshToken);
  if (!tokens) return c.json({ message: 'Session expired. Please sign in again.' }, 401);
  c.header('Cache-Control', 'no-store');
  return c.json(tokens);
};

export const logoutMobile = async (c: Context) => {
  const body = z.object({ refreshToken: z.string().min(32).max(512) }).safeParse(await c.req.json().catch(() => null));
  if (body.success) await revokeMobileSession(body.data.refreshToken);
  return c.json({ message: 'Logged out successfully.' });
};

export const signup = async (c: Context) => {
  const parsed = signupSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const fullName = parsed.data.fullName.trim();
  const email = normalizeEmail(parsed.data.email);
  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const passwordHash = await argon2.hash(
    parsed.data.password,
  );

  const existing = await db
    .select({
      id: users.id,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (existing[0]?.isVerified) {
    return c.json(
      { message: 'Phone number is already registered.' },
      409,
    );
  }

  const emailOwner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const emailTakenByOther =
    emailOwner[0] &&
    (!existing[0] || emailOwner[0].id !== existing[0].id);
  if (emailTakenByOther) {
    return c.json(
      { message: 'Email is already registered.' },
      409,
    );
  }

  if (!existing[0]) {
    await db.insert(users).values({
      fullName,
      email,
      phoneNumber,
      passwordHash,
      role: 'customer',
      isVerified: false,
    });
  } else {
    await db
      .update(users)
      .set({
        fullName,
        email,
        passwordHash,
        role: 'customer',
      })
      .where(eq(users.id, existing[0].id));
  }

  await issueSignupOtpWithCooldown(phoneNumber);

  return c.json({
    message: 'Signup started. OTP sent to phone number.',
    phoneNumber,
  });
};

export const verifySignupOtp = async (c: Context) => {
  const parsed = verifyOtpSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const ok = await verifyOtp(
    phoneNumber,
    'signup_verification',
    parsed.data.otp.trim(),
  );
  if (!ok) {
    return c.json(
      { message: 'Invalid or expired OTP.' },
      400,
    );
  }

  await db
    .update(users)
    .set({ isVerified: true, verifiedAt: new Date() })
    .where(eq(users.phoneNumber, phoneNumber));

  return c.json({
    message: 'Phone number verified successfully.',
  });
};

export const login = async (c: Context) => {
  const parsed = loginSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const result = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  const user = result[0];
  if (!user)
    return c.json(
      { message: 'Invalid phone number or password.' },
      401,
    );

  const isPasswordValid = await argon2.verify(
    user.passwordHash,
    parsed.data.password,
  );
  if (!isPasswordValid) {
    return c.json(
      { message: 'Invalid phone number or password.' },
      401,
    );
  }

  if (!user.isVerified) {
    const otpResult =
      await issueSignupOtpWithCooldown(phoneNumber);
    return c.json(
      {
        message: otpResult.sent
          ? 'Phone not verified. OTP sent to your phone.'
          : `Phone not verified. OTP was sent recently. Please wait ${otpResult.waitSeconds}s.`,
        requiresVerification: true,
        phoneNumber,
        otpSent: otpResult.sent,
        otpWaitSeconds: otpResult.waitSeconds,
      },
      403,
    );
  }

  if (c.req.path.endsWith('/mobile/login')) {
    if (user.status !== 'active') return c.json({ message: 'This account is not active.' }, 403);
    const tokens = await issueMobileSession({ sub: user.id, role: user.role, phoneNumber: user.phoneNumber ?? '' });
    c.header('Cache-Control', 'no-store');
    return c.json({ ...tokens, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, phoneNumber: user.phoneNumber } });
  }
  const { accessToken, refreshToken } = createTokens({
    sub: user.id,
    role: user.role,
    phoneNumber: user.phoneNumber ?? '',
  });
  setAuthCookies(c, accessToken, refreshToken);

  return c.json({
    message: 'Login successful.',
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
    },
  });
};

export const resendSignupOtp = async (c: Context) => {
  const parsed = forgotPasswordSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const result = await db
    .select({
      id: users.id,
      isVerified: users.isVerified,
    })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);
  const user = result[0];
  if (!user) {
    return c.json({ message: 'User not found.' }, 404);
  }
  if (user.isVerified) {
    return c.json(
      { message: 'Phone number is already verified.' },
      409,
    );
  }

  const otpResult =
    await issueSignupOtpWithCooldown(phoneNumber);
  return c.json({
    message: otpResult.sent
      ? 'OTP sent to your phone.'
      : `OTP was sent recently. Please wait ${otpResult.waitSeconds}s.`,
    phoneNumber,
    otpSent: otpResult.sent,
    otpWaitSeconds: otpResult.waitSeconds,
  });
};

export const changePassword = async (c: Context) => {
  const auth = await requireAuth(c);
  if (!auth)
    return c.json({ message: 'Unauthorized.' }, 401);

  const parsed = changePasswordSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.sub))
    .limit(1);
  const user = result[0];
  if (!user)
    return c.json({ message: 'User not found.' }, 404);

  const matches = await argon2.verify(
    user.passwordHash,
    parsed.data.currentPassword,
  );
  if (!matches) {
    return c.json(
      { message: 'Current password is incorrect.' },
      400,
    );
  }

  const passwordHash = await argon2.hash(
    parsed.data.newPassword,
  );
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user.id));

  // Keep the current session usable after a deliberate change; revoke other devices.
  const sessions = await db.select({ id: mobileSessions.id }).from(mobileSessions).where(eq(mobileSessions.userId, user.id));
  for (const session of sessions) if (session.id !== auth.sid) await db.update(mobileSessions).set({ revokedAt: new Date() }).where(eq(mobileSessions.id, session.id));

  return c.json({
    message: 'Password changed successfully.',
  });
};

export const forgotPassword = async (c: Context) => {
  const parsed = forgotPasswordSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (result[0]) {
    const otp = await createOtp(
      phoneNumber,
      'reset_password',
    );
    await sendOtpSms(phoneNumber, otp);
  }

  return c.json({
    message:
      'If the account exists, a reset OTP has been sent.',
  });
};

export const resetPassword = async (c: Context) => {
  const parsed = resetPasswordSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const phoneNumber = normalizePhone(
    parsed.data.phoneNumber,
  );
  const isOtpValid = await verifyOtp(
    phoneNumber,
    'reset_password',
    parsed.data.otp.trim(),
  );
  if (!isOtpValid) {
    return c.json(
      { message: 'Invalid or expired OTP.' },
      400,
    );
  }

  const passwordHash = await argon2.hash(
    parsed.data.newPassword,
  );
  const changedUsers = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.phoneNumber, phoneNumber)).returning({ id: users.id });
  for (const user of changedUsers) await db.update(mobileSessions).set({ revokedAt: new Date() }).where(eq(mobileSessions.userId, user.id));

  return c.json({ message: 'Password reset successful.' });
};

export const logout = async (c: Context) => {
  const sameSite = getSameSite();
  deleteCookie(c, 'access_token', {
    path: '/',
    secure: cookieSecure,
    sameSite,
  });
  deleteCookie(c, 'refresh_token', {
    path: '/',
    secure: cookieSecure,
    sameSite,
  });
  return c.json({ message: 'Logged out successfully.' });
};

export const me = async (c: Context) => {
  const auth = await requireAuth(c);
  if (!auth) {
    return c.json({ message: 'Unauthorized.' }, 401);
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
    return c.json({ message: 'User not found.' }, 404);
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

export const updateMe = async (c: Context) => {
  const auth = await requireAuth(c);
  if (!auth) {
    return c.json({ message: 'Unauthorized.' }, 401);
  }

  const parsed = updateMeSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return c.json(
      { message: 'At least one field is required.' },
      400,
    );
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.fullName !== undefined) {
    patch.fullName = parsed.data.fullName.trim();
  }
  if (parsed.data.email !== undefined) {
    patch.email = normalizeEmail(parsed.data.email);
  }
  if (parsed.data.phoneNumber !== undefined) {
    const raw = parsed.data.phoneNumber.trim();
    if (!raw) {
      return c.json(
        { message: 'Phone number cannot be empty.' },
        400,
      );
    }
    const normalized = normalizePhone(raw);
    if (!ETHIOPIA_PHONE_E164.test(normalized)) {
      return c.json(
        {
          message:
            'Invalid Ethiopian phone number. Use +251 followed by nine digits (e.g. 7xx or 9xx).',
        },
        400,
      );
    }
    patch.phoneNumber = normalized;
  }

  if (patch.email) {
    const emailOwner = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, patch.email))
      .limit(1);
    if (emailOwner[0] && emailOwner[0].id !== auth.sub) {
      return c.json(
        { message: 'Email is already registered.' },
        409,
      );
    }
  }

  if (patch.phoneNumber) {
    const phoneOwner = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, patch.phoneNumber))
      .limit(1);
    if (phoneOwner[0] && phoneOwner[0].id !== auth.sub) {
      return c.json(
        { message: 'Phone number is already registered.' },
        409,
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, auth.sub))
    .returning({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      phoneNumber: users.phoneNumber,
    });

  if (!updated) {
    return c.json({ message: 'User not found.' }, 404);
  }

  return c.json({ user: updated });
};

export const getMyCustomerProfile = async (c: Context) => {
  const auth = await requireAuth(c);
  if (!auth) {
    return c.json({ message: 'Unauthorized.' }, 401);
  }

  const rows = await db
    .select()
    .from(customerProfile)
    .where(eq(customerProfile.userId, auth.sub))
    .limit(1);

  return c.json({ profile: rows[0] ?? null });
};

export const upsertMyCustomerProfile = async (
  c: Context,
) => {
  const auth = await requireAuth(c);
  if (!auth) {
    return c.json({ message: 'Unauthorized.' }, 401);
  }

  const parsed = upsertMyCustomerProfileSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const existing = await db
    .select({ userId: customerProfile.userId })
    .from(customerProfile)
    .where(eq(customerProfile.userId, auth.sub))
    .limit(1);

  const patch: Partial<
    typeof customerProfile.$inferInsert
  > = {};
  if (parsed.data.addresses !== undefined) {
    patch.addresses = parsed.data.addresses;
  }
  if (parsed.data.preferences !== undefined) {
    patch.preferences = parsed.data.preferences;
  }

  if (existing[0]) {
    const [updated] = await db
      .update(customerProfile)
      .set(patch)
      .where(eq(customerProfile.userId, auth.sub))
      .returning();
    return c.json({ profile: updated });
  }

  const [created] = await db
    .insert(customerProfile)
    .values({
      userId: auth.sub,
      addresses: patch.addresses,
      preferences: patch.preferences,
      loyaltyPoints: 0,
    })
    .returning();
  return c.json({ profile: created }, 201);
};
