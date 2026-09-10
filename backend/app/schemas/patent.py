import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PatentCreate(BaseModel):
    project_id: uuid.UUID | None = None
    title: str = Field(..., min_length=5, max_length=255)
    application_number: str = Field(..., min_length=3, max_length=100)
    filing_date: date
    status: str = "PROVISIONAL_FILED"
    patent_office: str = "Indian Patent Office (IPO)"
    abstract: str = Field(..., min_length=10)
    field_of_invention: str = "CleanTech"
    commercial_readiness: str = "TRL-4 (Lab Validation)"


class PatentUpdateStatus(BaseModel):
    status: str
    grant_number: str | None = None
    grant_date: date | None = None


class PatentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None = None
    university_id: uuid.UUID | None = None
    inventor_id: uuid.UUID
    title: str
    application_number: str
    filing_date: date
    status: str
    patent_office: str
    abstract: str
    field_of_invention: str
    commercial_readiness: str
    grant_number: str | None = None
    grant_date: date | None = None
    project_title: str | None = None
    university_name: str | None = None
    inventor_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EligibleProjectResponse(BaseModel):
    id: uuid.UUID
    title: str
    team_name: str
    description: str
    status: str
    university_name: str | None = None
    problem_title: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatentsOverviewResponse(BaseModel):
    patents: list[PatentResponse]
    eligible_projects: list[EligibleProjectResponse]
    total_patents_count: int
    granted_patents_count: int
    provisional_filed_count: int
    under_examination_count: int
    commercial_ready_count: int
    user_role: str
    university_name: str | None = None
