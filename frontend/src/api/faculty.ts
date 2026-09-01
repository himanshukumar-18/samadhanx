import { apiClient } from './client';

export const facultyApi = {
  getFacultyDashboard: async () => {
    const res = await apiClient.get('/faculty/dashboard');
    return res.data;
  },

  submitProjectReview: async (projectId: string, data: { decision: 'approved' | 'rejected' | 'changes_requested' | 'pending'; feedback_text: string }) => {
    const res = await apiClient.post(`/faculty/projects/${projectId}/reviews`, data);
    return res.data;
  },

  listProjectReviews: async (projectId: string) => {
    const res = await apiClient.get(`/faculty/projects/${projectId}/reviews`);
    return res.data;
  },
};
