"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, Sparkles } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminOrderRow } from "@/app/admin/_hooks/use-admin-orders";
import { fetchBusinessOrders } from "@/lib/business-orders-api";
import { AuthApiError } from "@/lib/auth-api";
import { formatBirr } from "@/lib/currency";

function statusBadge(status: AdminOrderRow["status"]) {
  if (status === "delivered") return "secondary" as const;
  if (status === "cancelled") return "destructive" as const;
  if (status === "in_transit" || status === "awaiting_business")
    return "default" as const;
  return "outline" as const;
}

export default function BusinessOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchBusinessOrders({ limit: 100, offset: 0 });
        if (!cancelled) setOrders(data.orders);
      } catch (e) {
        if (!cancelled && !silent) {
          setOrders([]);
          setError(e instanceof AuthApiError ? e.message : "Could not load orders.");
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => {
      void load(true);
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-orange-100/80 bg-linear-to-br from-orange-50 via-white to-amber-50/40 p-6 shadow-md md:p-8">
        <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-orange-200/35 blur-2xl" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-orange-700 shadow-sm ring-1 ring-orange-100">
            <Sparkles className="size-3.5" />
            Orders from your restaurant
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Orders
          </h1>
          <p className="max-w-xl text-sm text-gray-600">
            New orders appear here after the customer&apos;s 1-minute cancel
            window. Approve or reject from the order detail page.
          </p>
        </div>
      </section>

      {error ? (
        <Card className="rounded-2xl border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5 text-orange-500" />
            Recent orders
          </CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${orders.length} loaded`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl bg-orange-100/50" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No orders yet. When customers order from you, they will show up
              here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(o.createdAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {o.customer?.fullName ?? "—"}
                    </TableCell>
                    <TableCell>{formatBirr(o.totalPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(o.status)} className="capitalize">
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="sm"
                        variant={
                          o.status === "awaiting_business"
                            ? "default"
                            : "outline"
                        }
                        className="rounded-lg"
                      >
                        <Link href={`/business/orders/${o.id}`}>
                          {o.status === "awaiting_business"
                            ? "Review"
                            : "Details"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
