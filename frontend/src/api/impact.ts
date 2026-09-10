import { apiClient } from './client';

export interface ImpactSDGMetric {
  code: string;
  title: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ImpactDepartmentMetric {
  department: string;
  faculty_count: number;
  students_count: number;
  projects_count: number;
  patents_count: number;
}

export interface ImpactTopProject {
  id: string;
  title: string;
  team_name: string;
  problem_title?: string | null;
  category?: string | null;
  status: string;
  impact_level?: string | null;
  upvotes: number;
  faculty_mentor_name?: string | null;
  lead_student_name?: string | null;
  created_at: string;
}

export interface ImpactAccreditationScore {
  nirf_innovation_score: number;
  naac_criterion_3_score: number;
  naac_criterion_7_score: number;
  kapila_utilization_rate: number;
  overall_readiness_index: number;
}

export interface InstitutionalImpactResponse {
  university_name: string;
  aishe_code?: string | null;
  state?: string | null;
  district?: string | null;
  user_role: string;
  total_solutions_count: number;
  active_innovator_students_count: number;
  faculty_mentors_count: number;
  solved_problems_count: number;
  patents_filed_count: number;
  patents_granted_count: number;
  industry_partnerships_count: number;
  csr_funds_mobilized: string;
  estimated_citizens_impacted: number;
  sdg_breakdown: ImpactSDGMetric[];
  departmental_breakdown: ImpactDepartmentMetric[];
  top_projects: ImpactTopProject[];
  accreditation_readiness: ImpactAccreditationScore;
  generated_at: string;
}

export const impactApi = {
  getInstitutionalImpact: async (): Promise<InstitutionalImpactResponse> => {
    const res = await apiClient.get('/impact/institutional');
    return res.data;
  },
};
