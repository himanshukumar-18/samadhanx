import { apiClient } from './client';

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

export interface AccountSettingsData {
  email_notifications: boolean;
  push_notifications: boolean;
  public_profile: boolean;
  show_contact: boolean;
}

export const profileApi = {
  getMyProfile: async (): Promise<UserProfileDetail> => {
    const res = await apiClient.get('/profile/me');
    return res.data;
  },

  getPublicProfile: async (userId: string): Promise<UserProfileDetail> => {
    const res = await apiClient.get(`/profile/user/${userId}`);
    return res.data;
  },

  updateMyProfile: async (data: Partial<UserProfileDetail>): Promise<UserProfileDetail> => {
    const res = await apiClient.patch('/profile/me', data);
    return res.data;
  },

  uploadMedia: async (file: File, mediaType: 'avatar' | 'cover' = 'avatar') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);

    const res = await apiClient.post('/profile/upload-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

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
