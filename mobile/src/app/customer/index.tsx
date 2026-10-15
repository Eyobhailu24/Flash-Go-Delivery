import { useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ArrowRight } from 'lucide-react-native';
import { Page, go } from '@/components/page';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Input,
  LoadingCards,
  Photo,
  Row,
  Section,
  Txt,
  colors,
  useAction,
} from '@/components/ui';
import { ProductCard } from '@/components/product-card';
import {
  LocationPicker,
  type AddressPoint,
} from '@/components/location-picker';
import { useAuth } from '@/lib/auth';
import {
  fetchCategoryItems,
  fetchPublicCategoryNames,
  catalogCategoryNameImageUrl,
} from '@/lib/admin-catalog-api';
import {
  fetchPublicApprovedBusinessProfiles,
  businessProfileImageUrl,
} from '@/lib/admin-business-api';
import {
  fetchMyCustomerProfile,
  patchMyCustomerProfile,
} from '@/lib/customer-profile-api';
import { haversineDistanceKm, formatDistanceKm } from '@/lib/distance';
import { useCart } from '@/features/cart';

const promos = [
  [
    'We make food with love and guaranteed pleasure',
    'We make dishes with quality ingredients',
    'See More',
  ],
  [
    'Hot deals today up to 40% off',
    'Try new menu items from top nearby restaurants',
    'Get Deal',
  ],
  [
    'Fast delivery in your area',
    'Track every order in real time from checkout',
    'Order Now',
  ],
  [
    'Weekend combo specials just for you',
    'Enjoy bundle meals with free drink upgrades',
    'View Combo',
  ],
  [
    'Free delivery on selected stores',
    'Save more when you order from partner restaurants',
    'Explore',
  ],
  [
    'New restaurants added nearby',
    'Discover freshly opened places in your neighborhood',
    'Browse',
  ],
  [
    'Late night cravings covered',
    'Order up to midnight from selected vendors',
    'Order Late',
  ],
];
export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 68, 370);
  const [promoIndex, setPromoIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<AddressPoint | null>(null);
  const action = useAction();
  const cart = useCart();
  const categories = useQuery({
    queryKey: ['public-categories'],
    queryFn: () => fetchPublicCategoryNames({ limit: 200 }),
  });
  const menu = useQuery({
    queryKey: ['home-menu'],
    queryFn: () => fetchCategoryItems({ limit: 20 }),
  });
  const businesses = useQuery({
    queryKey: ['public-businesses'],
    queryFn: () => fetchPublicApprovedBusinessProfiles({ limit: 20 }),
  });
  const profile = useQuery({
    queryKey: ['customer-profile', user?.id],
    queryFn: fetchMyCustomerProfile,
    enabled: !!user,
  });
  const saved =
    profile.data?.addresses?.find((address) => address.isDefault) ||
    profile.data?.addresses?.[0];
  const selectedLocation =
    location ||
    (saved?.lat != null && saved.lng != null
      ? { latitude: saved.lat, longitude: saved.lng, address: saved.address }
      : null);
  const restaurants = (businesses.data?.profiles || [])
    .map((restaurant) => ({
      ...restaurant,
      distance:
        selectedLocation &&
        restaurant.latitude != null &&
        restaurant.longitude != null
          ? haversineDistanceKm(selectedLocation, {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            })
          : null,
    }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  const add = (item: Parameters<typeof cart.add.mutateAsync>[0]) => {
    if (!user) return go('/auth/login');
    void action.run(() => cart.add.mutateAsync(item), 'Added to cart');
  };
  return (
    <Page
      refresh={() => {
        void menu.refetch();
        void businesses.refetch();
        void categories.refetch();
      }}
      refreshing={menu.isRefetching}
    >
      <View style={{ gap: 6 }}>
        <Txt muted>
          {t('Hello, {name} 👋', {
            name: user?.fullName.split(' ')[0] || t('Guest'),
          })}
        </Txt>
        <Txt bold size={29}>
          What would you like today?
        </Txt>
      </View>
      <LocationPicker
        value={selectedLocation}
        onChange={(value) => {
          setLocation(value);
          if (user)
            void action.run(async () => {
              await patchMyCustomerProfile({
                addresses: [
                  {
                    address: value.address,
                    lat: value.latitude,
                    lng: value.longitude,
                    isDefault: true,
                  },
                  ...(profile.data?.addresses || []).map((address) => ({
                    ...address,
                    isDefault: false,
                  })),
                ],
              });
              await profile.refetch();
            });
        }}
      />
      <Input
        placeholder="Search something"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        onSubmitEditing={() =>
          go(`/customer/menu?q=${encodeURIComponent(search)}`)
        }
      />
      <View style={{ gap: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 16}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) =>
            setPromoIndex(
              Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 16)),
            )
          }
          contentContainerStyle={{ gap: 16 }}
        >
          {promos.map(([title, subtitle, cta]) => (
            <LinearGradient
              key={title}
              colors={['#fff1de', '#fed7aa', '#ffedd5']}
              style={{
                width: cardWidth,
                minHeight: 225,
                borderRadius: 25,
                padding: 24,
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <Txt bold size={25} style={{ color: '#522d15' }}>
                {title}
              </Txt>
              <Txt size={13} style={{ color: '#92561d' }}>
                {subtitle}
              </Txt>
              <Button className="self-start">{cta}</Button>
            </LinearGradient>
          ))}
        </ScrollView>
        <Row style={{ justifyContent: 'center', gap: 8 }}>
          {promos.map((_, i) => (
            <View
              key={i}
              style={{
                height: 7,
                width: i === promoIndex ? 22 : 7,
                backgroundColor: i === promoIndex ? colors.orange : '#fed7aa',
                borderRadius: 5,
              }}
            />
          ))}
        </Row>
      </View>
      <Section title="Categories">
        {categories.isPending ? (
          <LoadingCards count={1} />
        ) : categories.error ? (
          <ErrorState
            error={categories.error}
            retry={() => void categories.refetch()}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 13 }}
          >
            {categories.data?.categoryNames.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  go(`/customer/menu?categoryNameId=${category.id}`)
                }
                style={{ width: 94, gap: 9, alignItems: 'center' }}
              >
                <Photo
                  uri={catalogCategoryNameImageUrl(category.imagePath)}
                  size={78}
                  style={{ borderRadius: 25 }}
                />
                <Txt
                  size={12}
                  bold
                  numberOfLines={2}
                  style={{ textAlign: 'center' }}
                >
                  {category.name}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Section>
      <Section title="Nearby Restaurant">
        {businesses.isPending ? (
          <LoadingCards count={1} />
        ) : businesses.error ? (
          <ErrorState
            error={businesses.error}
            retry={() => void businesses.refetch()}
          />
        ) : restaurants.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
          >
            {restaurants.map((restaurant) => (
              <Pressable
                key={restaurant.userId}
                onPress={() =>
                  go(`/customer/menu?businessId=${restaurant.userId}`)
                }
              >
                <Card style={{ width: 265, padding: 0, overflow: 'hidden' }}>
                  <Photo
                    uri={businessProfileImageUrl(restaurant.imagePath)}
                    style={{ borderRadius: 0 }}
                  />
                  <View style={{ padding: 16, paddingTop: 0, gap: 8 }}>
                    <Txt bold size={18}>
                      {restaurant.businessName}
                    </Txt>
                    <Row>
                      <MapPin size={14} color={colors.orange} />
                      <Txt
                        muted
                        size={12}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {restaurant.address || ''}
                      </Txt>
                      {restaurant.distance !== null && (
                        <Txt size={12}>
                          {t('{distance} km away', {
                            distance: restaurant.distance.toFixed(1),
                          })}
                        </Txt>
                      )}
                    </Row>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Empty />
        )}
      </Section>
      <Section
        title="Menu"
        action={
          <Button variant="ghost" onPress={() => go('/customer/menu')}>
            View All
          </Button>
        }
      >
        {menu.isPending ? (
          <LoadingCards count={2} />
        ) : menu.error ? (
          <ErrorState error={menu.error} retry={() => void menu.refetch()} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
          >
            {menu.data?.items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onAdd={add}
                busy={cart.add.isPending && cart.add.variables?.id === item.id}
                width={235}
              />
            ))}
          </ScrollView>
        )}
      </Section>
      <Button
        variant="secondary"
        onPress={() => go('/customer/packages')}
        icon={<ArrowRight size={18} color={colors.orange} />}
      >
        Deliver Packages
      </Button>
    </Page>
  );
}
