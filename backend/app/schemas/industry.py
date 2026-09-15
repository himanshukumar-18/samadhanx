import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RequestStatus, SupportType


# ---------------------------------------------------------------------------
# Legacy / Existing Schemas (kept for backward compat with partnerships page)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Phase E: Vetted Projects (faculty-approved only)
# ---------------------------------------------------------------------------

class VettedProjectListItem(BaseModel):
    id: uuid.UUID
    title: str
    team_name: str
    description: str
    status: str
    problem_title: str | None = None
    problem_category: str | None = None
    problem_state: str | None = None
    problem_district: str | None = None
    university_name: str | None = None
    member_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FacultyReviewSummary(BaseModel):
    id: uuid.UUID
    decision: str
    feedback: str | None = None
    reviewer_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PodUpdateSummary(BaseModel):
    id: uuid.UUID
    content: str
    milestone: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VettedProjectDetail(BaseModel):
    id: uuid.UUID
    title: str
    team_name: str
    description: str
    status: str
    repository_url: str | None = None
    problem_title: str | None = None
    problem_category: str | None = None
    problem_state: str | None = None
    problem_district: str | None = None
    problem_impact_level: str | None = None
    university_name: str | None = None
    member_count: int = 0
    progress: int = 0
    # Faculty reviews (visible to Industry as quality signal)
    latest_faculty_review: FacultyReviewSummary | None = None
    # Latest milestone updates (visible to funders)
    recent_updates: list[PodUpdateSummary] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Phase E: Funding Offers (Industry → Student Pod)
# ---------------------------------------------------------------------------

class FundingOfferCreate(BaseModel):
    """Industry user creates a funding offer for a faculty-approved pod."""
    model_config = ConfigDict(extra="forbid")

    pod_id: uuid.UUID
    support_type: SupportType = SupportType.SPONSORSHIP
    amount_or_terms: str = Field(..., min_length=10, max_length=2000, description="Describe the support you are offering.")
    message: str = Field("", max_length=1000, description="Optional cover message to the pod team.")


class FundingOfferResponse(BaseModel):
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


# ---------------------------------------------------------------------------
# Phase E: Industry Dashboard Stats
# ---------------------------------------------------------------------------

class IndustryDashboardStats(BaseModel):
    company_name: str | None = None
    contact_person: str | None = None
    designation: str | None = None
    is_approved: bool = False
    total_offers: int = 0
    pending_offers: int = 0
    accepted_offers: int = 0
    withdrawn_offers: int = 0
    funded_pods_count: int = 0
    vetted_pods_available: int = 0


# ---------------------------------------------------------------------------
# Phase E: Funded Project Comments
# ---------------------------------------------------------------------------

class FundedProjectCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: str = Field(..., min_length=5, max_length=500)


class FundedProjectCommentResponse(BaseModel):
    id: uuid.UUID
    pod_id: uuid.UUID
    industry_user_id: uuid.UUID
    comment: str
    company_name: str
    commenter_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
