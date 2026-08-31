import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import OrgType, RequestStatus


class RequestReviewAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rejection_reason: str | None = None

class RestrictedRequestResponse(BaseModel):
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
    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    action: str
    target_type: str
    target_id: str | None = None
    metadata_json: dict | None = None
    ip_address: str | None = None
    created_at: datetime
