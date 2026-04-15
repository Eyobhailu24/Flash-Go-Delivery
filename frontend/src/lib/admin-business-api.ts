import {
  authFetch,
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
  status: BusinessProfileStatus;
  approvedDate: string | null;
  createdAt: string;
};

export type CreateBusinessProfileInput = {
  userId: string;
  businessName: string;
  businessType?: string;
  address?: string;
  status?: BusinessProfileStatus;
};

/** POST /profiles/businesses (admin) */
export async function postBusinessProfile(
  input: CreateBusinessProfileInput,
): Promise<BusinessProfile> {
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
