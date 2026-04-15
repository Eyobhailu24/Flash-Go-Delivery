"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { useCarts } from "../_hooks/use-carts";
import {
  catalogItemImageUrl,
  fetchCategoryItems,
  type CategoryItem,
} from "@/lib/admin-catalog-api";
import {
  discountLabel,
  formatBirr,
  formatDiscountedBirr,
  hasDiscount,
} from "@/lib/currency";

type CategoryTab = {
  categoryId: string;
  categoryNameId: string | null;
  name: string;
};

export default function CustomerMenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isReady } = useAuth();
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const businessIdFromQuery = searchParams.get("businessId")?.trim() || null;
  const {
    addToCart,
    isAddingItem,
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();

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

  const firstName = user?.fullName?.split(" ")[0] ?? "Guest";
  const userAddress =
    (user as { address?: string } | null)?.address?.trim() || "Purwokerto Selatan";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const itemsResponse = await fetchCategoryItems({
          limit: 200,
          offset: 0,
        });
        if (cancelled) return;
        const nextItems = itemsResponse.items;
        setItems(nextItems);
        const byCategory = new Map<
          string,
          { name: string; categoryNameId: string | null }
        >();
        const sourceItems = businessIdFromQuery
          ? nextItems.filter((item) => item.businessId === businessIdFromQuery)
          : nextItems;
        sourceItems.forEach((item) => {
          if (!item.categoryId || !item.categoryName?.trim()) return;
          if (!byCategory.has(item.categoryId)) {
            byCategory.set(item.categoryId, {
              name: item.categoryName.trim(),
              categoryNameId: item.categoryNameId ?? null,
            });
          }
        });
        setCategories(
          Array.from(byCategory.entries()).map(([categoryId, value]) => ({
            categoryId,
            categoryNameId: value.categoryNameId,
            name: value.name,
          })),
        );
      } catch {
        if (!cancelled) {
          setCategories([]);
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessIdFromQuery]);

  useEffect(() => {
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  const scopedItems = useMemo(() => {
    if (!businessIdFromQuery) return items;
    return items.filter((item) => item.businessId === businessIdFromQuery);
  }, [businessIdFromQuery, items]);

  const filteredItems = useMemo(() => {
    if (activeCategoryId === "all") return scopedItems;
    return scopedItems.filter((item) => item.categoryId === activeCategoryId);
  }, [activeCategoryId, scopedItems]);

  const activeCategoryName = useMemo(() => {
    if (activeCategoryId === "all") return "All menu";
    return (
      categories.find((category) => category.categoryId === activeCategoryId)
        ?.name ??
      "Menu"
    );
  }, [activeCategoryId, categories]);

  const activeBusinessName = useMemo(() => {
    if (!businessIdFromQuery) return null;
    return scopedItems[0]?.businessName ?? "Business menu";
  }, [businessIdFromQuery, scopedItems]);

  useEffect(() => {
    if (categories.length === 0) return;
    const fromQuery = searchParams.get("categoryNameId")?.trim();
    if (!fromQuery) {
      setActiveCategoryId("all");
      return;
    }
    const match = categories.find(
      (category) => category.categoryNameId === fromQuery,
    );
    setActiveCategoryId(match?.categoryId ?? "all");
  }, [categories, searchParams]);

  const setActiveTab = (next: string) => {
    setActiveCategoryId(next);
    const qp = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      qp.delete("categoryNameId");
    } else {
      const match = categories.find((category) => category.categoryId === next);
      if (match?.categoryNameId) {
        qp.set("categoryNameId", match.categoryNameId);
      } else {
        qp.delete("categoryNameId");
      }
    }
    const query = qp.toString();
    router.replace(query ? `/menu?${query}` : "/menu");
  };

  const handleAddToCart = async (item: CategoryItem) => {
    try {
      await addToCart(item, 1);
      toast.success(`${item.name} added to cart.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not add item to cart.",
      );
    }
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pb-6 md:px-6">
      <CustomerTopNavbar
        firstName={firstName}
        todayLabel={todayLabel}
        userAddress={userAddress}
        cartItems={cartItemsView}
        cartTotalQuantity={activeCartSummary?.totalQuantity ?? 0}
        cartSubtotal={activeCartSummary?.subtotal ?? "0.00"}
        cartLoading={cartLoading}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-[32px] leading-none font-semibold text-gray-900">All Menu</h1>
          <div className="w-[82px]" />
        </div>

        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            <Button
              type="button"
              variant={activeCategoryId === "all" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveTab("all")}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category.categoryId}
                type="button"
                variant={activeCategoryId === category.categoryId ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setActiveTab(category.categoryId)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-800">
          {activeBusinessName
            ? `${activeBusinessName} - ${activeCategoryName}`
            : activeCategoryName}
        </h2>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-8 text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="rounded-2xl border-none shadow-md">
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No menu items found for this category.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="group gap-0 overflow-hidden rounded-2xl border-none bg-card py-0 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
              >
                <CardContent className="space-y-1 p-0">
                  <div className="relative h-48 overflow-hidden rounded-b-2xl bg-linear-to-br from-orange-100 via-amber-100 to-orange-200 transition-transform duration-500 group-hover:scale-[1.03]">
                    {catalogItemImageUrl(item.imagePath) ? (
                      <img
                        src={catalogItemImageUrl(item.imagePath) ?? ""}
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
                  </div>
                  <div className="space-y-1 px-2.5 pt-0 pb-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm leading-tight font-semibold tracking-normal text-gray-800 group-hover:text-gray-900">
                        {item.name}
                      </p>
                      <p className="shrink-0 truncate text-sm leading-tight font-medium tracking-normal text-muted-foreground">
                        {item.businessName ?? "Unknown business"}
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
                              {formatDiscountedBirr(item.price, item.discount)}
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
                          void handleAddToCart(item);
                        }}
                        disabled={isAddingItem(item.id)}
                        aria-label={`Add ${item.name} to cart`}
                      >
                        {isAddingItem(item.id) ? (
                          <Spinner className="size-4" />
                        ) : (
                          <ShoppingCart className="size-[18px]" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
