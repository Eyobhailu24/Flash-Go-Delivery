"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Skeleton } from "@/components/ui/skeleton";

type LatLng = {
  latitude: number;
  longitude: number;
};

type DriverRouteMapProps = {
  pickup: LatLng | null;
  destination: LatLng | null;
};

type RouteState =
  | { status: "idle"; points: LatLngExpression[] }
  | { status: "loading"; points: LatLngExpression[] }
  | { status: "ready"; points: LatLngExpression[] }
  | { status: "error"; points: LatLngExpression[] };

async function fetchRoadRoute(pickup: LatLng, destination: LatLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load route.");
  }
  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
  };
  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];
  return coordinates.map(
    ([longitude, latitude]) => [latitude, longitude] as LatLngExpression,
  );
}

export function DriverRouteMap({ pickup, destination }: DriverRouteMapProps) {
  const fallbackPoints = useMemo(() => {
    if (!pickup || !destination) return [];
    return [
      [pickup.latitude, pickup.longitude],
      [destination.latitude, destination.longitude],
    ] as LatLngExpression[];
  }, [pickup, destination]);
  const [routeState, setRouteState] = useState<RouteState>({
    status: "idle",
    points: fallbackPoints,
  });

  useEffect(() => {
    if (!pickup || !destination) {
      setRouteState({ status: "idle", points: [] });
      return;
    }

    let active = true;
    setRouteState({ status: "loading", points: fallbackPoints });
    void (async () => {
      try {
        const points = await fetchRoadRoute(pickup, destination);
        if (!active) return;
        setRouteState({
          status: "ready",
          points: points.length > 0 ? points : fallbackPoints,
        });
      } catch {
        if (!active) return;
        setRouteState({ status: "error", points: fallbackPoints });
      }
    })();
    return () => {
      active = false;
    };
  }, [destination, fallbackPoints, pickup]);

  if (!pickup || !destination) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[260px] rounded-2xl bg-orange-100/80" />
        <p className="text-xs text-gray-500">
          Route map is unavailable until pickup and destination coordinates are ready.
        </p>
      </div>
    );
  }

  const center: LatLngExpression = [
    (pickup.latitude + destination.latitude) / 2,
    (pickup.longitude + destination.longitude) / 2,
  ];

  return (
    <div className="space-y-2">
      <div className="h-[260px] overflow-hidden rounded-2xl border border-orange-100">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={[pickup.latitude, pickup.longitude]}
            radius={8}
            pathOptions={{ color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.9 }}
          />
          <CircleMarker
            center={[destination.latitude, destination.longitude]}
            radius={8}
            pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }}
          />
          <Polyline
            positions={routeState.points}
            pathOptions={{ color: "#f97316", weight: 5, opacity: 0.9 }}
          />
        </MapContainer>
      </div>
      {routeState.status === "loading" ? (
        <p className="text-xs text-gray-500">Calculating road route...</p>
      ) : routeState.status === "error" ? (
        <p className="text-xs text-gray-500">
          Could not fetch road route. Showing direct line fallback.
        </p>
      ) : null}
    </div>
  );
}
