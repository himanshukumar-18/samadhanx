import { apiClient } from './client';

export interface FacultyMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string;
  designation: string;
  research_areas: string[];
  is_active: boolean;
  created_at: string;
}

export interface FacultyInvitation {
  id: string;
  email: string;
  full_name: string;
  department: string;
  designation: string;
  research_areas: string[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
}

export interface PublicInvitationInfo {
  university_name: string;
  email: string;
  full_name: string;
  department: string;
  designation: string;
  expires_at: string;
  is_valid: boolean;
}

export interface FacultyPodItem {
  id: string;
  title: string;
  team_name: string;
  description?: string | null;
  status: string;
  problem_id: string;
  problem_title: string;
  lead_name: string;
  lead_email?: string | null;
  university_name?: string | null;
  is_direct_mentor: boolean;
  member_count: number;
  updated_at: string;
}

export interface FacultyDashboardData {
  faculty_name: string;
  designation: string;
  department: string | null;
  university_name: string | null;
  research_areas: string[];
  assigned_projects_count: number;
  available_pods_count: number;
  pending_reviews_count: number;
  approved_reviews_count: number;
  assigned_projects: FacultyPodItem[];
  available_projects: FacultyPodItem[];
  recent_reviews: Array<{
    id: string;
    project_id: string;
    project_title: string;
    decision: 'approved' | 'rejected' | 'changes_requested';
    feedback_text: string;
    created_at: string;
  }>;
}

export interface FacultyProfileData {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string;
  designation: string;
  research_areas: string[];
  university_name?: string | null;
  university_state?: string | null;
  university_district?: string | null;
  aishe_code?: string | null;
  supervised_pods_count: number;
  approved_reviews_count: number;
}

export const facultyApi = {
  // Public Onboarding
  getInvitationDetails: async (token: string): Promise<PublicInvitationInfo> => {
    const res = await apiClient.get(`/auth/invitations/${encodeURIComponent(token)}`);
    return res.data?.data;
  },

  acceptInvitation: async (
    token: string,
    data: { password: string; full_name?: string; department?: string; designation?: string; research_areas?: string[] }
  ) => {
    const res = await apiClient.post(`/auth/invitations/${encodeURIComponent(token)}/accept`, data);
    return res.data;
  },

  // University Faculty Management Desk
  inviteFaculty: async (data: {
    email: string;
    full_name: string;
    department: string;
    designation: string;
    research_areas: string[];
  }): Promise<FacultyInvitation> => {
    const res = await apiClient.post('/university/faculty/invite', data);
    return res.data?.data;
  },

  listUniversityFaculty: async (params?: { q?: string; department?: string }): Promise<FacultyMember[]> => {
    const res = await apiClient.get('/university/faculty', { params });
    return res.data?.data || [];
  },

  listInvitations: async (status?: string): Promise<FacultyInvitation[]> => {
    const res = await apiClient.get('/university/faculty/invitations', { params: { status } });
    return res.data?.data || [];
  },

  resendInvitation: async (invitationId: string): Promise<FacultyInvitation> => {
    const res = await apiClient.post(`/university/faculty/invitations/${invitationId}/resend`);
    return res.data?.data;
  },

  revokeInvitation: async (invitationId: string) => {
    const res = await apiClient.delete(`/university/faculty/invitations/${invitationId}`);
    return res.data;
  },

  toggleFacultyStatus: async (facultyId: string, isActive?: boolean) => {
    const res = await apiClient.patch(`/university/faculty/${facultyId}/status`, { is_active: isActive });
    return res.data?.data;
  },

  // Faculty Workspace & Mentorship
  getFacultyDashboard: async (): Promise<FacultyDashboardData> => {
    const res = await apiClient.get('/faculty/dashboard');
    return res.data;
  },

  adoptPod: async (projectId: string) => {
    const res = await apiClient.post(`/faculty/projects/${projectId}/adopt`);
    return res.data;
  },

  relinquishPod: async (projectId: string) => {
    const res = await apiClient.delete(`/faculty/projects/${projectId}/relinquish`);
    return res.data;
  },

  getFacultyProfile: async (): Promise<FacultyProfileData> => {
    const res = await apiClient.get('/faculty/profile');
    return res.data;
  },

  updateFacultyProfile: async (data: {
    full_name?: string;
    department?: string;
    designation?: string;
    research_areas?: string[];
  }): Promise<FacultyProfileData> => {
    const res = await apiClient.patch('/faculty/profile', data);
    return res.data;
  },

  submitProjectReview: async (
    projectId: string,
    data: { decision: 'approved' | 'rejected' | 'changes_requested'; feedback_text: string }
  ) => {
    const res = await apiClient.post(`/faculty/projects/${projectId}/reviews`, data);
    return res.data;
  },

  listProjectReviews: async (projectId: string) => {
    const res = await apiClient.get(`/faculty/projects/${projectId}/reviews`);
    return res.data;
  },
};
