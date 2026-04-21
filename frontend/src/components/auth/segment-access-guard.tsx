"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import {
  defaultHomePathForRole,
  userMayAccessSegment,
  type RoleSegment,
} from "@/lib/role-access";

export function SegmentAccessGuard({
  segment,
  children,
}: {
  segment: RoleSegment;
  children: ReactNode;
}) {
  const { user, isReady } = useAuth();
  const router = useRouter();

  const allowed = userMayAccessSegment(user?.role, segment);

  useEffect(() => {
    if (!isReady || allowed) return;

    if (!user) {
      if (segment !== "customer") {
        router.replace("/login");
      }
      return;
    }

    router.replace(defaultHomePathForRole(user.role));
  }, [allowed, isReady, router, segment, user]);

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return children;
}
