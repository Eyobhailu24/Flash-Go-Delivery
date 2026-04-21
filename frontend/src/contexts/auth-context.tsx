"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authFetch, readAuthJson } from "@/lib/auth-api";
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  LoginResult,
  ResetPasswordInput,
  SignupInput,
  VerifyOtpInput,
} from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  refreshUser: () => Promise<void>;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  signup: (input: SignupInput) => Promise<{ phoneNumber: string }>;
  verifySignupOtp: (input: VerifyOtpInput) => Promise<void>;
  resendSignupOtp: (phoneNumber: string) => Promise<void>;
  forgotPassword: (phoneNumber: string) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function applyMeResponse(res: Response, setUser: (u: AuthUser | null) => void) {
  if (res.ok) {
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
  } else {
    setUser(null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authFetch("/auth/me");
      await applyMeResponse(res, setUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/auth/me");
        if (!cancelled) {
          await applyMeResponse(res, setUser);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<LoginResult> => {
    const res = await authFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: input.phoneNumber.replace(/\s+/g, ""),
        password: input.password,
      }),
    });
    const data = (await res.json()) as {
      message?: string;
      user?: AuthUser;
      requiresVerification?: boolean;
      phoneNumber?: string;
    };

    if (!res.ok) {
      if (
        res.status === 403 &&
        data.requiresVerification &&
        typeof data.phoneNumber === "string"
      ) {
        setUser(null);
        return {
          requiresVerification: true,
          phoneNumber: data.phoneNumber,
        };
      }
      const msg =
        typeof data.message === "string" ? data.message : "Request failed";
      throw new Error(msg);
    }

    if (!data.user) {
      throw new Error("Login succeeded but user payload is missing.");
    }
    setUser(data.user);
    return { requiresVerification: false, user: data.user };
  }, []);

  const logout = useCallback(async () => {
    try {
      const res = await authFetch("/auth/logout", { method: "POST" });
      await readAuthJson<{ message: string }>(res);
    } finally {
      setUser(null);
    }
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const res = await authFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phoneNumber: input.phoneNumber.replace(/\s+/g, ""),
        password: input.password,
      }),
    });
    const data = await readAuthJson<{ phoneNumber: string }>(res);
    return { phoneNumber: data.phoneNumber };
  }, []);

  const verifySignupOtp = useCallback(async (input: VerifyOtpInput) => {
    const res = await authFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: input.phoneNumber.replace(/\s+/g, ""),
        otp: input.otp.trim(),
      }),
    });
    await readAuthJson<{ message: string }>(res);
  }, []);

  const resendSignupOtp = useCallback(async (phoneNumber: string) => {
    const res = await authFetch("/auth/resend-signup-otp", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: phoneNumber.replace(/\s+/g, ""),
      }),
    });
    await readAuthJson<{ message: string }>(res);
  }, []);

  const forgotPassword = useCallback(async (phoneNumber: string) => {
    const res = await authFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: phoneNumber.replace(/\s+/g, ""),
      }),
    });
    await readAuthJson<{ message: string }>(res);
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordInput) => {
    const res = await authFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: input.phoneNumber.replace(/\s+/g, ""),
        otp: input.otp.trim(),
        newPassword: input.newPassword,
      }),
    });
    await readAuthJson<{ message: string }>(res);
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const res = await authFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    });
    await readAuthJson<{ message: string }>(res);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      refreshUser,
      login,
      logout,
      signup,
      verifySignupOtp,
      resendSignupOtp,
      forgotPassword,
      resetPassword,
      changePassword,
    }),
    [
      user,
      isReady,
      refreshUser,
      login,
      logout,
      signup,
      verifySignupOtp,
      resendSignupOtp,
      forgotPassword,
      resetPassword,
      changePassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
