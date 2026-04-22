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
import { AuthApiError } from "@/lib/auth-api";

const PASSWORD_MIN = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { resetPassword, user, isReady } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (otp.trim().length < 4) {
      setError("Enter the reset code from your SMS.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({
        phoneNumber: phone,
        otp: otp.trim(),
        newPassword,
      });
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

  return (
    <div className="space-y-8">
      <AuthBrand />

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Use the code we sent after &quot;Forgot password&quot; and choose a new password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <EthiopiaPhoneField
          id="reset-phone"
          label="Phone number"
          value={phoneNumber}
          onNationalChange={setPhoneNumber}
          disabled={submitting}
          required
        />

        <div className="space-y-2">
          <Label htmlFor="reset-otp">Reset code</Label>
          <Input
            id="reset-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Code from SMS"
            className="h-11"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={submitting}
            required
            minLength={4}
            maxLength={8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-new">New password</Label>
          <Input
            id="reset-new"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            className="h-11"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={PASSWORD_MIN}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="h-11"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={PASSWORD_MIN}
          />
        </div>

        <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
          {submitting ? <Spinner className="size-5" /> : "Update password"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
