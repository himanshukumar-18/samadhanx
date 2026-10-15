import { apiClient } from './client';
import { ProblemCategory, ImpactLevel } from '../types/problem';

export interface AssistantProblemState {
  category?: ProblemCategory | string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  district?: string | null;
  duration?: string | null;
  affected_people?: string | null;
  impact?: string | null;
  severity?: ImpactLevel | null;
  evidence?: string[];
  latitude?: number | null;
  longitude?: number | null;
  media_urls?: string[];
  conversation_complete?: boolean;
}

export interface GeneratedProblemDraft {
  title: string;
  description: string;
  category: ProblemCategory | string;
  location: string;
  district: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  media_urls?: string[];
  duration?: string | null;
  affected_people?: string | null;
  impact?: string | null;
  severity: ImpactLevel;
  tags?: string[];
}

export interface DuplicateCandidatePublic {
  id: string;
  title: string;
  category: string;
  district: string;
  status: string;
  endorsement_count: number;
  similarity_label: string;
}

export interface AssistantTurnResponse {
  session_id: string;
  message: string;
  type: 'question' | 'complete' | 'clarification';
  field?: string | null;
  suggested_answers?: string[];
  state: AssistantProblemState;
  progress: number;
  complete: boolean;
  turn_count: number;
  max_turns: number;
  problem?: GeneratedProblemDraft | null;
  similar_problems?: DuplicateCandidatePublic[];
}

export const citizenAssistantApi = {
  createSession: async (initialMessage?: string, districtHint?: string): Promise<{ success: boolean; data: AssistantTurnResponse }> =>
    (await apiClient.post('/citizen/ai-assistant/sessions', { initial_message: initialMessage, district_hint: districtHint })).data,

  sendMessage: async (sessionId: string, message: string): Promise<{ success: boolean; data: AssistantTurnResponse }> =>
    (await apiClient.post(`/citizen/ai-assistant/sessions/${sessionId}/messages`, { message })).data,

  finalizeSession: async (sessionId: string): Promise<{ success: boolean; data: AssistantTurnResponse }> =>
    (await apiClient.post(`/citizen/ai-assistant/sessions/${sessionId}/finalize`)).data,

  getSession: async (sessionId: string): Promise<{ success: boolean; data: AssistantTurnResponse }> =>
    (await apiClient.get(`/citizen/ai-assistant/sessions/${sessionId}`)).data,

  deleteSession: async (sessionId: string): Promise<{ success: boolean; data: { deleted: boolean } }> =>
    (await apiClient.delete(`/citizen/ai-assistant/sessions/${sessionId}`)).data,
};

export const facultyAIReviewApi = {
  assist: async (podId: string) => (await apiClient.post(`/faculty/pods/${podId}/ai-review-assist`)).data,
};

export const adminImpactApi = {
  generate: async (period: '7d' | '30d' | 'all', district?: string) => (await apiClient.post('/admin/ai/impact-report', { period, district })).data,
  latest: async () => (await apiClient.get('/admin/ai/impact-report/latest')).data,
};
