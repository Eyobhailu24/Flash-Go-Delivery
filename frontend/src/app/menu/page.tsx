"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  catalogItemImageUrl,
  fetchCategoryItems,
  fetchPublicCategoryNames,
  type CategoryItem,
} from "@/lib/admin-catalog-api";

export default function MenuPage() {
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const selectedCategoryName = useMemo(
    () =>
      categories.find((category) => category.id === selectedCategoryId)?.name ??
      "Menu",
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchPublicCategoryNames({ limit: 200, offset: 0 });
        if (cancelled) return;
        const nextCategories = response.categoryNames.map((category) => ({
          id: category.id,
          name: category.name,
        }));
        setCategories(nextCategories);
        setSelectedCategoryId(nextCategories[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setCategories([]);
          setSelectedCategoryId(null);
          setItems([]);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const response = await fetchCategoryItems({
          categoryId: selectedCategoryId,
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
  }, [selectedCategoryId]);

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
          <h1 className="text-3xl font-semibold text-gray-900">All Menu</h1>
          <div className="w-20" />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isActive = category.id === selectedCategoryId;
            return (
              <Button
                key={category.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => setSelectedCategoryId(category.id)}
                className="rounded-full"
              >
                {category.name}
              </Button>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{selectedCategoryName}</h2>
          {isLoading ? (
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
                <Card
                  key={item.id}
                  className="overflow-hidden rounded-2xl border-none shadow-md"
                >
                  <CardContent className="space-y-3 p-3">
                    <div className="h-36 overflow-hidden rounded-xl bg-orange-100">
                      {catalogItemImageUrl(item.imagePath) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={catalogItemImageUrl(item.imagePath) ?? ""}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-gray-800">
                      {item.name}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      ${Number(item.price).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
