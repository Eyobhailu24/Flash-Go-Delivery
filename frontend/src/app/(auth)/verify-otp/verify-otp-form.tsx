"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { AuthApiError } from "@/lib/auth-api";

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone")?.trim() ?? "";
  const normalizedPhone = phoneParam.replace(/\s+/g, "");

  const { verifySignupOtp, user, isReady } = useAuth();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && user) {
      router.replace("/");
    }
  }, [isReady, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (normalizedPhone.length < 8) {
      setError("Invalid phone. Start again from sign up.");
      return;
    }
    const code = otp.trim();
    if (code.length < 4) {
      setError("Enter the code we sent to your phone.");
      return;
    }
    setSubmitting(true);
    try {
      await verifySignupOtp({ phoneNumber: normalizedPhone, otp: code });
      router.push("/login");
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Something went wrong.");
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

  if (normalizedPhone.length < 8) {
    return (
      <div className="space-y-6">
        <AuthBrand />
        <Alert variant="destructive">
          <AlertDescription>
            Missing or invalid phone number. Please{" "}
            <Link href="/signup" className="font-medium underline">
              sign up
            </Link>{" "}
            again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AuthBrand />

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Verify your phone</h1>
        <p className="text-sm text-muted-foreground">
          Enter the OTP we sent to <span className="font-medium text-foreground">{phoneParam}</span>.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="verify-otp">One-time code</Label>
          <Input
            id="verify-otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter code"
            className="h-11"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={submitting}
            maxLength={8}
            required
            minLength={4}
          />
        </div>

        <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
          {submitting ? <Spinner className="size-5" /> : "Verify & continue"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Wrong number?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Go back
        </Link>
      </p>
    </div>
  );
}
