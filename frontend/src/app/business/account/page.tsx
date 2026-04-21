"use client";

import { useCallback, useEffect, useState } from "react";
import { MapLocationPickerDialog } from "@/components/admin/map-location-picker-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import {
  businessProfileImageUrl,
  fetchBusinessProfileById,
  patchBusinessProfile,
  type BusinessProfile,
} from "@/lib/admin-business-api";
import { AuthApiError } from "@/lib/auth-api";

export default function BusinessAccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const p = await fetchBusinessProfileById(user.id);
      setProfile(p);
      setBusinessName(p.businessName);
      setBusinessType(p.businessType ?? "");
      setAddress(p.address ?? "");
      setLatitude(p.latitude);
      setLongitude(p.longitude);
      setImageFile(null);
      setRemoveImage(false);
    } catch (e) {
      setProfile(null);
      setLoadError(
        e instanceof AuthApiError ? e.message : "Could not load profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    const name = businessName.trim();
    if (!name) {
      setSubmitError("Business name is required.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const next = await patchBusinessProfile(user.id, {
        businessName: name,
        businessType: businessType.trim() || null,
        address: address.trim() || null,
        latitude,
        longitude,
        image: imageFile ?? undefined,
        removeImage: removeImage || undefined,
      });
      setProfile(next);
      setImageFile(null);
      setRemoveImage(false);
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError
          ? err.message
          : "Could not save changes.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-orange-500" />
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Profile</AlertTitle>
        <AlertDescription>{loadError ?? "Not found."}</AlertDescription>
      </Alert>
    );
  }

  const previewUrl =
    imageFile != null && imageFile.size > 0
      ? URL.createObjectURL(imageFile)
      : removeImage
        ? null
        : businessProfileImageUrl(profile.imagePath);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Business profile
        </h1>
        <p className="text-sm text-gray-600">
          Changes here update how your restaurant appears to customers. Approval
          status is managed by FlashGo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-lg capitalize">
          {profile.status}
        </Badge>
      </div>

      <Card className="rounded-2xl border border-orange-100/80 shadow-md">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Name, type, address, map location, and storefront image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
            {submitError ? (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="bn">Business name</Label>
              <Input
                id="bn"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bt">Business type</Label>
              <Input
                id="bt"
                placeholder="e.g. Restaurant"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr">Address</Label>
              <Textarea
                id="addr"
                rows={4}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="min-h-[100px] resize-y rounded-xl"
                placeholder="Street, city, region…"
              />
            </div>
            <div className="space-y-2">
              <Label>Map location</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setMapOpen(true)}
                >
                  {latitude !== null && longitude !== null
                    ? "Update map location"
                    : "Pick location on map"}
                </Button>
                {latitude !== null && longitude !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pin your kitchen or storefront for accurate delivery.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="img">Business image</Label>
              <Input
                id="img"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="cursor-pointer rounded-xl"
                onChange={(e) => {
                  setImageFile(e.target.files?.[0] ?? null);
                  setRemoveImage(false);
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="size-24 rounded-2xl object-cover ring-2 ring-orange-100"
                  />
                ) : (
                  <div className="flex size-24 items-center justify-center rounded-2xl bg-orange-50 text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                {profile.imagePath && !removeImage && !imageFile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setRemoveImage(true);
                      setImageFile(null);
                    }}
                  >
                    Remove current image
                  </Button>
                ) : null}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-xl bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
            >
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <MapLocationPickerDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onConfirm={({ latitude: lat, longitude: lng }) => {
          setLatitude(lat);
          setLongitude(lng);
        }}
      />
    </main>
  );
}
