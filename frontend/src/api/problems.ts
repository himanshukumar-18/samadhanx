import { apiClient } from './client';

export interface ProblemFilters {
  category?: string;
  status?: string;
  district?: string;
  state?: string;
  is_verified_only?: boolean;
  search?: string;
  feed_type?: string;
  created_by_id?: string;
  offset?: number;
  limit?: number;
}

export const problemsApi = {
  listProblems: async (params?: ProblemFilters) => {
    const res = await apiClient.get('/problems', { params });
    return res.data;
  },

  createProblem: async (data: any) => {
    const res = await apiClient.post('/problems', data);
    return res.data;
  },

  getProblemDetail: async (id: string) => {
    const res = await apiClient.get(`/problems/${id}`);
    return res.data;
  },

  updateProblem: async (id: string, data: any) => {
    const res = await apiClient.patch(`/problems/${id}`, data);
    return res.data;
  },

  deleteProblem: async (id: string) => {
    const res = await apiClient.delete(`/problems/${id}`);
    return res.data;
  },

  addComment: async (id: string, content: string) => {
    const res = await apiClient.post(`/problems/${id}/comments`, { content });
    return res.data;
  },

  listComments: async (id: string) => (await apiClient.get(`/problems/${id}/comments`)).data,
  updateComment: async (id: string, content: string) => (await apiClient.patch(`/problems/comments/${id}`, { content })).data,
  deleteComment: async (id: string) => apiClient.delete(`/problems/comments/${id}`),

  uploadMedia: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await apiClient.post('/problems/upload-media', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },

  toggleEndorsement: async (id: string) => {
    const res = await apiClient.post(`/problems/${id}/endorse`);
    return res.data;
  },

  getCitizenDashboard: async () => {
    const res = await apiClient.get('/citizen/dashboard');
    return res.data;
  },

  getMyProblems: async (offset = 0, limit = 20) => {
    const res = await apiClient.get('/citizen/problems/my', { params: { offset, limit } });
    return res.data;
  },

  getProblemTimeline: async (problemId: string): Promise<CitizenProblemTimelineResponse> => {
    const res = await apiClient.get(`/citizen/problems/${problemId}/timeline`);
    return res.data;
  },
};

export interface TimelineStage {
  stage: string;
  label: string;
  status: 'completed' | 'in_progress' | 'pending' | 'rejected';
  timestamp?: string | null;
  description?: string | null;
  optional?: boolean;
}

export interface PodSummary {
  pod_id: string;
  title: string;
  team_name: string;
  progress_percent: number;
  member_count: number;
  university_name?: string | null;
  status: string;
  repository_url?: string | null;
  created_at: string;
}

export interface ImpactReportSummary {
  id: string;
  beneficiaries_reached: number;
  outcome_description: string;
  proof_image_urls: string[];
  is_verified: boolean;
  created_at: string;
}

export interface CitizenProblemTimelineResponse {
  problem_id: string;
  problem_title: string;
  problem_status: string;
  is_verified: boolean;
  created_at: string;
  timeline: TimelineStage[];
  current_pod?: PodSummary | null;
  impact_report?: ImpactReportSummary | null;
}

