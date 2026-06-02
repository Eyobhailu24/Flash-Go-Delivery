"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

type DeliveryTopNavbarProps = {
  firstName: string;
  statusLabel?: string;
};

export function DeliveryTopNavbar({
  firstName,
  statusLabel = "Driver mode",
}: DeliveryTopNavbarProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="flex items-center gap-2">
        <Link
          href="/delivery-man"
          className="shrink-0 rounded-xl p-1 transition hover:scale-[1.02]"
          aria-label="Go to delivery dashboard"
        >
          <Image
            src="/flashlogo.png"
            alt="FlashGo"
            width={150}
            height={60}
            className="h-11 w-auto object-contain md:h-12"
            priority
          />
        </Link>
        <span className="hidden rounded-full bg-orange-50 px-3 py-2 text-xs text-gray-500 shadow-sm sm:inline-flex">
          {statusLabel}
        </span>
      </div>
      <div
        onMouseEnter={() => setIsProfileMenuOpen(true)}
        onMouseLeave={() => setIsProfileMenuOpen(false)}
      >
        <DropdownMenu
          open={isProfileMenuOpen}
          onOpenChange={setIsProfileMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full transition hover:opacity-90"
            >
              <Avatar size="lg" className="border-0 shadow-sm">
                <AvatarFallback className="bg-orange-100 font-semibold text-orange-700">
                  {firstName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 rounded-xl border-0 shadow-md"
          >
            <DropdownMenuItem
              asChild
              className="focus:bg-orange-50 focus:text-orange-700"
            >
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="focus:bg-orange-50 focus:text-orange-700"
            >
              <Link href="/notifications">Notifications</Link>
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
      </div>
    </header>
  );
}
