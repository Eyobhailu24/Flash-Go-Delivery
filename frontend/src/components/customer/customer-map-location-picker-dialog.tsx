"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CustomerMapLocationPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatitude: number | null;
  initialLongitude: number | null;
  onConfirm: (location: { latitude: number; longitude: number }) => void;
};

const DEFAULT_CENTER: [number, number] = [9.03, 38.74];

type PlaceSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const CustomerLocationPickerMap = dynamic(
  () =>
    import("./customer-map-location-picker-map").then((mod) => ({
      default: mod.CustomerLocationPickerMap,
    })),
  {
    ssr: false,
  },
);

export function CustomerMapLocationPickerDialog({
  open,
  onOpenChange,
  initialLatitude,
  initialLongitude,
  onConfirm,
}: CustomerMapLocationPickerDialogProps) {
  const [selected, setSelected] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const effectiveSelection = useMemo(
    () =>
      selected ??
      (initialLatitude !== null && initialLongitude !== null
        ? {
            latitude: initialLatitude,
            longitude: initialLongitude,
          }
        : null),
    [initialLatitude, initialLongitude, selected],
  );

  const center = useMemo<[number, number]>(() => {
    if (mapCenter) return mapCenter;
    if (!effectiveSelection) return DEFAULT_CENTER;
    return [effectiveSelection.latitude, effectiveSelection.longitude];
  }, [effectiveSelection, mapCenter]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelected(null);
      setMapCenter(null);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError("Enter a place to search.");
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        q,
        format: "jsonv2",
        limit: "6",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error("Search request failed.");
      }
      const data = (await response.json()) as PlaceSearchResult[];
      setSearchResults(data);
      if (data.length === 0) {
        setSearchError("No places found. Try another search.");
      }
    } catch {
      setSearchResults([]);
      setSearchError("Could not search places right now.");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] rounded-2xl border-none bg-white p-0 shadow-xl sm:max-w-5xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-gray-900">Pick delivery location</DialogTitle>
          <DialogDescription>
            Search for an area or tap on the map to choose your delivery point.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <div className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Search place, street, neighborhood..."
              className="rounded-full border-orange-100 bg-orange-50/60"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSearch()}
              disabled={searchLoading}
              className="rounded-full border-orange-200 bg-white text-orange-600 hover:bg-orange-50"
            >
              <Search className="mr-1 size-4" />
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          {searchError ? <p className="text-xs text-red-500">{searchError}</p> : null}
          {searchResults.length > 0 ? (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-orange-100 bg-orange-50/40 p-2">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-xs text-gray-700 hover:bg-orange-100/70"
                  onClick={() => {
                    const latitude = Number(result.lat);
                    const longitude = Number(result.lon);
                    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
                    setSelected({ latitude, longitude });
                    setMapCenter([latitude, longitude]);
                    setSearchQuery(result.display_name);
                    setSearchResults([]);
                  }}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="h-[58vh] min-h-[430px] overflow-hidden rounded-2xl border border-orange-100">
            <CustomerLocationPickerMap
              center={center}
              latitude={effectiveSelection?.latitude ?? null}
              longitude={effectiveSelection?.longitude ?? null}
              isOpen={open}
              onPick={setSelected}
            />
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {effectiveSelection
              ? `Selected: ${effectiveSelection.latitude.toFixed(6)}, ${effectiveSelection.longitude.toFixed(6)}`
              : "No location selected yet."}
          </p>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="rounded-xl border-orange-200 bg-white text-orange-600 hover:bg-orange-50"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!effectiveSelection) return;
              onConfirm(effectiveSelection);
              handleOpenChange(false);
            }}
            disabled={!effectiveSelection}
            className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
          >
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
