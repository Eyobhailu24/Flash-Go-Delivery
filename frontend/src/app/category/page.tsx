"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  catalogItemImageUrl,
  fetchCategoryItems,
  fetchPublicCategoryNames,
  type CategoryItem,
} from "@/lib/admin-catalog-api";
import {
  discountLabel,
  formatBirr,
  formatDiscountedBirr,
  hasDiscount,
} from "@/lib/currency";

export default function CategoryPage() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categoryName = useMemo(() => {
    if (!categoryId) return "Category";
    return (
      categories.find((category) => category.id === categoryId)?.name ?? "Category"
    );
  }, [categories, categoryId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchPublicCategoryNames({ limit: 200, offset: 0 });
        if (cancelled) return;
        setCategories(
          response.categoryNames.map((category) => ({
            id: category.id,
            name: category.name,
          })),
        );
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const response = await fetchCategoryItems({
          categoryId,
          limit: 200,
          offset: 0,
        });
        if (!cancelled) {
          setItems(response.items);
        }
      } catch {
        if (!cancelled) {
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
  }, [categoryId]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold text-gray-900">{categoryName}</h1>
          <div className="w-20" />
        </div>

        {!categoryId ? (
          <Card className="rounded-2xl border-none shadow-md">
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No category selected.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="size-8 text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="rounded-2xl border-none shadow-md">
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No menu items found for this category.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden rounded-2xl border-none shadow-md">
                <CardContent className="space-y-3 p-3">
                  <div className="relative h-36 overflow-hidden rounded-xl bg-orange-100">
                    {catalogItemImageUrl(item.imagePath) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={catalogItemImageUrl(item.imagePath) ?? ""}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    {hasDiscount(item.discount) ? (
                      <Badge className="absolute top-2 right-2 border-0 bg-orange-500 text-[10px] font-semibold text-white shadow-sm">
                        {discountLabel(item.discount)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-gray-800">{item.name}</p>
                  <div className="flex items-baseline gap-2">
                    {hasDiscount(item.discount) ? (
                      <>
                        <p className="text-sm font-semibold text-gray-400 line-through">
                          {formatBirr(item.price)}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {formatDiscountedBirr(item.price, item.discount)}
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-bold text-primary">
                        {formatBirr(item.price)}
                      </p>
                    )}
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
