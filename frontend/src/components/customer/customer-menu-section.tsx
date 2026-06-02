'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import {
  catalogItemImageUrl,
  type CategoryItem,
} from '@/lib/admin-catalog-api';
import {
  discountLabel,
  formatBirr,
  formatDiscountedBirr,
  hasDiscount,
} from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

type CustomerMenuSectionProps = {
  menuItems: CategoryItem[];
  isLoading: boolean;
  onAddToCart?: (
    item: CategoryItem,
  ) => void | Promise<void>;
  isAddingItem?: (itemId: string) => boolean;
};

export function CustomerMenuSection({
  menuItems,
  isLoading,
  onAddToCart,
  isAddingItem,
}: CustomerMenuSectionProps) {
  const menuScrollRef = useRef<HTMLDivElement | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const displayedMenuItems = menuItems.slice(0, 20);
  const menuPlaceholders = Array.from({ length: 4 });
  const menuCardsCount = isLoading
    ? menuPlaceholders.length
    : displayedMenuItems.length + 1;

  const handleMenuScroll = () => {
    if (!menuScrollRef.current) return;
    const firstCard =
      menuScrollRef.current.querySelector<HTMLElement>(
        '[data-menu-card]',
      );
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    const nextIndex = Math.round(
      menuScrollRef.current.scrollLeft / cardWidth,
    );
    setActiveMenuIndex(
      Math.max(0, Math.min(menuCardsCount - 1, nextIndex)),
    );
  };

  const scrollToMenuCard = (index: number) => {
    if (!menuScrollRef.current) return;
    const firstCard =
      menuScrollRef.current.querySelector<HTMLElement>(
        '[data-menu-card]',
      );
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    menuScrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: 'smooth',
    });
    setActiveMenuIndex(index);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[32px] leading-none font-semibold text-gray-900">
          Menu
        </h2>
        <Button
          asChild
          variant="link"
          className="px-0 font-semibold text-orange-500 hover:text-orange-600"
        >
          <Link href="/menu">View All</Link>
        </Button>
      </div>
      <div
        ref={menuScrollRef}
        onScroll={handleMenuScroll}
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex snap-x snap-mandatory gap-4">
          {isLoading
            ? menuPlaceholders.map((_, index) => (
                <Card
                  key={`menu-skeleton-${index}`}
                  data-menu-card
                  className="min-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-card py-0 shadow-md"
                >
                  <CardContent className="space-y-3 p-0">
                    <Skeleton className="h-32 w-full rounded-none" />
                    <div className="space-y-2 px-2.5 pb-3">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/3" />
                      <div className="flex items-center justify-between pt-1">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="size-9 rounded-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : null}
          {!isLoading
            ? displayedMenuItems.map((item) => (
                <Card
                  key={item.id}
                  data-menu-card
                  className="group min-w-[220px] shrink-0 snap-start gap-0 overflow-hidden rounded-2xl border-none bg-card py-0 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
                >
                  <CardContent className="space-y-1 p-0">
                    <div className="relative h-32 overflow-hidden rounded-b-2xl bg-linear-to-br from-orange-100 via-amber-100 to-orange-200 transition-transform duration-500 group-hover:scale-[1.03]">
                      {catalogItemImageUrl(
                        item.imagePath,
                      ) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            catalogItemImageUrl(
                              item.imagePath,
                            ) ?? ''
                          }
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_50%)]" />
                      {hasDiscount(item.discount) ? (
                        <Badge className="absolute top-2 right-2 border-0 bg-orange-500 text-[10px] font-semibold text-white shadow-sm">
                          {discountLabel(item.discount)}
                        </Badge>
                      ) : null}
                      <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold tracking-wide text-orange-600 shadow-sm backdrop-blur-sm">
                        <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                        FRESH
                      </div>
                    </div>
                    <div className="space-y-1 px-2.5 pt-1.5 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 min-h-9 text-sm leading-tight font-semibold tracking-normal text-gray-800 group-hover:text-gray-900">
                          {item.name}
                        </p>
                        <p className="shrink-0 truncate text-xs leading-tight font-medium tracking-normal text-muted-foreground">
                          {item.businessName ??
                            'Unknown business'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          {hasDiscount(item.discount) ? (
                            <>
                              <p className="text-sm font-semibold text-gray-400 line-through">
                                {formatBirr(item.price)}
                              </p>
                              <p className="text-lg leading-none font-bold tracking-normal text-primary">
                                {formatDiscountedBirr(
                                  item.price,
                                  item.discount,
                                )}
                              </p>
                            </>
                          ) : (
                            <p className="text-lg leading-none font-bold tracking-normal text-primary">
                              {formatBirr(item.price)}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-9 rounded-full bg-orange-50 text-orange-500 transition-all duration-300 hover:bg-orange-100 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-orange-500/30"
                          onClick={() => {
                            void onAddToCart?.(item);
                          }}
                          disabled={isAddingItem?.(item.id)}
                          aria-label={`Add ${item.name} to cart`}
                        >
                          {isAddingItem?.(item.id) ? (
                            <Spinner className="size-4" />
                          ) : (
                            <ShoppingCart className="size-[18px]" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : null}
          {!isLoading ? (
            <Card
              data-menu-card
              className="min-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border-none bg-orange-500 text-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:bg-orange-400 hover:shadow-xl hover:shadow-orange-200/70"
            >
              <CardContent className="flex h-full min-h-[184px] flex-col items-center justify-center gap-3 p-4 text-center">
                <p className="text-xl font-bold">
                  View All Menu
                </p>
                <Button
                  asChild
                  className="rounded-xl bg-white text-orange-500 hover:bg-orange-50"
                >
                  <Link href="/menu">View All</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        {Array.from({ length: menuCardsCount }).map(
          (_, index) => {
            const isActive = index === activeMenuIndex;
            return (
              <button
                key={`menu-dot-${index}`}
                type="button"
                onClick={() => scrollToMenuCard(index)}
                aria-label={`Go to menu item ${index + 1}`}
                className={`rounded-full border transition-all ${
                  isActive
                    ? 'size-4 border-orange-400 bg-orange-400 shadow-sm shadow-orange-200'
                    : 'size-3 border-orange-200 bg-orange-50 hover:scale-105 hover:border-orange-300'
                }`}
              />
            );
          },
        )}
      </div>
    </section>
  );
}
