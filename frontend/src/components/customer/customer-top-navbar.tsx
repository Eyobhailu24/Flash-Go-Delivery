"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, MapPin, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { CartItemView } from "@/app/(customer)/_hooks/use-carts";
import { catalogItemImageUrl } from "@/lib/admin-catalog-api";
import { formatBirr } from "@/lib/currency";

type CustomerTopNavbarProps = {
  firstName: string;
  todayLabel: string;
  userAddress: string;
  cartItems?: CartItemView[];
  cartTotalQuantity?: number;
  cartSubtotal?: string;
  cartLoading?: boolean;
};

export function CustomerTopNavbar({
  firstName,
  todayLabel,
  userAddress,
  cartItems = [],
  cartTotalQuantity = 0,
  cartSubtotal = "0.00",
  cartLoading = false,
}: CustomerTopNavbarProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="flex items-center gap-3 pt-2">
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder="Search something"
          className="h-11 w-full max-w-[240px] rounded-full border-0 bg-orange-50 px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-0 md:max-w-[320px]"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Button
          asChild
          variant="outline"
          className="hidden h-11 rounded-xl border-0 bg-orange-500 px-4 text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-orange-400 md:inline-flex"
        >
          <Link href="/orders">Track Order</Link>
        </Button>
        <div className="hidden h-11 items-center gap-1 rounded-full border-0 bg-orange-50 px-4 text-sm text-gray-500 shadow-sm md:flex">
          <MapPin className="size-4" />
          <span className="max-w-[200px] truncate">{userAddress}</span>
        </div>
        <Popover open={isCartOpen} onOpenChange={setIsCartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full border-0 bg-white shadow-sm hover:bg-orange-50"
              aria-label="Cart"
              onMouseEnter={() => setIsCartOpen(true)}
              onMouseLeave={() => setIsCartOpen(false)}
              onClick={() => router.push("/checkout")}
            >
              <ShoppingCart className="size-5 text-gray-500" />
              {cartTotalQuantity > 0 ? (
                <Badge className="absolute -top-1 -right-1 min-w-5 rounded-full bg-orange-500 px-1.5 text-[10px] leading-5 text-white">
                  {cartTotalQuantity}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 rounded-2xl border-none bg-white p-0 shadow-xl shadow-orange-100/70"
            onMouseEnter={() => setIsCartOpen(true)}
            onMouseLeave={() => setIsCartOpen(false)}
          >
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  Your Cart
                </p>
                <p className="text-xs text-gray-500">
                  {cartTotalQuantity} items
                </p>
              </div>
              {cartLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 rounded-xl bg-orange-100/60" />
                  <Skeleton className="h-14 rounded-xl bg-orange-100/60" />
                </div>
              ) : cartItems.length === 0 ? (
                <div className="rounded-xl bg-orange-50 px-3 py-6 text-center text-sm text-gray-500">
                  Your cart is empty. Add delicious items to get started.
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl bg-orange-50 p-2"
                    >
                      <div className="size-11 overflow-hidden rounded-lg bg-orange-100">
                        {catalogItemImageUrl(item.itemImagePath) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={catalogItemImageUrl(item.itemImagePath) ?? ""}
                            alt={item.itemName}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {item.itemName}
                        </p>
                        <p className="text-xs text-gray-500">
                          x{item.quantity} · {formatBirr(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-orange-100 pt-2">
                <p className="text-sm font-semibold text-gray-800">
                  Subtotal
                </p>
                <p className="text-base font-bold text-orange-500">
                  {formatBirr(cartSubtotal)}
                </p>
              </div>
              <Button
                type="button"
                className="h-10 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                onClick={() => router.push("/checkout")}
              >
                Go to checkout
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="hidden text-right md:block">
          <p className="text-sm font-semibold text-gray-900">Hello, {firstName}</p>
          <p className="text-xs text-gray-500">{todayLabel}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full transition hover:opacity-90">
              <Avatar size="lg" className="border-0 shadow-sm">
                <AvatarFallback className="bg-orange-100 font-semibold text-orange-700">
                  {firstName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl border-0 shadow-md">
            <DropdownMenuItem asChild className="focus:bg-orange-50 focus:text-orange-700">
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="focus:bg-orange-50 focus:text-orange-700"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border-0 bg-white shadow-sm hover:bg-orange-50"
        >
          <Bell className="size-5 text-gray-500" />
          <Badge className="absolute -top-1 -right-1 min-w-5 rounded-full bg-orange-500 px-1.5 text-[10px] leading-5 text-white">
            7
          </Badge>
        </Button>
      </div>
    </header>
  );
}
