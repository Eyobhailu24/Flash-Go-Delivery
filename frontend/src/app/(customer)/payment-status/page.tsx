"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentStatusPage() {
  const params = useSearchParams();
  const status = params.get("status");
  const txRef = params.get("tx_ref");
  const method = params.get("method");
  const orderId = params.get("order_id");

  const isSuccess = status === "success";
  const title = isSuccess ? "Payment successful" : "Payment failed";
  const description = useMemo(() => {
    if (isSuccess) {
      return method === "cash"
        ? "Your order is confirmed. Please prepare cash for delivery."
        : "Your Telebirr payment was verified successfully.";
    }
    return "We could not verify your payment. You can retry from checkout.";
  }, [isSuccess, method]);

  return (
    <main className="customer-app flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg rounded-2xl border-none bg-card shadow-md">
        <CardHeader className="items-center text-center">
          <div
            className={`mb-2 rounded-full p-3 ${
              isSuccess ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="size-7 text-green-600" />
            ) : (
              <CircleAlert className="size-7 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl text-gray-900">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600">{description}</p>
          {orderId ? (
            <p className="text-xs text-gray-500">Order ID: {orderId}</p>
          ) : null}
          {txRef ? (
            <p className="text-xs text-gray-500">Transaction Ref: {txRef}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isSuccess && orderId ? (
              <Button
                asChild
                className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              >
                <Link href={`/track-order/${encodeURIComponent(orderId)}`}>
                  Track your order
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              className={
                isSuccess && orderId
                  ? "rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  : "rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              }
              variant={isSuccess && orderId ? "outline" : "default"}
            >
              <Link href="/menu">Back to menu</Link>
            </Button>
            {!isSuccess ? (
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              >
                <Link href="/checkout">Open checkout</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
