"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { catalogItemImageUrl, type CategoryItem } from "@/lib/admin-catalog-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type CustomerMenuSectionProps = {
  menuItems: CategoryItem[];
  isLoading: boolean;
};

export function CustomerMenuSection({ menuItems, isLoading }: CustomerMenuSectionProps) {
  const menuScrollRef = useRef<HTMLDivElement | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const displayedMenuItems = menuItems.slice(0, 20);
  const menuCardsCount = displayedMenuItems.length + 1;

  const handleMenuScroll = () => {
    if (!menuScrollRef.current) return;
    const firstCard = menuScrollRef.current.querySelector<HTMLElement>("[data-menu-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    const nextIndex = Math.round(menuScrollRef.current.scrollLeft / cardWidth);
    setActiveMenuIndex(Math.max(0, Math.min(menuCardsCount - 1, nextIndex)));
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[32px] leading-none font-semibold text-gray-900">Menu</h2>
        <Button asChild variant="link" className="px-0 font-semibold text-orange-500 hover:text-orange-600">
          <Link href="/menu">View All</Link>
        </Button>
      </div>
      <div
        ref={menuScrollRef}
        onScroll={handleMenuScroll}
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex snap-x snap-mandatory gap-4">
          {displayedMenuItems.map((item) => (
            <Card
              key={item.id}
              data-menu-card
              className="group min-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-card shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
            >
              <CardContent className="space-y-3 p-3 lg:p-4">
                <div className="relative h-32 overflow-hidden rounded-2xl bg-linear-to-br from-orange-100 via-amber-100 to-orange-200 transition-transform duration-500 group-hover:scale-[1.03]">
                  {catalogItemImageUrl(item.imagePath) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={catalogItemImageUrl(item.imagePath) ?? ""}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_50%)]" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold tracking-wide text-orange-600 shadow-sm backdrop-blur-sm">
                    <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                    FRESH
                  </div>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight text-gray-800 group-hover:text-gray-900">
                  {item.name}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-lg font-bold text-primary">${Number(item.price).toFixed(2)}</p>
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
          <Card
            data-menu-card
            className="min-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-orange-500 text-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:bg-orange-400 hover:shadow-xl hover:shadow-orange-200/70"
          >
            <CardContent className="flex h-full min-h-[184px] flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-xl font-bold">View All Menu</p>
              <Button asChild className="rounded-xl bg-white text-orange-500 hover:bg-orange-50">
                <Link href="/menu">View All</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-center gap-3 pt-1">
        {Array.from({ length: menuCardsCount }).map((_, index) => {
          const isActive = index === activeMenuIndex;
          return (
            <button
              key={`menu-dot-${index}`}
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
  );
}
