import { apiClient } from './client';

export const projectsApi = {
  getStudentDashboard: async () => {
    const res = await apiClient.get('/student/dashboard');
    return res.data;
  },

  listMyProjects: async () => {
    const res = await apiClient.get('/student/projects');
    return res.data;
  },

  pickProject: async (data: {
    problem_id: string;
    team_name: string;
    title: string;
    description: string;
    repository_url?: string;
    faculty_mentor_id?: string;
  }) => {
    const res = await apiClient.post('/student/pick-project', data);
    return res.data;
  },

  listProjects: async (params?: { problem_id?: string; status?: string; university_id?: string; offset?: number; limit?: number }) => {
    const res = await apiClient.get('/projects', { params });
    return res.data;
  },

  getProjectDetail: async (id: string) => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data;
  },

  addProjectUpdate: async (id: string, data: { title: string; content: string; prototype_url?: string; media_urls?: string[] }) => {
    const res = await apiClient.post(`/projects/${id}/updates`, data);
    return res.data;
  },

  addProjectMember: async (id: string, data: { user_id: string; role_in_team?: string }) => {
    const res = await apiClient.post(`/projects/${id}/members`, data);
    return res.data;
  },

  listPeople: async (params?: { search?: string; limit?: number }) => {
    const res = await apiClient.get('/student/people', { params });
    return res.data;
  },
};
