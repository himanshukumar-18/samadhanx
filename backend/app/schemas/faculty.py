import uuid
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class FacultyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    department: str
    designation: str
    research_areas: list[str] = Field(default_factory=list)
    university_name: str | None = None
    university_state: str | None = None
    university_district: str | None = None
    aishe_code: str | None = None
    supervised_pods_count: int = 0
    approved_reviews_count: int = 0


class FacultyProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    department: str | None = Field(None, min_length=2, max_length=150)
    designation: str | None = Field(None, min_length=2, max_length=100)
    research_areas: list[str] | None = None


class PodItem(BaseModel):
    id: str
    title: str
    team_name: str
    description: str | None = None
    status: str
    problem_id: str
    problem_title: str
    lead_name: str
    lead_email: str | None = None
    university_name: str | None = None
    is_direct_mentor: bool = False
    member_count: int = 1
    updated_at: str


class FacultyDashboardResponse(BaseModel):
    faculty_name: str
    designation: str
    department: str | None = None
    university_name: str | None = None
    research_areas: list[str] = Field(default_factory=list)
    assigned_projects_count: int
    available_pods_count: int
    pending_reviews_count: int
    approved_reviews_count: int
    assigned_projects: list[PodItem]
    available_projects: list[PodItem]
    recent_reviews: list[dict[str, Any]]
