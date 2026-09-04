import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProjectStatus


class ProjectPickCreate(BaseModel):
    problem_id: uuid.UUID
    team_name: str = Field(..., min_length=3, max_length=255)
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=15)
    repository_url: str | None = None
    faculty_mentor_id: uuid.UUID | None = None


class ProjectUpdateCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    content: str = Field(..., min_length=10)
    prototype_url: str | None = None
    media_urls: list[str] = Field(default_factory=list)


class ProjectMemberAdd(BaseModel):
    user_id: uuid.UUID
    role_in_team: str = Field("Member", max_length=100)


class ProjectMemberResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role_in_team: str
    created_at: datetime
    member_name: str | None = None
    email: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectUpdateResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None = None
    title: str
    content: str
    prototype_url: str | None = None
    media_urls: list[str] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    problem_title: str | None = None
    problem_category: str | None = None
    team_name: str
    title: str
    description: str
    repository_url: str | None = None
    status: ProjectStatus
    lead_student_id: uuid.UUID
    lead_student_name: str | None = None
    faculty_mentor_id: uuid.UUID | None = None
    university_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    members: list[ProjectMemberResponse] = Field(default_factory=list)
    updates: list[ProjectUpdateResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
