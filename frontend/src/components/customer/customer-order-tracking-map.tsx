"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

type OrderStatus =
  | "pending"
  | "accepted"
  | "in_transit"
  | "delivered"
  | "cancelled";

type Point = {
  latitude: number | null;
  longitude: number | null;
};

type CustomerOrderTrackingMapProps = {
  pickup: Point;
  destination: Point;
  driverLocation: { lat: number; lng: number } | null;
  status: OrderStatus;
};

type RouteState =
  | { status: "idle"; points: LatLngExpression[] }
  | { status: "loading"; points: LatLngExpression[] }
  | { status: "ready"; points: LatLngExpression[] }
  | { status: "error"; points: LatLngExpression[] };

const steps: Array<{ value: Exclude<OrderStatus, "cancelled">; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

function toLatLng(point: Point): [number, number] | null {
  if (typeof point.latitude !== "number" || typeof point.longitude !== "number") {
    return null;
  }
  return [point.latitude, point.longitude];
}

async function fetchRoadRoute(pickup: [number, number], destination: [number, number]) {
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load route.");
  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
  };
  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];
  return coordinates.map(
    ([longitude, latitude]) => [latitude, longitude] as LatLngExpression,
  );
}

export function CustomerOrderTrackingMap({
  pickup,
  destination,
  driverLocation,
  status,
}: CustomerOrderTrackingMapProps) {
  const pickupLatLng = toLatLng(pickup);
  const destinationLatLng = toLatLng(destination);
  const fallbackRoute = useMemo<LatLngExpression[]>(() => {
    if (!pickupLatLng || !destinationLatLng) return [];
    return [pickupLatLng, destinationLatLng];
  }, [destinationLatLng, pickupLatLng]);
  const [route, setRoute] = useState<RouteState>({
    status: "idle",
    points: fallbackRoute,
  });

  useEffect(() => {
    if (!pickupLatLng || !destinationLatLng) {
      setRoute({ status: "idle", points: [] });
      return;
    }
    let active = true;
    setRoute({ status: "loading", points: fallbackRoute });
    void (async () => {
      try {
        const points = await fetchRoadRoute(pickupLatLng, destinationLatLng);
        if (!active) return;
        setRoute({
          status: "ready",
          points: points.length > 0 ? points : fallbackRoute,
        });
      } catch {
        if (!active) return;
        setRoute({ status: "error", points: fallbackRoute });
      }
    })();
    return () => {
      active = false;
    };
  }, [destinationLatLng, fallbackRoute, pickupLatLng]);

  const allPoints = [
    pickupLatLng,
    destinationLatLng,
    driverLocation ? ([driverLocation.lat, driverLocation.lng] as [number, number]) : null,
  ].filter((point): point is [number, number] => Boolean(point));
  const center: LatLngExpression = allPoints.length
    ? ([
        allPoints.reduce((sum, point) => sum + point[0], 0) / allPoints.length,
        allPoints.reduce((sum, point) => sum + point[1], 0) / allPoints.length,
      ] as [number, number])
    : ([9.03, 38.74] as [number, number]);

  const currentStepIndex = steps.findIndex((step) => step.value === status);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="h-[300px] w-full">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pickupLatLng ? (
            <CircleMarker
              center={pickupLatLng}
              radius={8}
              pathOptions={{ color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.9 }}
            />
          ) : null}
          {destinationLatLng ? (
            <CircleMarker
              center={destinationLatLng}
              radius={8}
              pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }}
            />
          ) : null}
          {driverLocation ? (
            <CircleMarker
              center={[driverLocation.lat, driverLocation.lng]}
              radius={8}
              pathOptions={{ color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.95 }}
            />
          ) : null}
          <Polyline
            positions={route.points}
            pathOptions={{ color: "#f97316", weight: 5, opacity: 0.85 }}
          />
        </MapContainer>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-500 inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-[11px] text-gray-600 shadow-md backdrop-blur-sm">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-orange-500" />
          Restaurant
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-blue-500" />
          You
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-green-500" />
          Driver
        </span>
      </div>

      <div className="absolute bottom-3 left-1/2 z-500 w-1/2 min-w-[280px] max-w-[560px] -translate-x-1/2 rounded-xl bg-white/95 px-3 py-3 shadow-lg backdrop-blur-sm">
        {status === "cancelled" ? (
          <p className="text-center text-sm font-semibold text-red-600">Order Cancelled</p>
        ) : (
          <div className="space-y-2">
            <div className="relative h-2 rounded-full bg-orange-100">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{
                  width:
                    currentStepIndex < 0
                      ? "0%"
                      : `${(currentStepIndex / (steps.length - 1)) * 100}%`,
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-medium text-gray-600">
              {steps.map((step, index) => {
                const done = currentStepIndex >= index;
                return (
                  <p
                    key={step.value}
                    className={`truncate text-center ${done ? "text-orange-600" : "text-gray-400"}`}
                  >
                    {step.label}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {(route.status === "loading" || route.status === "error") && (
        <p className="absolute top-3 left-3 z-500 rounded-full bg-white/90 px-2 py-1 text-[11px] text-gray-600 shadow-sm">
          {route.status === "loading"
            ? "Calculating route..."
            : "Route fallback enabled"}
        </p>
      )}
    </div>
  );
}
