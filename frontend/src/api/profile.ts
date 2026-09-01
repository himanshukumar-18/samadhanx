import { apiClient } from './client';

export interface UserProfileDetail {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  organization_name?: string | null;
  bio?: string | null;
  headline?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  website?: string | null;
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

  getMySettings: async () => {
    const res = await apiClient.get('/settings/me');
    return res.data;
  },

  updateMySettings: async (data: any) => {
    const res = await apiClient.patch('/settings/me', data);
    return res.data;
  },
};
