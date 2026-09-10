import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RequestStatus, SupportType


class IndustrySupportCreate(BaseModel):
    project_id: uuid.UUID
    company_name: str = Field(..., min_length=2, max_length=255)
    support_type: SupportType = SupportType.SPONSORSHIP
    amount_or_terms: str = Field(..., min_length=5, max_length=3000)


class IndustrySupportUpdateStatus(BaseModel):
    status: RequestStatus


class IndustrySupportResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    industry_user_id: uuid.UUID
    company_name: str
    support_type: SupportType
    amount_or_terms: str
    status: RequestStatus
    created_at: datetime
    project_title: str | None = None
    problem_title: str | None = None
    university_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectSeekingSupportResponse(BaseModel):
    id: uuid.UUID
    title: str
    team_name: str
    description: str
    problem_title: str | None = None
    university_name: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IndustryPartnershipsOverviewResponse(BaseModel):
    partnerships: list[IndustrySupportResponse]
    available_projects: list[ProjectSeekingSupportResponse]
    total_partnerships_count: int
    active_grants_count: int
    pending_reviews_count: int
    user_role: str
    company_name: str | None = None
