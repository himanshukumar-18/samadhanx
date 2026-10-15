import { apiClient } from './client';

export interface DuplicateCandidatePublic {
  id: string;
  title: string;
  category: string;
  district: string;
  status: string;
  endorsement_count: number;
  similarity_label: 'very_similar' | 'similar';
}

export interface DuplicateCheckResponse {
  candidates: DuplicateCandidatePublic[];
  degraded: boolean;
}

export interface DuplicateLinkResponse {
  id: string;
  problem_id: string;
  candidate_problem_id: string;
  candidate_title: string;
  candidate_district: string;
  candidate_status: string;
  candidate_category: string;
  similarity: number;
  verdict: 'strong_duplicate' | 'possible_duplicate' | 'related' | 'unique';
  llm_used: boolean;
  llm_reason?: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface MergeResponse {
  success: boolean;
  message: string;
  canonical_problem_id: string;
  merged_problem_id: string;
  endorsements_transferred: number;
}

export interface AIHealthResponse {
  embedder_available: boolean;
  embedding_model: string;
  embedding_dimension: number;
  total_problems: number;
  problems_with_embeddings: number;
  problems_without_embeddings: number;
  duplicate_detection_enabled: boolean;
}

export const duplicatesApi = {
  precheck: async (
    data: {
      title: string;
      description: string;
      category?: string;
      district?: string;
    },
    signal?: AbortSignal
  ): Promise<DuplicateCheckResponse> => {
    const res = await apiClient.post<DuplicateCheckResponse>('/problems/duplicate-check', data, { signal });
    return res.data;
  },

  getProblemDuplicates: async (problemId: string): Promise<DuplicateLinkResponse[]> => {
    const res = await apiClient.get<{ success: boolean; data: DuplicateLinkResponse[] }>(
      `/admin/problems/${problemId}/duplicates`
    );
    return res.data.data;
  },

  runDuplicateDetection: async (problemId: string): Promise<DuplicateLinkResponse[]> => {
    const res = await apiClient.post<{ success: boolean; data: DuplicateLinkResponse[] }>(
      `/admin/problems/${problemId}/duplicates/run`
    );
    return res.data.data;
  },

  mergeProblems: async (problemId: string, targetProblemId: string): Promise<MergeResponse> => {
    const res = await apiClient.post<{ success: boolean; data: MergeResponse }>(
      `/admin/problems/${problemId}/merge`,
      { target_problem_id: targetProblemId }
    );
    return res.data.data;
  },

  dismissDuplicateLink: async (problemId: string, linkId: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post<{ success: boolean; data: { link_id: string } }>(
      `/admin/problems/${problemId}/duplicates/${linkId}/dismiss`
    );
    return res.data;
  },

  getHealth: async (): Promise<AIHealthResponse> => {
    const res = await apiClient.get<{ success: boolean; data: AIHealthResponse }>('/admin/ai/health');
    return res.data.data;
  },
};

