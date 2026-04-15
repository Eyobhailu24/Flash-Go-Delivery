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
  const base = getApiBaseUrl();
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${base}${path}`;
}
