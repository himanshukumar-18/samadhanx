import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Shared profile types (Student, Faculty, Industry, University)
// ---------------------------------------------------------------------------

export interface CitizenProfileStats {
  problems_submitted: number;
  problems_approved: number;
  problems_pending: number;
  problems_rejected: number;
  problems_solved: number;
}

export interface UserProfileDetail {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  organization_name?: string | null;
  bio?: string | null;
  headline?: string | null;
  avatar_url?: string | null;
  profile_picture_url?: string | null;
  cover_url?: string | null;
  website?: string | null;
  website_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  skills: string[];
  experience: any[];
  education: any[];
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_verified: boolean;
  created_at: string;
  stats?: CitizenProfileStats | null;
}

// ---------------------------------------------------------------------------
// Citizen-specific types (clean civic identity)
// ---------------------------------------------------------------------------

export interface CitizenActivityStats {
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  solved: number;
}

export interface CitizenProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  email_verified: boolean;
  phone_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  profile_picture_url?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  pincode?: string | null;
  bio?: string | null;
  preferred_language?: string | null;
  interests: string[];
  role: string;
  member_since: string;
  account_status: string;
  activity: CitizenActivityStats;
  created_at: string;
}

export interface CitizenProfileUpdatePayload {
  full_name?: string;
  phone_number?: string;
  date_of_birth?: string;
  gender?: string;
  state?: string;
  district?: string;
  city?: string;
  pincode?: string;
  full_address?: string;
  bio?: string;
  preferred_language?: string;
  interests?: string[];
  profile_picture_url?: string;
}

// ---------------------------------------------------------------------------
// Account Settings
// ---------------------------------------------------------------------------

export interface AccountSettingsData {
  email_notifications: boolean;
  push_notifications: boolean;
  public_profile: boolean;
  show_contact: boolean;
}

// ---------------------------------------------------------------------------
// Public profile types (privacy-clean — no private fields)
// ---------------------------------------------------------------------------

export interface PublicActivityStats {
  submitted: number;
  approved: number;
  solved: number;
}

export interface PublicUserProfile {
  id: string;
  full_name: string;
  profile_picture_url?: string | null;
  role: string;
  bio?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  member_since: string;
  preferred_language?: string | null;
  interests: string[];
  is_active: boolean;
  account_available: boolean;
  activity: PublicActivityStats;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const profileApi = {
  // Shared profile (non-citizen roles)
  getMyProfile: async (): Promise<UserProfileDetail> => {
    const res = await apiClient.get('/profile/me');
    return res.data;
  },

  // Public profile for any user (privacy-clean, no private fields)
  getPublicUserProfile: async (userId: string): Promise<PublicUserProfile> => {
    const res = await apiClient.get(`/profile/user/${userId}`);
    return res.data;
  },

  getUserPublicProblems: async (userId: string, offset = 0, limit = 10): Promise<any[]> => {
    const res = await apiClient.get(`/profile/user/${userId}/problems`, {
      params: { offset, limit },
    });
    return res.data;
  },

  updateMyProfile: async (data: Partial<UserProfileDetail>): Promise<UserProfileDetail> => {
    const res = await apiClient.patch('/profile/me', data);
    return res.data;
  },

  // Citizen-specific profile
  getCitizenProfile: async (): Promise<CitizenProfile> => {
    const res = await apiClient.get('/citizen/profile');
    return res.data;
  },

  updateCitizenProfile: async (data: CitizenProfileUpdatePayload): Promise<CitizenProfile> => {
    const res = await apiClient.patch('/citizen/profile', data);
    return res.data;
  },

  // Avatar / media upload (works for all roles)
  uploadMedia: async (file: File, mediaType: 'avatar' | 'cover' = 'avatar') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);

    const res = await apiClient.post('/profile/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Account settings
  getMySettings: async (): Promise<AccountSettingsData> => {
    const res = await apiClient.get('/settings/me');
    return res.data;
  },

  updateMySettings: async (data: Partial<AccountSettingsData>): Promise<AccountSettingsData> => {
    const res = await apiClient.patch('/settings/me', data);
    return res.data;
  },

  deleteMyAccount: async (): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete('/settings/me');
    return res.data;
  },
};
