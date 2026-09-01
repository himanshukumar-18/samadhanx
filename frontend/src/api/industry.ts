import { apiClient } from './client';

export const industryApi = {
  getIndustryDashboard: async () => {
    const res = await apiClient.get('/industry/dashboard');
    return res.data;
  },

  submitSupportIntent: async (data: {
    project_id: string;
    company_name: string;
    support_type: 'sponsorship' | 'mentorship' | 'pilot_partner' | 'bounty';
    amount_or_terms: string;
  }) => {
    const res = await apiClient.post('/industry/support', data);
    return res.data;
  },

  listMySupports: async () => {
    const res = await apiClient.get('/industry/support/my');
    return res.data;
  },

  updateSupportStatus: async (supportId: string, status: 'approved' | 'rejected' | 'pending') => {
    const res = await apiClient.patch(`/industry/support/${supportId}/status`, { status });
    return res.data;
  },
};
