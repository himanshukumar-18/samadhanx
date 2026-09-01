import { apiClient } from './client';

export const adminApi = {
  listRestrictedRequests: async (status_filter?: string) => {
    const res = await apiClient.get('/admin/requests', { params: { status_filter } });
    return res.data;
  },

  approveRequest: async (requestId: string) => {
    const res = await apiClient.patch(`/admin/requests/${requestId}/approve`);
    return res.data;
  },

  rejectRequest: async (requestId: string, rejection_reason?: string) => {
    const res = await apiClient.patch(`/admin/requests/${requestId}/reject`, { rejection_reason });
    return res.data;
  },

  moderateProblem: async (problemId: string, data: { status: string; is_verified?: boolean }) => {
    const res = await apiClient.patch(`/admin/problems/${problemId}/moderate`, data);
    return res.data;
  },

  listAuditLogs: async (limit = 50) => {
    const res = await apiClient.get('/admin/audit-logs', { params: { limit } });
    return res.data;
  },
};
