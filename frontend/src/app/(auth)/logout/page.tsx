"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";

export default function LogoutPage() {
  const router = useRouter();
  const { logout, isReady } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!isReady || ran.current) return;
    ran.current = true;

    void (async () => {
      await logout();
      router.replace("/login");
    })();
  }, [isReady, logout, router]);

  return (
    <div className="space-y-8">
      <AuthBrand />
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
        <Spinner className="size-10 text-primary" />
        <p className="text-sm text-muted-foreground">Signing you out…</p>
      </div>
    </div>
  );
}
