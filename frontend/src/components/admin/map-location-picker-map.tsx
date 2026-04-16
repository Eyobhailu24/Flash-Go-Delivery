"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type LocationPickerMapProps = {
  center: [number, number];
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean;
  onPick: (location: { latitude: number; longitude: number }) => void;
};

function MapViewport({
  center,
  isOpen,
}: {
  center: [number, number];
  isOpen: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  useEffect(() => {
    if (!isOpen) return;
    const t1 = window.setTimeout(() => map.invalidateSize(), 50);
    const t2 = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isOpen, map]);

  return null;
}

function PickerMarker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (location: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click: (event) => {
      onPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  if (latitude === null || longitude === null) return null;

  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={9}
      pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.9 }}
    />
  );
}

export function LocationPickerMap({
  center,
  latitude,
  longitude,
  isOpen,
  onPick,
}: LocationPickerMapProps) {
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
      <MapViewport center={center} isOpen={isOpen} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PickerMarker latitude={latitude} longitude={longitude} onPick={onPick} />
    </MapContainer>
  );
}
