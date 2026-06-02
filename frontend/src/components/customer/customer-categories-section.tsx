"use client";

import { catalogCategoryNameImageUrl } from "@/lib/admin-catalog-api";
import { Skeleton } from "@/components/ui/skeleton";

type Category = {
  id: string;
  name: string;
  imagePath: string | null;
};

type CustomerCategoriesSectionProps = {
  categories: Category[];
  isLoading?: boolean;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
};

export function CustomerCategoriesSection({
  categories,
  isLoading = false,
  selectedCategoryId,
  onSelectCategory,
}: CustomerCategoriesSectionProps) {
  const categoryPlaceholders = Array.from({ length: 6 });

  return (
    <section className="space-y-4">
      <h2 className="text-[32px] leading-none font-semibold text-gray-900">
        Categories
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading
          ? categoryPlaceholders.map((_, index) => (
              <div
                key={`category-skeleton-${index}`}
                className="flex min-w-24 shrink-0 flex-col items-center gap-3 rounded-2xl bg-card p-4 shadow-md"
              >
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            ))
          : null}
        {categories.map((category) => {
          const active = selectedCategoryId === category.id;
          const categoryImage = catalogCategoryNameImageUrl(
            category.imagePath,
          );
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className={`group relative flex min-w-24 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-2xl border-none p-4 text-sm shadow-md transition-all duration-300 ${
                active
                  ? "bg-primary text-white shadow-lg shadow-orange-500/30"
                  : "bg-card text-gray-500 hover:-translate-y-1 hover:bg-orange-50 hover:shadow-lg hover:shadow-orange-100/70"
              }`}
            >
              {active && (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
              )}
              <span className="relative z-10 flex size-10 items-center justify-center overflow-hidden rounded-full bg-white/80 transition-transform duration-300 group-hover:scale-110">
                {categoryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={categoryImage}
                    alt={category.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-lg">🧺</span>
                )}
              </span>
              <span className="relative z-10 font-medium tracking-tight">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
