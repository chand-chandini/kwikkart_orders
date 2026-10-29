export interface User {
  id: number;
  name: string | null;
  mobile: string;
  email: string | null;
  profile_image: string | null;
  language: string | null;
  is_profile_complete: boolean;
  role_preference: number | null;
}

export interface VerifyOtpResponse {
  token: string;
  user: User;
}

export interface CompleteProfilePayload {
  name: string;
  email?: string;
  profile_image?: string;
  language?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  profile_image?: string;
  language?: string;
}
