import { apiClient } from './client';

export interface IndustrySupportItem {
  id: string;
  project_id: string;
  industry_user_id: string;
  company_name: string;
  support_type: string;
  amount_or_terms: string;
  status: 'approved' | 'rejected' | 'pending';
  created_at: string;
  project_title?: string | null;
  problem_title?: string | null;
  university_name?: string | null;
}

export interface ProjectSeekingSupport {
  id: string;
  title: string;
  team_name: string;
  description: string;
  problem_title?: string | null;
  university_name?: string | null;
  status: string;
  created_at: string;
}

export interface IndustryPartnershipsOverview {
  partnerships: IndustrySupportItem[];
  available_projects: ProjectSeekingSupport[];
  total_partnerships_count: number;
  active_grants_count: number;
  pending_reviews_count: number;
  user_role: string;
  company_name?: string | null;
}

export const industryApi = {
  getIndustryDashboard: async () => {
    const res = await apiClient.get('/industry/dashboard');
    return res.data;
  },

  getPartnershipsOverview: async (): Promise<IndustryPartnershipsOverview> => {
    const res = await apiClient.get('/industry/partnerships');
    return res.data;
  },

  submitSupportIntent: async (data: {
    project_id: string;
    company_name: string;
    support_type: string;
    amount_or_terms: string;
  }) => {
    const res = await apiClient.post('/industry/support', data);
    return res.data;
  },

  listMySupports: async (): Promise<IndustrySupportItem[]> => {
    const res = await apiClient.get('/industry/support/my');
    return res.data;
  },

  updateSupportStatus: async (supportId: string, status: 'approved' | 'rejected' | 'pending') => {
    const res = await apiClient.patch(`/industry/support/${supportId}/status`, { status });
    return res.data;
  },
};
