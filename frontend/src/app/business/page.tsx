"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Package,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/hooks/use-notifications";
import { fetchProductCategories } from "@/lib/admin-catalog-api";
import { fetchBusinessProfileById } from "@/lib/admin-business-api";
import { fetchBusinessOrders } from "@/lib/business-orders-api";
import { AuthApiError } from "@/lib/auth-api";

export default function BusinessDashboardPage() {
  const { user } = useAuth();
  const { notifications, loadNotifications } = useNotifications();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const unread = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    void loadNotifications({ limit: 50 });
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [profile, cats, orders] = await Promise.all([
          fetchBusinessProfileById(user.id).catch(() => null),
          fetchProductCategories(user.id, { limit: 200, offset: 0 }).catch(
            () => null,
          ),
          fetchBusinessOrders({ limit: 200, offset: 0 }).catch(() => null),
        ]);
        if (cancelled) return;
        setProfileName(profile?.businessName ?? null);
        setCategoryCount(cats?.categories.length ?? 0);
        setOrderCount(orders?.orders.length ?? 0);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof AuthApiError) {
            /* handled per-request */
          }
          setProfileName(null);
          setCategoryCount(null);
          setOrderCount(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const displayName = profileName ?? user?.fullName ?? "Your business";

  return (
    <main className="flex w-full flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl border border-orange-100/80 bg-linear-to-br from-orange-50 via-white to-amber-50/40 p-6 shadow-md shadow-orange-100/50 md:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-orange-200/35 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 size-36 rounded-full bg-amber-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-orange-700 shadow-sm ring-1 ring-orange-100">
              <Sparkles className="size-3.5" />
              Partner hub
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              Welcome back, {displayName}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-gray-600 md:text-base">
              Manage your menu, track orders from customers, and keep your
              storefront profile polished — all in one place.
            </p>
          </div>
          <Button
            asChild
            className="h-11 shrink-0 rounded-xl bg-orange-500 px-6 text-white shadow-md hover:bg-orange-400"
          >
            <Link href="/business/categories">
              Manage categories
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="size-5 text-orange-500" />
              Categories
            </CardTitle>
            <CardDescription>Product groups on your menu</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-16 rounded-lg bg-orange-100/60" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900">
                {categoryCount ?? "—"}
              </p>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/business/categories">Open</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-5 text-orange-500" />
              Orders
            </CardTitle>
            <CardDescription>Recent activity from customers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-16 rounded-lg bg-orange-100/60" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900">
                {orderCount ?? "—"}
              </p>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/business/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-orange-500" />
              Alerts
            </CardTitle>
            <CardDescription>Unread notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-semibold text-gray-900">{unread}</p>
              {unread > 0 ? (
                <Badge className="rounded-full bg-orange-500 text-white">
                  New
                </Badge>
              ) : null}
            </div>
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/business/notifications">Open inbox</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-orange-100/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Profile & location</CardTitle>
            <CardDescription>
              Update your business name, address, and map pin so customers find
              you easily.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-xl bg-orange-500 text-white hover:bg-orange-400">
              <Link href="/business/account">
                <UserRound className="mr-2 size-4" />
                Edit account
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-orange-100/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Menu items</CardTitle>
            <CardDescription>
              Pick a category, then add dishes with photos, prices, and
              availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="rounded-xl border-orange-200">
              <Link href="/business/categories">Go to categories</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
