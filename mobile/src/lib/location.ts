import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OSRM_URL, GEOCODING_URL } from './config';
import type { Point } from '@/components/maps/types';
export async function currentLocation(): Promise<Point> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error(
      'Location permission was denied. You can choose a point on the map.',
    );
  const value = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { latitude: value.coords.latitude, longitude: value.coords.longitude };
}
export async function reverseGeocode(point: Point): Promise<string> {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${point.latitude}&longitude=${point.longitude}&localityLanguage=en`,
  );
  if (!response.ok)
    return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  const data = await response.json();
  return (
    [data.locality || data.city, data.principalSubdivision, data.countryName]
      .filter(Boolean)
      .join(', ') ||
    `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
  );
}
export async function searchPlaces(text: string) {
  const response = await fetch(
    `${GEOCODING_URL}/search?format=json&q=${encodeURIComponent(text)}&limit=5`,
    { headers: { 'Accept-Language': 'en' } },
  );
  if (!response.ok)
    throw new Error('Location search is unavailable. Choose on the map.');
  return (await response.json()) as {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }[];
}
export function useRoute(from?: Point | null, to?: Point | null) {
  // Rounded coordinates prevent route requests for insignificant GPS jitter.
  const start = from
    ? `${from.longitude.toFixed(3)},${from.latitude.toFixed(3)}`
    : '';
  const end = to ? `${to.longitude.toFixed(4)},${to.latitude.toFixed(4)}` : '';
  return useQuery({
    queryKey: ['route', start, end],
    enabled: !!from && !!to,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `${OSRM_URL}/route/v1/driving/${start};${end}?overview=full&geometries=geojson`,
        { signal },
      );
      if (!response.ok) throw new Error('Could not calculate a road route.');
      const data = (await response.json()) as {
        routes?: { geometry: { coordinates: number[][] } }[];
      };
      return (data.routes?.[0]?.geometry.coordinates || []).map(
        ([longitude, latitude]) => ({ latitude, longitude }),
      );
    },
  });
}
export function useDebounced<T>(value: T, delay = 350) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
