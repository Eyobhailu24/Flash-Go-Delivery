"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";

export default function CustomerHomePage() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="container flex max-w-lg flex-col gap-8 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Flash Go</h1>
          <p className="text-muted-foreground">
            Fast delivery for food, packages, and more. Browse as a guest, or sign in to order and
            track deliveries.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Create an account or sign in to place orders and manage your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/signup">Sign up</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/login">Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container flex max-w-lg flex-col gap-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            You&apos;re signed in as a {user.role}. This is your customer home.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{user.phoneNumber ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="destructive">
              <Link href="/logout">Log out</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/change-password">Change password</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
