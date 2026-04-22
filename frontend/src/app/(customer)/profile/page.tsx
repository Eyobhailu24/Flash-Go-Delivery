"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EthiopiaPhoneField } from "@/components/auth/ethiopia-phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  nationalDigitsFromStoredPhone,
  toEthiopiaE164,
} from "@/lib/ethiopia-phone";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { authFetch, readAuthJson } from "@/lib/auth-api";
import { useCarts } from "../_hooks/use-carts";
import { useLiveAddress } from "../_hooks/use-live-address";
import { useNotifications } from "@/hooks/use-notifications";

export default function CustomerProfilePage() {
  const { user, isReady, refreshUser, changePassword } = useAuth();
  const {
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();
  const { liveAddress, loading: loadingLiveAddress } = useLiveAddress();

  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const firstName = user?.fullName?.split(" ")[0] ?? "Guest";
  const profileAddress =
    (user as { address?: string } | null)?.address?.trim() || "";
  const userAddress = loadingLiveAddress
    ? "Detecting location..."
    : liveAddress || profileAddress || "Purwokerto Selatan";

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  useEffect(() => {
    void loadNotifications({ limit: 50 });
  }, [loadNotifications]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmail(user.email);
    setPhoneNumber(nationalDigitsFromStoredPhone(user.phoneNumber));
  }, [user]);

  const saveAccount = async () => {
    setSavingAccount(true);
    setError(null);
    const fullPhone = toEthiopiaE164(phoneNumber);
    if (!fullPhone) {
      setError("Enter all nine digits of your mobile number after +251 (e.g. 7xx or 9xx).");
      setSavingAccount(false);
      return;
    }
    try {
      const response = await authFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: fullPhone,
        }),
      });
      await readAuthJson<{ user: { id: string } }>(response);
      await refreshUser();
      toast.success("Account credentials updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save account.");
    } finally {
      setSavingAccount(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    setError(null);
    try {
      await changePassword({
        currentPassword: currentPassword.trim(),
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
      <CustomerTopNavbar
        firstName={firstName}
        todayLabel={todayLabel}
        userAddress={userAddress}
        cartItems={cartItemsView}
        cartTotalQuantity={activeCartSummary?.totalQuantity ?? 0}
        cartSubtotal={activeCartSummary?.subtotal ?? "0.00"}
        cartLoading={cartLoading}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        notificationUnreadCount={notificationUnreadCount}
      />

      <section className="space-y-2">
        <h1 className="text-[32px] leading-none font-semibold text-gray-900">
          Profile settings
        </h1>
        <p className="text-sm text-gray-500">
          Update your account credentials and password.
        </p>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-800">Account credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <EthiopiaPhoneField
              id="phone"
              label="Phone number"
              value={phoneNumber}
              onNationalChange={setPhoneNumber}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => void saveAccount()}
                disabled={savingAccount}
              >
                {savingAccount ? "Saving..." : "Save credentials"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-800">Change password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              type="button"
              className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              onClick={() => void savePassword()}
              disabled={savingPassword}
            >
              {savingPassword ? "Saving..." : "Update password"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
