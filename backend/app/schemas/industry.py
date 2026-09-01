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

    model_config = ConfigDict(from_attributes=True)
