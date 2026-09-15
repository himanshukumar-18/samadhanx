import { apiClient } from './client';

// ─── Legacy / Partnerships Types ─────────────────────────────────────────────

export interface IndustrySupportItem {
  id: string;
  project_id: string;
  industry_user_id: string;
  company_name: string;
  support_type: string;
  amount_or_terms: string;
  status: 'approved' | 'rejected' | 'pending' | 'withdrawn';
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

// ─── Phase E Types ────────────────────────────────────────────────────────────

export interface VettedProjectListItem {
  id: string;
  title: string;
  team_name: string;
  description: string;
  status: string;
  problem_title?: string | null;
  problem_category?: string | null;
  problem_state?: string | null;
  problem_district?: string | null;
  university_name?: string | null;
  member_count: number;
  created_at: string;
}

export interface FacultyReviewSummary {
  id: string;
  decision: string;
  feedback?: string | null;
  reviewer_name?: string | null;
  created_at: string;
}

export interface PodUpdateSummary {
  id: string;
  content: string;
  milestone?: string | null;
  created_at: string;
}

export interface VettedProjectDetail {
  id: string;
  title: string;
  team_name: string;
  description: string;
  status: string;
  repository_url?: string | null;
  problem_title?: string | null;
  problem_category?: string | null;
  problem_state?: string | null;
  problem_district?: string | null;
  problem_impact_level?: string | null;
  university_name?: string | null;
  member_count: number;
  progress: number;
  latest_faculty_review?: FacultyReviewSummary | null;
  recent_updates: PodUpdateSummary[];
  created_at: string;
}

export interface IndustryDashboardStats {
  company_name?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  is_approved: boolean;
  total_offers: number;
  pending_offers: number;
  accepted_offers: number;
  withdrawn_offers: number;
  funded_pods_count: number;
  vetted_pods_available: number;
}

export interface FundingOfferResponse {
  id: string;
  project_id: string;
  industry_user_id: string;
  company_name: string;
  support_type: string;
  amount_or_terms: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  project_title?: string | null;
  problem_title?: string | null;
  university_name?: string | null;
}

export interface FundedProjectCommentResponse {
  id: string;
  pod_id: string;
  industry_user_id: string;
  comment: string;
  company_name: string;
  commenter_name?: string | null;
  created_at: string;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const industryApi = {
  // ── Legacy / Partnerships ──────────────────────────────────────────────────
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

  // ── Phase E: Dashboard ─────────────────────────────────────────────────────
  getDashboardStats: async (): Promise<IndustryDashboardStats> => {
    const res = await apiClient.get('/industry/dashboard/stats');
    return res.data;
  },

  // ── Phase E: Vetted Projects Discovery ────────────────────────────────────
  listVettedProjects: async (params?: {
    category?: string;
    state?: string;
    offset?: number;
    limit?: number;
  }): Promise<VettedProjectListItem[]> => {
    const res = await apiClient.get('/industry/vetted-projects', { params });
    return res.data;
  },

  getVettedProjectDetail: async (podId: string): Promise<VettedProjectDetail> => {
    const res = await apiClient.get(`/industry/vetted-projects/${podId}`);
    return res.data;
  },

  // ── Phase E: Funding Offers ───────────────────────────────────────────────
  createFundingOffer: async (data: {
    pod_id: string;
    support_type: string;
    amount_or_terms: string;
    message?: string;
  }): Promise<FundingOfferResponse> => {
    const res = await apiClient.post('/industry/offers', data);
    return res.data;
  },

  listMyOffers: async (): Promise<FundingOfferResponse[]> => {
    const res = await apiClient.get('/industry/offers/my');
    return res.data;
  },

  withdrawOffer: async (offerId: string): Promise<FundingOfferResponse> => {
    const res = await apiClient.patch(`/industry/offers/${offerId}/withdraw`);
    return res.data;
  },

  // ── Phase E: Funded Projects ──────────────────────────────────────────────
  listFundedProjects: async (): Promise<FundingOfferResponse[]> => {
    const res = await apiClient.get('/industry/funded-projects');
    return res.data;
  },

  getPodUpdatesAsFunder: async (podId: string): Promise<PodUpdateSummary[]> => {
    const res = await apiClient.get(`/industry/funded-projects/${podId}/updates`);
    return res.data;
  },

  getImpactReportAsFunder: async (podId: string) => {
    const res = await apiClient.get(`/industry/funded-projects/${podId}/impact-report`);
    return res.data;
  },

  // ── Phase E: Funder Comments ──────────────────────────────────────────────
  listPodComments: async (podId: string): Promise<FundedProjectCommentResponse[]> => {
    const res = await apiClient.get(`/industry/funded-projects/${podId}/comments`);
    return res.data;
  },

  addPodComment: async (podId: string, comment: string): Promise<FundedProjectCommentResponse> => {
    const res = await apiClient.post(`/industry/funded-projects/${podId}/comments`, { comment });
    return res.data;
  },
};
