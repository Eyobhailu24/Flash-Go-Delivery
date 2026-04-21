"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { CustomerCategoriesSection } from "@/components/customer/customer-categories-section";
import { CustomerHeroSection } from "@/components/customer/customer-hero-section";
import { CustomerMenuSection } from "@/components/customer/customer-menu-section";
import { CustomerTopNavbar } from "@/components/customer/customer-top-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { useCarts } from "./_hooks/use-carts";
import { useLiveAddress } from "./_hooks/use-live-address";
import { useNotifications } from "@/hooks/use-notifications";
import {
  fetchCategoryItems,
  fetchPublicCategoryNames,
  type CategoryItem,
} from "@/lib/admin-catalog-api";
import {
  businessProfileImageUrl,
  fetchPublicApprovedBusinessProfiles,
} from "@/lib/admin-business-api";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/distance";

type Restaurant = {
  id: string;
  businessName: string;
  address: string;
  imagePath: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
};

export default function CustomerHomePage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; imagePath: string | null }>
  >([]);
  const selectedCategoryId = null;
  const [menuItems, setMenuItems] = useState<CategoryItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeRestaurantIndex, setActiveRestaurantIndex] = useState(0);
  const restaurantScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    addToCart,
    isAddingItem,
    cartItemsView,
    activeCartSummary,
    loadPrimaryActiveCart,
    loading: cartLoading,
  } = useCarts();
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications();
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
  const { liveAddress, coordinates, loading: loadingLiveAddress } = useLiveAddress();
  const profileAddress =
    (user as { address?: string } | null)?.address?.trim() || "";
  const userAddress = loadingLiveAddress
    ? "Detecting location..."
    : liveAddress || profileAddress || "Purwokerto Selatan";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchPublicCategoryNames({
          limit: 200,
          offset: 0,
        });
        if (cancelled) return;
        const nextCategories = response.categoryNames.map((categoryName) => ({
          id: categoryName.id,
          name: categoryName.name,
          imagePath: categoryName.imagePath,
        }));
        setCategories(nextCategories);
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
    void loadPrimaryActiveCart();
  }, [loadPrimaryActiveCart]);

  useEffect(() => {
    void loadNotifications({ limit: 50 });
  }, [loadNotifications]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter((n) => !n.readStatus).length,
    [notifications],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchPublicApprovedBusinessProfiles({
          limit: 20,
          offset: 0,
        });
        if (cancelled) return;
        const next = response.profiles
          .filter((profile) => profile.status === "approved")
          .map((profile) => ({
            id: profile.userId,
            businessName: profile.businessName,
            address: profile.address?.trim() || "Address not provided",
            imagePath: profile.imagePath,
            latitude: profile.latitude,
            longitude: profile.longitude,
            distanceKm:
              coordinates &&
              profile.latitude !== null &&
              profile.longitude !== null
                ? haversineDistanceKm(coordinates, {
                    latitude: profile.latitude,
                    longitude: profile.longitude,
                  })
                : null,
          }))
          .sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          });
        setRestaurants(next);
      } catch {
        if (!cancelled) setRestaurants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coordinates]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsMenuLoading(true);
      try {
        const response = await fetchCategoryItems({
          limit: 20,
          offset: 0,
        });
        if (!cancelled) {
          setMenuItems(response.items);
        }
      } catch {
        if (!cancelled) {
          setMenuItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsMenuLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

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

  const handleSelectCategory = (categoryId: string) => {
    router.push(`/menu?categoryNameId=${encodeURIComponent(categoryId)}`);
  };

  const handleSelectNearbyRestaurant = (businessId: string) => {
    router.push(`/menu?businessId=${encodeURIComponent(businessId)}`);
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

  return (
    <main className="customer-app flex min-h-screen w-full flex-col gap-6 bg-background px-4 pt-8 pb-6 md:px-6">
      <CustomerTopNavbar
        firstName={firstName}
        todayLabel={todayLabel}
        userAddress={userAddress}
        cartItems={cartItemsView}
        cartTotalQuantity={activeCartSummary?.totalQuantity ?? 0}
        cartSubtotal={activeCartSummary?.subtotal ?? "0.00"}
        cartLoading={cartLoading}
        notifications={notifications}
        notificationsLoading={notificationsLoading}
        notificationUnreadCount={notificationUnreadCount}
      />

      <CustomerHeroSection />

      <CustomerCategoriesSection
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
      />

      <CustomerMenuSection
        menuItems={menuItems}
        isLoading={isMenuLoading}
        onAddToCart={handleAddToCart}
        isAddingItem={isAddingItem}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[32px] leading-none font-semibold text-gray-900">Nearby Restaurant</h2>
          <Button
            variant="link"
            className="px-0 font-semibold text-orange-500 hover:text-orange-600"
            onClick={() => router.push("/menu")}
          >
            View All
          </Button>
        </div>
        <div
          ref={restaurantScrollRef}
          onScroll={handleRestaurantScroll}
          className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex snap-x snap-mandatory gap-4">
            {restaurants.map((restaurant, index) => (
              <Card
                key={restaurant.id}
                data-restaurant-card
                className="group min-w-[260px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border-none bg-card shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-orange-100/70"
                onClick={() => handleSelectNearbyRestaurant(restaurant.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 p-2 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:bg-orange-100 group-hover:shadow-md">
                    {businessProfileImageUrl(restaurant.imagePath) ? (
                      <img
                        src={businessProfileImageUrl(restaurant.imagePath) ?? ""}
                        alt={restaurant.businessName}
                        className="h-[50px] w-[50px] rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <img
                        src="/flashgo.png"
                        alt={restaurant.businessName}
                        className="h-[50px] w-[50px] rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800 transition-colors group-hover:text-orange-600">
                        {restaurant.businessName}
                      </p>
                      {restaurant.distanceKm !== null && index < 3 ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                          Nearest
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors group-hover:text-gray-700">
                      <MapPin className="size-3.5 text-gray-400" />
                      <span className="truncate max-w-[140px]">{restaurant.address}</span>
                    </div>
                    {loadingLiveAddress ? (
                      <Skeleton className="h-3 w-24 bg-orange-100/80" />
                    ) : (
                      <p className="text-[11px] font-medium text-orange-600">
                        {restaurant.distanceKm !== null
                          ? formatDistanceKm(restaurant.distanceKm)
                          : "Distance unavailable"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        {restaurants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No nearby restaurants available yet.</p>
        ) : null}
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

    </main>
  );
}
