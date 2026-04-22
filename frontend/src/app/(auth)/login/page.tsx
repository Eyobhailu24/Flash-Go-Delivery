"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EthiopiaPhoneField } from "@/components/auth/ethiopia-phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toEthiopiaE164 } from "@/lib/ethiopia-phone";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { defaultHomePathForRole } from "@/lib/role-access";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isReady } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && user) {
      router.replace(defaultHomePathForRole(user.role));
    }
  }, [isReady, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phone = toEthiopiaE164(phoneNumber);
    if (!phone) {
      setError("Enter all nine digits of your mobile number after +251 (e.g. 7xx or 9xx).");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await login({ phoneNumber: phone, password });
      if (result.requiresVerification) {
        router.push(
          `/verify-otp?phone=${encodeURIComponent(result.phoneNumber)}`,
        );
        return;
      }
      router.replace(defaultHomePathForRole(result.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AuthBrand />

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Log in to your account</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Sign in with your phone number and password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <EthiopiaPhoneField
          id="login-phone"
          label="Phone number"
          name="phoneNumber"
          value={phoneNumber}
          onNationalChange={setPhoneNumber}
          disabled={submitting}
          required
        />

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
          {submitting ? <Spinner className="size-5" /> : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
