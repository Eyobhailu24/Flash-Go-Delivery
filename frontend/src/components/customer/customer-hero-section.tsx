"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PromoCard = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  emoji: string;
};

const promoCards: PromoCard[] = [
  {
    id: "p1",
    title: "We make food with love and guaranteed pleasure",
    subtitle: "We make dishes with quality ingredients",
    ctaLabel: "See More",
    emoji: "👩‍🍳",
  },
  {
    id: "p2",
    title: "Hot deals today up to 40% off",
    subtitle: "Try new menu items from top nearby restaurants",
    ctaLabel: "Get Deal",
    emoji: "🔥",
  },
  {
    id: "p3",
    title: "Fast delivery in your area",
    subtitle: "Track every order in real time from checkout",
    ctaLabel: "Order Now",
    emoji: "🛵",
  },
  {
    id: "p4",
    title: "Weekend combo specials just for you",
    subtitle: "Enjoy bundle meals with free drink upgrades",
    ctaLabel: "View Combo",
    emoji: "🍱",
  },
  {
    id: "p5",
    title: "Free delivery on selected stores",
    subtitle: "Save more when you order from partner restaurants",
    ctaLabel: "Explore",
    emoji: "🚚",
  },
  {
    id: "p6",
    title: "New restaurants added nearby",
    subtitle: "Discover freshly opened places in your neighborhood",
    ctaLabel: "Browse",
    emoji: "🆕",
  },
  {
    id: "p7",
    title: "Late night cravings covered",
    subtitle: "Order up to midnight from selected vendors",
    ctaLabel: "Order Late",
    emoji: "🌙",
  },
];

export function CustomerHeroSection() {
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const promoScrollRef = useRef<HTMLDivElement | null>(null);

  const handlePromoScroll = () => {
    if (!promoScrollRef.current) return;
    const firstCard = promoScrollRef.current.querySelector<HTMLElement>("[data-promo-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    const nextIndex = Math.round(promoScrollRef.current.scrollLeft / cardWidth);
    setActivePromoIndex(Math.max(0, Math.min(promoCards.length - 1, nextIndex)));
  };

  const scrollToPromoCard = (index: number) => {
    if (!promoScrollRef.current) return;
    const firstCard = promoScrollRef.current.querySelector<HTMLElement>("[data-promo-card]");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 16;
    promoScrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: "smooth",
    });
    setActivePromoIndex(index);
  };

  return (
    <section className="space-y-3">
      <div
        ref={promoScrollRef}
        onScroll={handlePromoScroll}
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex snap-x snap-mandatory gap-4">
          {promoCards.map((promo) => (
            <Card
              key={promo.id}
              data-promo-card
              className="group relative h-52 w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl border-none bg-linear-to-br from-orange-50 via-orange-100/60 to-amber-100/70 shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-200/50 md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
            >
              <CardContent className="relative flex h-full items-center justify-between gap-4 p-6 text-orange-950">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.15),transparent_40%)]" />
                <div className="relative z-10 max-w-sm space-y-3 transition-transform duration-300 group-hover:-translate-y-1">
                  <p className="text-2xl leading-tight font-bold md:text-3xl">{promo.title}</p>
                  <p className="text-sm font-medium text-orange-800/80">{promo.subtitle}</p>
                  <Button className="mt-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-500/40">
                    {promo.ctaLabel}
                  </Button>
                </div>
                <div className="relative z-10 hidden h-40 w-36 items-end justify-center overflow-hidden rounded-[2rem] bg-orange-200/50 pt-3 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 md:flex">
                  <span className="absolute top-5 left-5 size-4 rounded-full bg-orange-300/60" />
                  <span className="absolute top-10 right-6 size-2 rounded-full bg-orange-400/60" />
                  <span className="text-7xl drop-shadow-md transition-transform duration-300 group-hover:scale-110">
                    {promo.emoji}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        {promoCards.map((promo, index) => {
          const isActive = index === activePromoIndex;
          return (
            <button
              key={promo.id}
              type="button"
              onClick={() => scrollToPromoCard(index)}
              aria-label={`Go to promotion ${index + 1}`}
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
