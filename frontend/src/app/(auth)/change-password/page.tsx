"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { AuthApiError } from "@/lib/auth-api";

const PASSWORD_MIN = 8;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword, user, isReady } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`New password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      router.push("/");
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

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AuthBrand />

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.fullName}. Enter your current password and a new one.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="change-current">Current password</Label>
          <Input
            id="change-current"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            className="h-11"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="change-new">New password</Label>
          <Input
            id="change-new"
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
          <Label htmlFor="change-confirm">Confirm new password</Label>
          <Input
            id="change-confirm"
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
          {submitting ? <Spinner className="size-5" /> : "Save new password"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-primary hover:underline">
          Cancel
        </Link>
      </p>
    </div>
  );
}
