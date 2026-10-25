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

export type { FacultyAIReviewData } from './faculty';

export const facultyAIReviewApi = {
  assist: async (projectId: string) => (await apiClient.post(`/faculty/projects/${projectId}/ai-review`)).data,
};


export interface AdminAIImpactReportData {
  report: {
    headline: string;
    executive_summary: string;
    key_achievements: string[];
    problem_impact: string;
    community_engagement: string;
    student_impact: string;
    collaboration_impact: string;
    key_insights: string[];
    areas_needing_attention: string[];
    recommended_next_steps: string[];
    is_data_limited?: boolean;
  };
  statistics: {
    users: {
      total: number;
      citizens: number;
      students: number;
      faculty: number;
      universities: number;
      industry: number;
      admins: number;
      active_users: number;
      verified_users: number;
    };
    problems: {
      total: number;
      approved: number;
      pending: number;
      rejected: number;
      in_progress: number;
      resolved: number;
      status_breakdown: Record<string, number>;
    };
    projects: {
      total: number;
      active: number;
      completed: number;
      status_breakdown: Record<string, number>;
    };
    participation: {
      students_engaged: number;
      solutions_submitted: number;
      updates_posted: number;
    };
    top_categories: Array<{ category: string; count: number }>;
    top_locations: Array<{ location: string; count: number }>;
    recent_activity: Array<{ action: string; target_type: string; timestamp: string }>;
    period: string;
    district?: string | null;
    generated_at: string;
  };
  generated_at: string;
}

export const adminImpactApi = {
  generate: async (
    period: '7d' | '30d' | 'all' = '30d',
    district?: string
  ): Promise<{ success: boolean; data: AdminAIImpactReportData; message: string }> =>
    (await apiClient.post('/admin/ai/impact-report', { period, district: district?.trim() || undefined })).data,

  latest: async (): Promise<{ success: boolean; data: AdminAIImpactReportData | null; message: string }> =>
    (await apiClient.get('/admin/ai/impact-report/latest')).data,
};

