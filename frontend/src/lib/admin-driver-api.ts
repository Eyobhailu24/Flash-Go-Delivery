import { authFetch, readAuthJson } from "@/lib/auth-api";

export type DriverProfile = {
  userId: string;
  vehicleType: string | null;
  licenseNumber: string | null;
  rating: number;
  isAvailable: boolean;
  joiningDate: string;
  createdAt: string;
};

export type CreateDriverProfileInput = {
  userId: string;
  vehicleType?: string;
  licenseNumber?: string;
  rating?: number;
  isAvailable?: boolean;
  joiningDate?: string;
};

export async function postDriverProfile(
  input: CreateDriverProfileInput,
): Promise<DriverProfile> {
  const body: Record<string, unknown> = {
    userId: input.userId,
  };
  const vehicleType = input.vehicleType?.trim();
  if (vehicleType) body.vehicleType = vehicleType;
  const licenseNumber = input.licenseNumber?.trim();
  if (licenseNumber) body.licenseNumber = licenseNumber;
  if (typeof input.rating === "number") body.rating = input.rating;
  if (typeof input.isAvailable === "boolean")
    body.isAvailable = input.isAvailable;
  if (input.joiningDate) body.joiningDate = input.joiningDate;

  const res = await authFetch("/profiles/drivers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await readAuthJson<{ profile: DriverProfile }>(res);
  return data.profile;
}
