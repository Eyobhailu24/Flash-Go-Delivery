"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EthiopiaPhoneField } from "@/components/auth/ethiopia-phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toEthiopiaE164 } from "@/lib/ethiopia-phone";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { defaultHomePathForRole } from "@/lib/role-access";
import { AuthApiError } from "@/lib/auth-api";

const PASSWORD_MIN = 8;

export default function SignupPage() {
  const router = useRouter();
  const { signup, user, isReady } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
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

    const name = fullName.trim();
    if (name.length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    const mail = email.trim().toLowerCase();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Enter a valid email address.");
      return;
    }

    const phone = toEthiopiaE164(phoneNumber);
    if (!phone) {
      setError("Enter all nine digits of your mobile number after +251 (e.g. 7xx or 9xx).");
      return;
    }

    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreed) {
      setError("Please agree to the terms and policy to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const { phoneNumber: normalized } = await signup({
        fullName: name,
        email: mail,
        phoneNumber: phone,
        password,
      });
      router.push(`/verify-otp?phone=${encodeURIComponent(normalized)}`);
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
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Sign up with your name, email, and phone. We&apos;ll text you a code to verify your number.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="signup-name">Full name</Label>
          <Input
            id="signup-name"
            name="fullName"
            autoComplete="name"
            placeholder="Full name"
            className="h-11"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <EthiopiaPhoneField
          id="signup-phone"
          label="Phone number"
          name="phoneNumber"
          value={phoneNumber}
          onNationalChange={setPhoneNumber}
          disabled={submitting}
          required
        />

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={PASSWORD_MIN}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <Input
            id="signup-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            className="h-11"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={PASSWORD_MIN}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="signup-terms"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            disabled={submitting}
          />
          <Label htmlFor="signup-terms" className="text-sm font-normal text-muted-foreground">
            Agree to terms &amp; policy
          </Label>
        </div>

        <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
          {submitting ? <Spinner className="size-5" /> : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
