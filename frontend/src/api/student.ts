import { apiClient } from './client';

export interface StudentProfileData {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  headline?: string | null;
  bio?: string | null;
  department: string;
  graduation_year?: number | null;
  enrollment_number?: string | null;
  university_name?: string | null;
  university_state?: string | null;
  university_district?: string | null;
  aishe_code?: string | null;
  skills: string[];
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  avatar_url?: string | null;
  active_pods_count: number;
  in_review_pods_count: number;
  completed_pods_count: number;
  total_pods_count: number;
  created_at?: string | null;
}

export interface StudentProfileUpdatePayload {
  full_name?: string;
  headline?: string;
  bio?: string;
  department?: string;
  graduation_year?: number;
  enrollment_number?: string;
  skills?: string[];
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

export interface ImpactReportPayload {
  outcome_description: string;
  beneficiaries_reached?: number;
  proof_image_urls?: string[];
}

export const studentApi = {
  getStudentProfile: async (): Promise<StudentProfileData> => {
    const res = await apiClient.get('/student/profile');
    return res.data;
  },

  updateStudentProfile: async (data: StudentProfileUpdatePayload): Promise<StudentProfileData> => {
    const res = await apiClient.patch('/student/profile', data);
    return res.data;
  },

  // ── Find Teammates ──
  listPeople: async (params?: {
    search?: string;
    skill?: string;
    department?: string;
    offset?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get('/student/people', { params });
    return res.data;
  },

  // ── Funding Offers ──
  getFundingOffers: async (podId: string) => {
    const res = await apiClient.get(`/student/pods/${podId}/funding-offers`);
    return res.data;
  },

  respondToOffer: async (offerId: string, decision: 'accepted' | 'declined') => {
    const res = await apiClient.patch(`/student/funding-offers/${offerId}/respond`, null, {
      params: { decision },
    });
    return res.data;
  },

  // ── Impact Report ──
  submitImpactReport: async (podId: string, data: ImpactReportPayload) => {
    const res = await apiClient.post(`/student/pods/${podId}/impact-report`, data);
    return res.data;
  },

  updateImpactReport: async (podId: string, data: ImpactReportPayload) => {
    const res = await apiClient.patch(`/student/pods/${podId}/impact-report`, data);
    return res.data;
  },

  getImpactReport: async (podId: string) => {
    const res = await apiClient.get(`/student/pods/${podId}/impact-report`);
    return res.data;
  },
};
