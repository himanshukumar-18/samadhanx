import { apiClient } from './client';

export interface InstitutionMasterItem {
  id: string;
  name: string;
  official_name?: string | null;
  short_name?: string | null;
  institution_type: string;
  ownership_type: string;
  aishe_code?: string | null;
  ugc_code?: string | null;
  city?: string | null;
  district: string;
  state: string;
  website?: string | null;
  verification_status: string;
  is_active: boolean;
}

export interface InstitutionDetail {
  id: string;
  name: string;
  official_name?: string | null;
  short_name?: string | null;
  institution_type: string;
  ownership_type: string;
  aishe_code?: string | null;
  ugc_code?: string | null;
  city?: string | null;
  district: string;
  state: string;
  pincode?: string | null;
  address?: string | null;
  website?: string | null;
  verification_status: string;
  source: string;
  last_verified_at?: string | null;
}

export interface InstitutionVerificationRequestPayload {
  submitted_by_email: string;
  requested_name: string;
  institution_type: string;
  state: string;
  district: string;
  city?: string;
  official_website?: string;
  aishe_code?: string;
  ugc_code?: string;
  additional_notes?: string;
}

export interface InstitutionVerificationRequestItem {
  id: string;
  submitted_by_email: string;
  submitted_by_user_id?: string | null;
  requested_name: string;
  institution_type: string;
  state: string;
  district: string;
  city?: string | null;
  official_website?: string | null;
  aishe_code?: string | null;
  ugc_code?: string | null;
  additional_notes?: string | null;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  approved_institution_id?: string | null;
  created_at: string;
}

export interface InstitutionSyncRunItem {
  id: string;
  source_name: string;
  status: string;
  records_processed: number;
  records_added: number;
  records_updated: number;
  records_failed: number;
  started_at: string;
  completed_at?: string | null;
  error_summary?: string | null;
}

export const institutionsApi = {
  // Public Discovery
  searchPublicInstitutions: async (params?: {
    q?: string;
    state?: string;
    institution_type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const res = await apiClient.get('/public/institutions', { params });
    return res.data;
  },

  getPublicInstitutionDetail: async (id: string) => {
    const res = await apiClient.get(`/public/institutions/${id}`);
    return res.data;
  },

  submitVerificationRequest: async (payload: InstitutionVerificationRequestPayload) => {
    const res = await apiClient.post('/public/institutions/request-verification', payload);
    return res.data;
  },

  // Admin Governance
  listAdminRequests: async (status_filter?: string, limit = 50, offset = 0) => {
    const res = await apiClient.get('/admin/institutions/requests', {
      params: { status_filter, limit, offset },
    });
    return res.data;
  },

  approveRequest: async (requestId: string, overrides?: Record<string, unknown>) => {
    const res = await apiClient.patch(`/admin/institutions/requests/${requestId}/approve`, overrides);
    return res.data;
  },

  rejectRequest: async (requestId: string, rejection_reason: string) => {
    const res = await apiClient.patch(`/admin/institutions/requests/${requestId}/reject`, {
      rejection_reason,
    });
    return res.data;
  },

  listAdminInstitutions: async (params?: {
    q?: string;
    state?: string;
    verification_status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const res = await apiClient.get('/admin/institutions', { params });
    return res.data;
  },

  listSyncLogs: async (limit = 20, offset = 0) => {
    const res = await apiClient.get('/admin/institutions/sync-logs', {
      params: { limit, offset },
    });
    return res.data;
  },

  importCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/admin/institutions/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
