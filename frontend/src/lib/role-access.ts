import type { UserRole } from "@/types/auth";

/** UI area aligned with `UserRole`; each maps to one dashboard or the public storefront. */
export type RoleSegment = "customer" | "driver" | "admin" | "business";

/**
 * Whether the current principal may view this UI segment.
 * Guests (`role` null/undefined) may only browse the customer storefront, not staff dashboards.
 */
export function userMayAccessSegment(
  role: string | null | undefined,
  segment: RoleSegment,
): boolean {
  if (segment === "customer") {
    if (!role) return true;
    return role === "customer";
  }
  if (!role) return false;
  return role === segment;
}

/** Default landing path after login or when redirecting away from a forbidden segment. */
export function defaultHomePathForRole(role: UserRole | string | null | undefined): string {
  if (role === "driver") return "/delivery-man";
  if (role === "business") return "/business";
  if (role === "admin") return "/admin";
  return "/";
}
