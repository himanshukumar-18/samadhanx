import { apiClient } from './client';

export interface UniversityListItem {
  id: string;
  university_name: string;
  state: string;
  district: string;
  is_approved: boolean;
}

export const authApi = {
  getApprovedUniversities: async (): Promise<UniversityListItem[]> => {
    const res = await apiClient.get('/auth/universities');
    return res.data.data;
  },

  registerCitizen: async (data: any) => {
    const res = await apiClient.post('/auth/register/citizen', data);
    return res.data;
  },

  registerStudent: async (data: any) => {
    const res = await apiClient.post('/auth/register/student', data);
    return res.data;
  },

  registerUniversityRequest: async (data: any) => {
    const res = await apiClient.post('/auth/register/university-request', data);
    return res.data;
  },

  registerIndustryRequest: async (data: any) => {
    const res = await apiClient.post('/auth/register/industry-request', data);
    return res.data;
  },

  verifyOtp: async (data: { email: string; otp_code: string; purpose?: string }) => {
    const res = await apiClient.post('/auth/verify-otp', data);
    return res.data;
  },

  resendOtp: async (data: { email: string; purpose?: string }) => {
    const res = await apiClient.post('/auth/resend-otp', data);
    return res.data;
  },

  forgotPassword: async (data: { email: string }) => {
    const res = await apiClient.post('/auth/forgot-password', data);
    return res.data;
  },

  resetPassword: async (data: { email: string; otp_code: string; new_password: string }) => {
    const res = await apiClient.post('/auth/reset-password', data);
    return res.data;
  },

  login: async (data: { email: string; password: string }) => {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  },
};
