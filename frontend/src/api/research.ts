import { apiClient } from './client';

export interface PatentItem {
  id: string;
  project_id?: string | null;
  university_id?: string | null;
  inventor_id: string;
  title: string;
  application_number: string;
  filing_date: string;
  status: string;
  patent_office: string;
  abstract: string;
  field_of_invention: string;
  commercial_readiness: string;
  grant_number?: string | null;
  grant_date?: string | null;
  project_title?: string | null;
  university_name?: string | null;
  inventor_name?: string | null;
  created_at: string;
}

export interface EligibleProject {
  id: string;
  title: string;
  team_name: string;
  description: string;
  status: string;
  university_name?: string | null;
  problem_title?: string | null;
  created_at: string;
}

export interface PatentsOverviewResponse {
  patents: PatentItem[];
  eligible_projects: EligibleProject[];
  total_patents_count: number;
  granted_patents_count: number;
  provisional_filed_count: number;
  under_examination_count: number;
  commercial_ready_count: number;
  user_role: string;
  university_name?: string | null;
}

export interface PatentCreatePayload {
  project_id?: string | null;
  title: string;
  application_number: string;
  filing_date: string;
  status?: string;
  patent_office?: string;
  abstract: string;
  field_of_invention?: string;
  commercial_readiness?: string;
}

export interface PatentUpdateStatusPayload {
  status: string;
  grant_number?: string | null;
  grant_date?: string | null;
}

export const researchApi = {
  getPatentsOverview: async (): Promise<PatentsOverviewResponse> => {
    const res = await apiClient.get('/research/patents');
    return res.data;
  },

  filePatent: async (data: PatentCreatePayload): Promise<PatentItem> => {
    const res = await apiClient.post('/research/patents', data);
    return res.data;
  },

  updatePatentStatus: async (
    patentId: string,
    data: PatentUpdateStatusPayload
  ): Promise<PatentItem> => {
    const res = await apiClient.patch(`/research/patents/${patentId}/status`, data);
    return res.data;
  },
};
