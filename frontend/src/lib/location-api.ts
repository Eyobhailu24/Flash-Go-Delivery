export type ReverseGeocodeAddress = {
  formattedAddress: string;
};

type BigDataCloudReverseGeocodeResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
};

function compactAddressParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeAddress | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en",
  });
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
  );
  if (!response.ok) {
    return null;
  }

  const data =
    (await response.json()) as BigDataCloudReverseGeocodeResponse | null;
  if (!data) {
    return null;
  }

  const locationParts = compactAddressParts([
    data.city || data.locality,
    data.principalSubdivision,
    data.countryName,
  ]);
  if (locationParts.length === 0) {
    return null;
  }

  return { formattedAddress: locationParts.join(", ") };
}
