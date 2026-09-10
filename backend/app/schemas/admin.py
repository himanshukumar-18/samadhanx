import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrgType, RequestStatus


class RequestReviewAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rejection_reason: str | None = None

class RestrictedRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    org_type: OrgType
    org_name: str
    registration_identifier: str | None = None
    nodal_officer_name: str
    official_email: str
    status: RequestStatus
    rejection_reason: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    action: str
    target_type: str
    target_id: str | None = None
    metadata_json: dict | None = None
    ip_address: str | None = None
    created_at: datetime

class AdminSummaryCountsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    pending_partner_requests: int = 0
    pending_institution_verifications: int = 0
    pending_problem_moderations: int = 0
    total_verified_institutions: int = 0
    total_users: int = 0
    total_problems: int = 0

class UserRoleBreakdown(BaseModel):
    citizens: int = 0
    students: int = 0
    faculty: int = 0
    universities: int = 0
    industry: int = 0
    admins: int = 0

class ProblemStatusBreakdown(BaseModel):
    submitted: int = 0
    under_review: int = 0
    verified: int = 0
    in_progress: int = 0
    solution_submitted: int = 0
    pilot: int = 0
    solved: int = 0
    rejected: int = 0

class ProjectStatusBreakdown(BaseModel):
    planning: int = 0
    in_progress: int = 0
    prototype: int = 0
    review: int = 0
    pilot: int = 0
    completed: int = 0
    rejected: int = 0

class CategoryCountItem(BaseModel):
    category: str
    count: int

class AdminAnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_users: int = 0
    active_users: int = 0
    verified_users: int = 0
    user_roles: UserRoleBreakdown = Field(default_factory=UserRoleBreakdown)
    total_problems: int = 0
    verified_problems: int = 0
    solved_problems: int = 0
    problem_statuses: ProblemStatusBreakdown = Field(default_factory=ProblemStatusBreakdown)
    categories_breakdown: list[CategoryCountItem] = Field(default_factory=list)
    total_projects: int = 0
    completed_projects: int = 0
    project_statuses: ProjectStatusBreakdown = Field(default_factory=ProjectStatusBreakdown)
    total_institutions: int = 0
    verified_institutions: int = 0
    pending_institution_requests: int = 0
    generated_at: datetime


