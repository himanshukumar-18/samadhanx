/**
 * Problem Pod API client.
 *
 * A "Problem Pod" in SamadhanX maps 1:1 to a SolutionProject on the backend.
 * This module provides fully typed access to all pod-related endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PodStatus =
  | 'planning'
  | 'in_progress'
  | 'prototype'
  | 'review'
  | 'pilot'
  | 'completed'
  | 'rejected';

export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface PodMember {
  id: string;
  project_id: string;
  user_id: string;
  role_in_team: string;
  created_at: string;
  member_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface PodUpdate {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string | null;
  title: string;
  content: string;
  prototype_url: string | null;
  media_urls: string[];
  created_at: string;
}

export interface PodReview {
  id: string;
  project_id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  decision: ReviewDecision;
  feedback_text: string;
  created_at: string;
}

export interface Pod {
  id: string;

  // Core
  team_name: string;
  title: string;
  description: string;
  repository_url: string | null;
  status: PodStatus;
  created_at: string;
  updated_at: string;

  // Pod lead
  lead_student_id: string;
  lead_student_name: string | null;

  // Faculty mentor
  faculty_mentor_id: string | null;
  faculty_mentor_name: string | null;
  faculty_mentor_department: string | null;

  // University
  university_id: string | null;

  // Problem summary
  problem_id: string;
  problem_title: string | null;
  problem_category: string | null;
  problem_location: string | null;
  problem_district: string | null;
  problem_state: string | null;
  problem_status: string | null;
  problem_impact_level: string | null;

  // Computed
  progress: number;
  member_count: number;

  // Nested
  members: PodMember[];
  updates: PodUpdate[];
  reviews: PodReview[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map backend status to a friendly UI label.
 */
export const POD_STATUS_LABEL: Record<PodStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  prototype: 'In Progress',
  review: 'Submitted',
  pilot: 'Submitted',
  completed: 'Completed',
  rejected: 'Needs Revision',
};

/**
 * Return the Tailwind badge colour classes for a given pod status.
 */
export const podStatusVariant = (
  s: PodStatus
): 'planning' | 'active' | 'submitted' | 'completed' | 'rejected' => {
  switch (s) {
    case 'planning':
      return 'planning';
    case 'in_progress':
    case 'prototype':
      return 'active';
    case 'review':
    case 'pilot':
      return 'submitted';
    case 'completed':
      return 'completed';
    case 'rejected':
      return 'rejected';
    default:
      return 'planning';
  }
};

/**
 * True when the pod can be submitted for faculty review.
 */
export const canSubmitForReview = (pod: Pod): boolean =>
  ['planning', 'in_progress', 'prototype'].includes(pod.status);

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const podsApi = {
  /**
   * Return all pods where the current user is lead or member.
   */
  listMyPods: async (params?: {
    status?: PodStatus;
    offset?: number;
    limit?: number;
  }): Promise<Pod[]> => {
    const res = await apiClient.get('/student/projects', { params });
    return res.data;
  },

  /**
   * Get full pod detail (members, updates, reviews).
   * Backend enforces BOLA: caller must be member/lead/mentor/admin.
   */
  getPodDetail: async (podId: string): Promise<Pod> => {
    const res = await apiClient.get(`/projects/${podId}`);
    return res.data;
  },

  /**
   * Create a new solution pod for a problem.
   */
  createPod: async (data: {
    problem_id: string;
    team_name: string;
    title: string;
    description: string;
    repository_url?: string;
    faculty_mentor_id?: string;
  }): Promise<Pod> => {
    const res = await apiClient.post('/student/pick-project', data);
    return res.data;
  },

  /**
   * Submit pod for faculty review (lead only).
   * Valid when status is planning / in_progress / prototype.
   */
  submitForReview: async (podId: string): Promise<Pod> => {
    const res = await apiClient.post(`/projects/${podId}/submit`);
    return res.data;
  },

  /**
   * Post a milestone / engineering update to the pod log.
   */
  addUpdate: async (
    podId: string,
    data: {
      title: string;
      content: string;
      prototype_url?: string;
      media_urls?: string[];
    }
  ): Promise<PodUpdate> => {
    const res = await apiClient.post(`/projects/${podId}/updates`, data);
    return res.data;
  },

  /**
   * Add a student to the pod team (lead only).
   */
  addMember: async (
    podId: string,
    data: { user_id: string; role_in_team?: string }
  ): Promise<PodMember> => {
    const res = await apiClient.post(`/projects/${podId}/members`, data);
    return res.data;
  },

  /**
   * Get faculty review decisions for this pod.
   */
  listReviews: async (podId: string): Promise<PodReview[]> => {
    const res = await apiClient.get(`/projects/${podId}/reviews`);
    return res.data;
  },

  /**
   * Browse all public pods (for Teams directory / industry scouting).
   */
  listPublicPods: async (params?: {
    problem_id?: string;
    status?: PodStatus;
    university_id?: string;
    offset?: number;
    limit?: number;
  }): Promise<Pod[]> => {
    const res = await apiClient.get('/projects', { params });
    return res.data;
  },

  /**
   * Discover student innovators for pod team building.
   */
  listPeople: async (params?: { search?: string; limit?: number }): Promise<
    {
      id: string;
      full_name: string;
      department: string;
      graduation_year: number | null;
      institution_name: string;
      skills: string[];
      email: string | null;
    }[]
  > => {
    const res = await apiClient.get('/student/people', { params });
    return res.data;
  },
};
