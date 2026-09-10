import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ImpactSDGMetric(BaseModel):
    code: str
    title: str
    count: int
    percentage: float
    color: str

    model_config = ConfigDict(from_attributes=True)


class ImpactDepartmentMetric(BaseModel):
    department: str
    faculty_count: int
    students_count: int
    projects_count: int
    patents_count: int

    model_config = ConfigDict(from_attributes=True)


class ImpactTopProject(BaseModel):
    id: uuid.UUID
    title: str
    team_name: str
    problem_title: str | None = None
    category: str | None = None
    status: str
    impact_level: str | None = None
    upvotes: int = 0
    faculty_mentor_name: str | None = None
    lead_student_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ImpactAccreditationScore(BaseModel):
    nirf_innovation_score: float = Field(..., description="Score out of 100 based on NIRF Innovation parameters")
    naac_criterion_3_score: float = Field(..., description="Score out of 100 for NAAC Criterion 3 (Research & Innovation)")
    naac_criterion_7_score: float = Field(..., description="Score out of 100 for NAAC Criterion 7 (Social Responsibility)")
    kapila_utilization_rate: float = Field(..., description="Percentage of eligible prototypes with IP filed")
    overall_readiness_index: float = Field(..., description="Weighted composite institutional accreditation score (0-100)")

    model_config = ConfigDict(from_attributes=True)


class InstitutionalImpactResponse(BaseModel):
    university_name: str
    aishe_code: str | None = None
    state: str | None = None
    district: str | None = None
    user_role: str
    total_solutions_count: int
    active_innovator_students_count: int
    faculty_mentors_count: int
    solved_problems_count: int
    patents_filed_count: int
    patents_granted_count: int
    industry_partnerships_count: int
    csr_funds_mobilized: str
    estimated_citizens_impacted: int
    sdg_breakdown: list[ImpactSDGMetric]
    departmental_breakdown: list[ImpactDepartmentMetric]
    top_projects: list[ImpactTopProject]
    accreditation_readiness: ImpactAccreditationScore
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
