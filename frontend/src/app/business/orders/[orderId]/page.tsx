"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { AdminOrderDetail } from "@/app/admin/_hooks/use-admin-orders";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBusinessOrderById } from "@/lib/business-orders-api";
import { AuthApiError } from "@/lib/auth-api";
import { formatBirr } from "@/lib/currency";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BusinessOrderDetailPage() {
  const params = useParams();
  const raw = params.orderId;
  const orderId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const idValid = UUID_RE.test(orderId);

  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idValid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await fetchBusinessOrderById(orderId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setError(
            e instanceof AuthApiError ? e.message : "Could not load order.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, idValid]);

  if (!idValid) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Invalid order</AlertTitle>
        <AlertDescription>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/business/orders">Back to orders</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl bg-orange-100/60" />
        <Skeleton className="h-40 w-full rounded-2xl bg-orange-100/50" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Order</AlertTitle>
        <AlertDescription>{error ?? "Not found."}</AlertDescription>
      </Alert>
    );
  }

  const { order, items, payment, customer, driver } = detail;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="link" className="h-auto w-fit justify-start p-0 text-orange-700" asChild>
        <Link href="/business/orders">
          <ArrowLeft className="mr-1 size-4" />
          All orders
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Order details
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(order.createdAt), "EEEE, MMM d, yyyy · h:mm a")}
        </p>
      </div>

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Status, totals, and payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              {order.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {order.orderType.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Subtotal / fees</p>
              <p className="font-medium">
                Total {formatBirr(order.totalPrice)} · Delivery{" "}
                {formatBirr(order.deliveryFee)} · Service{" "}
                {formatBirr(order.serviceCharge)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment</p>
              <p className="font-medium">
                {payment
                  ? `${payment.method} · ${payment.status} · ${formatBirr(payment.amount)}`
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {customer ? (
            <div>
              <p className="font-semibold">{customer.fullName}</p>
              <p className="text-muted-foreground">{customer.phoneNumber ?? "—"}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      {driver ? (
        <Card className="rounded-2xl border-none shadow-md">
          <CardHeader>
            <CardTitle>Driver</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-semibold">{driver.fullName}</p>
            <p className="text-muted-foreground">{driver.phoneNumber ?? "—"}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>What the customer ordered from you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items.</p>
          ) : (
            items.map((line, i) => (
              <div key={line.id}>
                <div className="flex justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      ×{line.quantity} @ {formatBirr(line.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatBirr(line.lineTotal)}</p>
                </div>
                {i < items.length - 1 ? <Separator className="my-2" /> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
