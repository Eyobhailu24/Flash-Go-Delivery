import { authFetch, readAuthJson } from '@/lib/auth-api';

export type CustomerAddress = {
  label?: string;
  address: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};

export type CustomerProfile = {
  userId: string;
  addresses?: CustomerAddress[];
  preferences?: Record<string, unknown>;
  loyaltyPoints: number;
  createdAt: string;
};

type CustomerProfileResponse = {
  profile: CustomerProfile | null;
};

export async function fetchMyCustomerProfile(): Promise<CustomerProfile | null> {
  const response = await authFetch('/auth/customer-profile');
  const data = await readAuthJson<CustomerProfileResponse>(response);
  return data.profile;
}

export async function patchMyCustomerProfile(input: {
  addresses?: CustomerAddress[];
  preferences?: Record<string, unknown>;
}): Promise<CustomerProfile> {
  const response = await authFetch('/auth/customer-profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const data = await readAuthJson<{ profile: CustomerProfile }>(response);
  return data.profile;
}
