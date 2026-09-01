import { apiClient } from './client';

export const socialApi = {
  followUser: async (userId: string) => {
    const res = await apiClient.post(`/social/users/${userId}/follow`);
    return res.data;
  },

  unfollowUser: async (userId: string) => {
    const res = await apiClient.delete(`/social/users/${userId}/unfollow`);
    return res.data;
  },

  getConnectionStats: async (userId: string) => {
    const res = await apiClient.get(`/social/users/${userId}/stats`);
    return res.data;
  },

  listFollowers: async (userId: string) => {
    const res = await apiClient.get(`/social/users/${userId}/followers`);
    return res.data;
  },

  listFollowing: async (userId: string) => {
    const res = await apiClient.get(`/social/users/${userId}/following`);
    return res.data;
  },

  shareProblem: async (problemId: string, platform = 'link') => {
    const res = await apiClient.post(`/social/problems/${problemId}/share`, { platform });
    return res.data;
  },
  toggleSaveProblem: async (problemId: string) => (await apiClient.post(`/social/problems/${problemId}/save`)).data,
  listSavedProblems: async () => (await apiClient.get('/social/problems/saved')).data,
  reportProblem: async (problemId: string, reason: string, details?: string) =>
    (await apiClient.post(`/social/problems/${problemId}/report`, { reason, details })).data,
};
