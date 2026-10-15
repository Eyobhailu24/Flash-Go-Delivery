export type UserRole = 'customer' | 'driver' | 'business' | 'admin';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phoneNumber: string | null;
};

export type SignupInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
};

export type VerifyOtpInput = {
  phoneNumber: string;
  otp: string;
};

export type LoginInput = {
  phoneNumber: string;
  password: string;
};

export type LoginResult =
  | { requiresVerification: false; user: AuthUser }
  | { requiresVerification: true; phoneNumber: string };

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ResetPasswordInput = {
  phoneNumber: string;
  otp: string;
  newPassword: string;
};
