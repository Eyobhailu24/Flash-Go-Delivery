"use client";

import { useCallback, useEffect, useState } from "react";
import { reverseGeocodeCoordinates } from "@/lib/location-api";

const LOCATION_ERROR_MESSAGE = "Could not detect your location.";

type UseLiveAddressResult = {
  liveAddress: string | null;
  loading: boolean;
  error: string | null;
  refreshAddress: () => Promise<void>;
};

export function useLiveAddress(): UseLiveAddressResult {
  const [liveAddress, setLiveAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAddress = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 60000,
          });
        },
      );

      const response = await reverseGeocodeCoordinates(
        position.coords.latitude,
        position.coords.longitude,
      );

      if (!response?.formattedAddress) {
        setError(LOCATION_ERROR_MESSAGE);
        return;
      }

      setLiveAddress(response.formattedAddress);
    } catch {
      setError(LOCATION_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAddress();
  }, [refreshAddress]);

  return {
    liveAddress,
    loading,
    error,
    refreshAddress,
  };
}
