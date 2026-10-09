import { apiClient } from './client';

export interface AdminSummaryCounts {
  pending_partner_requests: number;
  pending_institution_verifications: number;
  pending_problem_moderations: number;
  total_verified_institutions: number;
  total_users: number;
  total_problems: number;
}

export interface RestrictedRequestItem {
  id: string;
  user_id: string;
  org_type: 'university' | 'industry';
  org_name: string;
  registration_identifier?: string | null;
  nodal_officer_name: string;
  official_email: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface AuditLogItem {
  id: string;
  actor_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  metadata_json?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface ModerationProblemItem {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  district: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'in_progress' | 'solution_submitted' | 'pilot' | 'solved';
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  created_by_id: string;
  is_verified: boolean;
  media_urls?: string[];
  tags?: string[];
  likes_count: number;
  comments_count: number;
  active_teams_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
  };
}

export interface AdminAnalytics {
  total_users: number;
  active_users: number;
  verified_users: number;
  user_roles: {
    citizens: number;
    students: number;
    faculty: number;
    universities: number;
    industry: number;
    admins: number;
  };
  total_problems: number;
  verified_problems: number;
  solved_problems: number;
  problem_statuses: {
    submitted: number;
    under_review: number;
    verified: number;
    in_progress: number;
    solution_submitted: number;
    pilot: number;
    solved: number;
    rejected: number;
  };
  categories_breakdown: Array<{
    category: string;
    count: number;
  }>;
  total_projects: number;
  completed_projects: number;
  project_statuses: {
    planning: number;
    in_progress: number;
    prototype: number;
    review: number;
    pilot: number;
    completed: number;
    rejected: number;
  };
  total_institutions: number;
  verified_institutions: number;
  pending_institution_requests: number;
  generated_at: string;
}

export const adminApi = {
  getSummaryCounts: async (): Promise<{ success: boolean; data: AdminSummaryCounts }> => {
    const res = await apiClient.get('/admin/summary-counts');
    return res.data;
  },

  listRestrictedRequests: async (params?: {
    status_filter?: string;
    org_type?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: RestrictedRequestItem[]; message?: string }> => {
    const queryParams: Record<string, unknown> = {};
    if (params?.status_filter && params.status_filter !== 'all') queryParams.status_filter = params.status_filter;
    if (params?.org_type && params.org_type !== 'all') queryParams.org_type = params.org_type;
    if (params?.q) queryParams.q = params.q;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get('/admin/requests', { params: queryParams });
    return res.data;
  },

  approveRequest: async (requestId: string): Promise<{ success: boolean; data: RestrictedRequestItem; message?: string }> => {
    const res = await apiClient.patch(`/admin/requests/${requestId}/approve`);
    return res.data;
  },

  rejectRequest: async (requestId: string, rejection_reason?: string): Promise<{ success: boolean; data: RestrictedRequestItem; message?: string }> => {
    const res = await apiClient.patch(`/admin/requests/${requestId}/reject`, { rejection_reason });
    return res.data;
  },

  listModerationProblems: async (params?: {
    status_filter?: string;
    category?: string;
    is_verified?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: ModerationProblemItem[]; message?: string }> => {
    const queryParams: Record<string, unknown> = {};
    if (params?.status_filter && params.status_filter !== 'all') queryParams.status_filter = params.status_filter;
    if (params?.category) queryParams.category = params.category;
    if (params?.is_verified !== undefined) queryParams.is_verified = params.is_verified;
    if (params?.q) queryParams.q = params.q;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get('/admin/moderation/problems', { params: queryParams });
    return res.data;
  },

  moderateProblem: async (problemId: string, data: { status: string; is_verified?: boolean }): Promise<ModerationProblemItem> => {
    const res = await apiClient.patch(`/admin/problems/${problemId}/moderate`, data);
    return res.data;
  },

  listAuditLogs: async (params?: {
    action?: string;
    target_type?: string;
    actor_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: AuditLogItem[]; message?: string }> => {
    const queryParams: Record<string, unknown> = {};
    if (params?.action) queryParams.action = params.action;
    if (params?.target_type) queryParams.target_type = params.target_type;
    if (params?.actor_id) queryParams.actor_id = params.actor_id;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get('/admin/audit-logs', { params: queryParams });
    return res.data;
  },

  getPlatformAnalytics: async (): Promise<{ success: boolean; data: AdminAnalytics; message?: string }> => {
    const res = await apiClient.get('/admin/analytics');
    return res.data;
  },

  getProblemAIAnalysis: async (problemId: string): Promise<{
    success: boolean;
    data: {
      latest: AIAnalysisData | null;
      history: AIAnalysisData[];
    };
    message?: string;
  }> => {
    const res = await apiClient.get(`/admin/problems/${problemId}/ai-analysis`);
    return res.data;
  },

  /**
   * On-demand synchronous AI analysis generation.
   * Returns cached result immediately if within cooldown, otherwise runs full pipeline inline.
   * Error codes: AI_ANALYSIS_TIMEOUT | AI_ANALYSIS_FAILED | AI_SERVICE_UNAVAILABLE
   */
  generateProblemAIAnalysis: async (
    problemId: string,
    params?: { force?: boolean }
  ): Promise<{ success: boolean; data: AIAnalysisData; message?: string }> => {
    const res = await apiClient.post(`/admin/problems/${problemId}/ai-analysis`, params || {});
    return res.data;
  },

  reanalyzeProblemAI: async (
    problemId: string,
    params?: { force?: boolean; reason?: string }
  ): Promise<{ success: boolean; data: AIAnalysisData; message?: string }> => {
    const res = await apiClient.post(`/admin/problems/${problemId}/reanalyze-ai`, params || {});
    return res.data;
  },
};


export interface AIAnalysisData {
  id: string;
  problem_id: string;
  analysis_version: number;
  status: 'not_started' | 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'timeout';
  provider: string;
  model_name: string;
  prompt_version: string;
  trigger?: string | null;
  started_at?: string | null;
  category?: string | null;
  subcategory?: string | null;
  summary?: string | null;
  keywords?: string[];
  spam_probability?: number | null;
  spam_reasons?: string[];
  quality_score?: number | null;
  confidence?: number | null;
  risk_flags?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }>;
  duplicate_signal?: {
    potential_duplicate: boolean;
    similar_problem_ids: string[];
    similarity_score: number;
    rationale?: string | null;
  } | null;
  recommendation?: 'normal_review' | 'spam_review' | 'high_risk_escalation' | 'human_review_required' | null;
  reason?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
  started_at_ts?: string | null;
  completed_at?: string | null;
  created_at: string;
}



