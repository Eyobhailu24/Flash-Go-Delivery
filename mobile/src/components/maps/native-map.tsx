import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapProps } from './types';
export default function NativeMap({
  markers,
  route,
  onPick,
  height = 280,
}: MapProps) {
  const ref = useRef<MapView>(null);
  const key = JSON.stringify(
    markers.map(({ latitude, longitude }) => [latitude, longitude]),
  );
  const fit = () => {
    if (markers.length)
      ref.current?.fitToCoordinates(markers, {
        edgePadding: { top: 45, bottom: 45, left: 45, right: 45 },
        animated: true,
      });
  };
  useEffect(fit, [key]);
  return (
    <MapView
      ref={ref}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      style={{ height, width: '100%' }}
      initialRegion={{
        latitude: markers[0]?.latitude ?? 9.03,
        longitude: markers[0]?.longitude ?? 38.74,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      }}
      onMapReady={fit}
      onPress={(event) => onPick?.(event.nativeEvent.coordinate)}
    >
      {markers.map((marker, i) => (
        <Marker
          key={`${i}-${marker.title}`}
          coordinate={marker}
          title={marker.title}
          pinColor={marker.color || '#f97316'}
        />
      ))}
      {route && route.length > 1 && (
        <Polyline coordinates={route} strokeColor="#f97316" strokeWidth={5} />
      )}
    </MapView>
  );
}
