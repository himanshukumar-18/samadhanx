import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------------------
# Public Search & Discovery Schemas
# ---------------------------------------------------------------------------

class InstitutionSearchItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    official_name: str | None = None
    short_name: str | None = None
    institution_type: str = "University"
    ownership_type: str = "Government"
    aishe_code: str | None = None
    ugc_code: str | None = None
    city: str | None = None
    district: str
    state: str
    website: str | None = None
    verification_status: str = "verified"
    is_active: bool = True


class InstitutionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    official_name: str | None = None
    short_name: str | None = None
    institution_type: str
    ownership_type: str
    aishe_code: str | None = None
    ugc_code: str | None = None
    city: str | None = None
    district: str
    state: str
    pincode: str | None = None
    address: str | None = None
    website: str | None = None
    verification_status: str
    source: str
    last_verified_at: datetime | None = None


# ---------------------------------------------------------------------------
# Fallback Verification Request Schemas
# ---------------------------------------------------------------------------

class InstitutionVerificationRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submitted_by_email: EmailStr
    requested_name: str = Field(..., min_length=3, max_length=255)
    institution_type: str = Field(default="College", max_length=50)
    state: str = Field(..., min_length=2, max_length=100)
    district: str = Field(..., min_length=2, max_length=100)
    city: str | None = Field(None, max_length=100)
    official_website: str | None = Field(None, max_length=255)
    aishe_code: str | None = Field(None, max_length=50)
    ugc_code: str | None = Field(None, max_length=50)
    additional_notes: str | None = Field(None, max_length=1000)


class InstitutionVerificationRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submitted_by_email: str
    submitted_by_user_id: uuid.UUID | None = None
    requested_name: str
    institution_type: str
    state: str
    district: str
    city: str | None = None
    official_website: str | None = None
    aishe_code: str | None = None
    ugc_code: str | None = None
    additional_notes: str | None = None
    status: str
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    approved_institution_id: uuid.UUID | None = None
    created_at: datetime


class InstitutionRequestReviewAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rejection_reason: str | None = None
    # Optional override parameters when approving into master
    official_name: str | None = None
    short_name: str | None = None
    institution_type: str | None = None
    ownership_type: str | None = None
    aishe_code: str | None = None
    ugc_code: str | None = None
    official_website: str | None = None


# ---------------------------------------------------------------------------
# Admin Management & Dataset Sync Schemas
# ---------------------------------------------------------------------------

class InstitutionMasterAdminItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    official_name: str | None = None
    short_name: str | None = None
    institution_type: str
    ownership_type: str
    aishe_code: str | None = None
    ugc_code: str | None = None
    district: str
    state: str
    city: str | None = None
    website: str | None = None
    verification_status: str
    status: str
    is_active: bool
    source: str
    last_verified_at: datetime | None = None
    created_at: datetime


class InstitutionSyncRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_name: str
    status: str
    records_processed: int
    records_added: int
    records_updated: int
    records_failed: int
    started_at: datetime
    completed_at: datetime | None = None
    error_summary: str | None = None
