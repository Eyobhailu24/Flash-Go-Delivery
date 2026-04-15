"use client";

import Link from "next/link";
import { Bell, MapPin, ShoppingCart } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type CustomerTopNavbarProps = {
  firstName: string;
  todayLabel: string;
  userAddress: string;
};

export function CustomerTopNavbar({
  firstName,
  todayLabel,
  userAddress,
}: CustomerTopNavbarProps) {
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
        <div className="hidden text-right md:block">
          <p className="text-sm font-semibold text-gray-900">Hello, {firstName}</p>
          <p className="text-xs text-gray-500">{todayLabel}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border-0 bg-white shadow-sm hover:bg-orange-50"
          aria-label="Cart"
        >
          <ShoppingCart className="size-5 text-gray-500" />
        </Button>
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
            <DropdownMenuItem asChild className="focus:bg-orange-50 focus:text-orange-700">
              <Link href="/logout">Logout</Link>
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
