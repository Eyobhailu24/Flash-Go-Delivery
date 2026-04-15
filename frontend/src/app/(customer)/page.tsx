"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { MapPin, ShoppingCart, Star } from "lucide-react";
import { CustomerHeroSection } from "@/components/customer/customer-hero-section";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";

type Category = {
  id: string;
  label: string;
  icon: string;
};

type MenuItem = {
  id: string;
  title: string;
  price: number;
  imageTone: string;
  categoryId: string;
};

type Restaurant = {
  id: string;
  name: string;
  rating: number;
  location: string;
};

const categories: Category[] = [
  { id: "all", label: "All Menu", icon: "🍽️" },
  { id: "sushi", label: "Sushi", icon: "🍣" },
  { id: "pizza", label: "Pizza", icon: "🍕" },
  { id: "chicken", label: "Chicken", icon: "🍗" },
  { id: "ramen", label: "Ramen", icon: "🍜" },
  { id: "burger", label: "Burger", icon: "🍔" },
  { id: "salad", label: "Salad", icon: "🥗" },
];

const menuItems: MenuItem[] = [
  {
    id: "m1",
    title: "Cheese Burger with Extra Beef",
    price: 15,
    imageTone: "from-orange-100 via-amber-100 to-orange-200",
    categoryId: "burger",
  },
  {
    id: "m2",
    title: "Steak Tenderloin & French Fries",
    price: 40,
    imageTone: "from-amber-100 via-orange-100 to-orange-200",
    categoryId: "chicken",
  },
  {
    id: "m3",
    title: "Japanese Oriental Ramen",
    price: 25.5,
    imageTone: "from-yellow-100 via-amber-100 to-orange-200",
    categoryId: "ramen",
  },
  {
    id: "m4",
    title: "Chicken Katsu Teriyaki Sauce",
    price: 20,
    imageTone: "from-orange-100 via-amber-100 to-yellow-100",
    categoryId: "chicken",
  },
  {
    id: "m5",
    title: "Spicy Tuna Sushi Roll",
    price: 18,
    imageTone: "from-rose-100 via-orange-100 to-amber-100",
    categoryId: "sushi",
  },
  {
    id: "m6",
    title: "Crispy Caesar Salad",
    price: 14,
    imageTone: "from-lime-100 via-amber-100 to-orange-100",
    categoryId: "salad",
  },
];

const restaurants: Restaurant[] = [
  { id: "r1", name: "Burger Gudd", rating: 4.6, location: "Purwokerto Selatan" },
  { id: "r2", name: "Chicken Hop", rating: 4.8, location: "Purwokerto Barat" },
  { id: "r3", name: "Fire Burg", rating: 4.5, location: "Purwokerto Utara" },
];

export default function CustomerHomePage() {
  const { user, isReady } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [activeRestaurantIndex, setActiveRestaurantIndex] = useState(0);
  const menuScrollRef = useRef<HTMLDivElement | null>(null);
  const restaurantScrollRef = useRef<HTMLDivElement | null>(null);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  const firstName = user?.fullName?.split(" ")[0] ?? "Guest";
  const userAddress =
    (user as { address?: string } | null)?.address?.trim() || "Purwokerto Selatan";
  const filteredMenu =
    selectedCategory === "all"
      ? menuItems
      : menuItems.filter((item) => item.categoryId === selectedCategory);

  const handleMenuScroll = () => {
    if (!menuScrollRef.current) return;
    const firstCard = menuScrollRef.current.querySelector<HTMLElement>("[data-menu-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    const nextIndex = Math.round(menuScrollRef.current.scrollLeft / cardWidth);
    setActiveMenuIndex(Math.max(0, Math.min(filteredMenu.length - 1, nextIndex)));
  };

  const scrollToMenuCard = (index: number) => {
    if (!menuScrollRef.current) return;
    const firstCard = menuScrollRef.current.querySelector<HTMLElement>("[data-menu-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    menuScrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: "smooth",
    });
    setActiveMenuIndex(index);
  };

  const handleRestaurantScroll = () => {
    if (!restaurantScrollRef.current) return;
    const firstCard = restaurantScrollRef.current.querySelector<HTMLElement>("[data-restaurant-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    const nextIndex = Math.round(restaurantScrollRef.current.scrollLeft / cardWidth);
    setActiveRestaurantIndex(Math.max(0, Math.min(restaurants.length - 1, nextIndex)));
  };

  const scrollToRestaurantCard = (index: number) => {
    if (!restaurantScrollRef.current) return;
    const firstCard = restaurantScrollRef.current.querySelector<HTMLElement>("[data-restaurant-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    restaurantScrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: "smooth",
    });
    setActiveRestaurantIndex(index);
  };

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
      <CustomerTopNavbar firstName={firstName} todayLabel={todayLabel} userAddress={userAddress} />

      <CustomerHeroSection />

      <section className="space-y-4">
        <h2 className="text-[32px] leading-none font-semibold text-gray-900">Categories</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const active = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.id);
                  setActiveMenuIndex(0);
                  if (menuScrollRef.current) {
                    menuScrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
                  }
                }}
                className={`group relative flex min-w-24 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-2xl border-none p-4 text-sm shadow-md transition-all duration-300 ${
                  active
                    ? "bg-primary text-white shadow-lg shadow-orange-500/30"
                    : "bg-card text-gray-500 hover:-translate-y-1 hover:bg-orange-50 hover:shadow-lg hover:shadow-orange-100/70"
                }`}
              >
                {active && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />}
                <span className="relative z-10 text-2xl transition-transform duration-300 group-hover:scale-110">{category.icon}</span>
                <span className="relative z-10 font-medium tracking-tight">{category.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[32px] leading-none font-semibold text-gray-900">Menu</h2>
          <Button variant="link" className="px-0 font-semibold text-orange-500 hover:text-orange-600">
            View All
          </Button>
        </div>
        <div
          ref={menuScrollRef}
          onScroll={handleMenuScroll}
          className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex snap-x snap-mandatory gap-4">
            {filteredMenu.map((item) => (
              <Card
                key={item.id}
                data-menu-card
                className="group min-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-card shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
              >
                <CardContent className="space-y-3 p-3 lg:p-4">
                  <div
                    className={`relative h-32 overflow-hidden rounded-2xl bg-linear-to-br ${item.imageTone} transition-transform duration-500 group-hover:scale-[1.03]`}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_50%)]" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold tracking-wide text-orange-600 shadow-sm backdrop-blur-sm">
                      <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                      FRESH
                    </div>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight text-gray-800 group-hover:text-gray-900">{item.title}</p>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-lg font-bold text-primary">${item.price.toFixed(2)}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 rounded-full bg-orange-50 text-orange-500 transition-all duration-300 hover:bg-orange-100 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-orange-500/30"
                    >
                      <ShoppingCart className="size-[18px]" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 pt-1">
          {filteredMenu.map((item, index) => {
            const isActive = index === activeMenuIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToMenuCard(index)}
                aria-label={`Go to menu item ${index + 1}`}
                className={`rounded-full border transition-all ${
                  isActive
                    ? "size-4 border-orange-400 bg-orange-400 shadow-sm shadow-orange-200"
                    : "size-3 border-orange-200 bg-orange-50 hover:scale-105 hover:border-orange-300"
                }`}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[32px] leading-none font-semibold text-gray-900">Nearby Restaurant</h2>
          <Button variant="link" className="px-0 font-semibold text-orange-500 hover:text-orange-600">
            View All
          </Button>
        </div>
        <div
          ref={restaurantScrollRef}
          onScroll={handleRestaurantScroll}
          className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex snap-x snap-mandatory gap-4">
            {restaurants.map((restaurant) => (
              <Card
                key={restaurant.id}
                data-restaurant-card
                className="group min-w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-card shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 p-2 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:bg-orange-100 group-hover:shadow-md">
                    <Image src="/flashgo.png" alt={restaurant.name} width={50} height={50} className="rounded-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-gray-800 transition-colors group-hover:text-orange-600">{restaurant.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-500 transition-colors group-hover:bg-amber-100">
                        <Star className="size-3 fill-current" />
                        <span className="text-xs font-bold">{restaurant.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors group-hover:text-gray-700">
                        <MapPin className="size-3.5 text-gray-400" />
                        <span className="truncate max-w-[100px]">{restaurant.location}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 pt-1">
          {restaurants.map((restaurant, index) => {
            const isActive = index === activeRestaurantIndex;
            return (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => scrollToRestaurantCard(index)}
                aria-label={`Go to restaurant ${index + 1}`}
                className={`rounded-full border transition-all ${
                  isActive
                    ? "size-4 border-orange-400 bg-orange-400 shadow-sm shadow-orange-200"
                    : "size-3 border-orange-200 bg-orange-50 hover:scale-105 hover:border-orange-300"
                }`}
              />
            );
          })}
        </div>
      </section>

      {!user && (
        <section className="mt-auto flex flex-wrap gap-3 pt-2">
          <Button asChild className="rounded-xl bg-orange-500 text-white hover:bg-orange-400">
            <Link href="/signup">Sign up</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-orange-200 bg-orange-50 text-orange-500 hover:bg-orange-100"
          >
            <Link href="/login">Log in</Link>
          </Button>
        </section>
      )}

      {user && (
        <section className="mt-auto flex flex-wrap gap-3 pt-2">
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
          >
            <Link href="/change-password">Change password</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200"
          >
            <Link href="/logout">Log out</Link>
          </Button>
        </section>
      )}
    </main>
  );
}
