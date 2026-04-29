import {
  authFetch,
  getApiBaseUrl,
  readAuthJson,
} from "@/lib/auth-api";

export type BusinessProfileStatus =
  | "pending"
  | "approved"
  | "rejected";

export type BusinessProfile = {
  userId: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imagePath: string | null;
  status: BusinessProfileStatus;
  approvedDate: string | null;
  createdAt: string;
};

export type CreateBusinessProfileInput = {
  userId: string;
  businessName: string;
  businessType?: string;
  address?: string;
  latitude: number;
  longitude: number;
  image?: File | null;
  status?: BusinessProfileStatus;
};

type BusinessProfileListResponse = {
  profiles: BusinessProfile[];
  limit: number;
  offset: number;
};

/** POST /profiles/businesses (admin) */
export async function postBusinessProfile(
  input: CreateBusinessProfileInput,
): Promise<BusinessProfile> {
  if (input.image && input.image.size > 0) {
    const fd = new FormData();
    fd.append("userId", input.userId);
    fd.append("businessName", input.businessName.trim());
    const type = input.businessType?.trim();
    if (type) fd.append("businessType", type);
    const addr = input.address?.trim();
    if (addr) fd.append("address", addr);
    fd.append("latitude", String(input.latitude));
    fd.append("longitude", String(input.longitude));
    if (input.status) fd.append("status", input.status);
    fd.append("image", input.image);

    const res = await authFetch("/profiles/businesses", {
      method: "POST",
      body: fd,
    });
    const data = await readAuthJson<{ profile: BusinessProfile }>(res);
    return data.profile;
  }

  const body: Record<string, unknown> = {
    userId: input.userId,
    businessName: input.businessName.trim(),
  };
  const type = input.businessType?.trim();
  if (type) body.businessType = type;
  const addr = input.address?.trim();
  if (addr) body.address = addr;
  body.latitude = input.latitude;
  body.longitude = input.longitude;
  if (input.status) body.status = input.status;

  const res = await authFetch("/profiles/businesses", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await readAuthJson<{ profile: BusinessProfile }>(res);
  return data.profile;
}

export async function fetchBusinessProfiles(
  params: { limit?: number; offset?: number } = {},
): Promise<BusinessProfileListResponse> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  const res = await authFetch(`/profiles/businesses?${q.toString()}`);
  return readAuthJson<BusinessProfileListResponse>(res);
}

export function businessProfileImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const base = getApiBaseUrl();
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${base}${path}`;
}

/** GET /catalog/public/business-profiles — storefront, no auth. */
export async function fetchPublicApprovedBusinessProfiles(
  params: { limit?: number; offset?: number } = {},
): Promise<BusinessProfileListResponse> {
  const q = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  const res = await fetch(
    `${getApiBaseUrl()}/catalog/public/business-profiles?${q.toString()}`,
  );
  const data = (await res.json()) as BusinessProfileListResponse & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? "Failed to load businesses.");
  }
  return data;
}

/** GET /profiles/businesses/:id — admin or owning business. */
export async function fetchBusinessProfileById(
  userId: string,
): Promise<BusinessProfile> {
  const res = await authFetch(
    `/profiles/businesses/${encodeURIComponent(userId)}`,
  );
  const data = await readAuthJson<{ profile: BusinessProfile }>(res);
  return data.profile;
}

export type PatchBusinessProfileInput = {
  businessName?: string;
  businessType?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image?: File | null;
  removeImage?: boolean;
};

/** PATCH /profiles/businesses/:id — JSON or multipart. */
export async function patchBusinessProfile(
  userId: string,
  input: PatchBusinessProfileInput,
): Promise<BusinessProfile> {
  const useMultipart =
    (input.image != null && input.image.size > 0) || input.removeImage === true;

  if (useMultipart) {
    const fd = new FormData();
    if (input.businessName !== undefined) {
      fd.append("businessName", input.businessName.trim());
    }
    if (input.businessType !== undefined) {
      fd.append(
        "businessType",
        input.businessType === null ? "" : input.businessType.trim(),
      );
    }
    if (input.address !== undefined) {
      fd.append("address", input.address === null ? "" : input.address.trim());
    }
    if (input.latitude !== undefined) {
      fd.append(
        "latitude",
        input.latitude === null ? "" : String(input.latitude),
      );
    }
    if (input.longitude !== undefined) {
      fd.append(
        "longitude",
        input.longitude === null ? "" : String(input.longitude),
      );
    }
    if (input.image && input.image.size > 0) {
      fd.append("image", input.image);
    } else if (input.removeImage) {
      fd.append("image", "");
    }
    const res = await authFetch(
      `/profiles/businesses/${encodeURIComponent(userId)}`,
      { method: "PATCH", body: fd },
    );
    const data = await readAuthJson<{ profile: BusinessProfile }>(res);
    return data.profile;
  }

  const body: Record<string, unknown> = {};
  if (input.businessName !== undefined) {
    body.businessName = input.businessName.trim();
  }
  if (input.businessType !== undefined) {
    // Backend Zod expects "" to clear, not JSON null (null fails the union).
    body.businessType =
      input.businessType === null || String(input.businessType).trim() === ""
        ? ""
        : String(input.businessType).trim();
  }
  if (input.address !== undefined) {
    body.address =
      input.address === null || String(input.address).trim() === ""
        ? ""
        : String(input.address).trim();
  }
  if (input.latitude !== undefined) {
    body.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    body.longitude = input.longitude;
  }

  if (Object.keys(body).length === 0) {
    throw new Error("Nothing to update.");
  }

  const res = await authFetch(
    `/profiles/businesses/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  const data = await readAuthJson<{ profile: BusinessProfile }>(res);
  return data.profile;
}
