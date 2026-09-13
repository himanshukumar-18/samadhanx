import uuid
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    headline: str | None = None
    bio: str | None = None
    department: str
    graduation_year: int | None = None
    enrollment_number: str | None = None
    university_name: str | None = None
    university_state: str | None = None
    university_district: str | None = None
    aishe_code: str | None = None
    skills: list[str] = Field(default_factory=list)
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    avatar_url: str | None = None
    active_pods_count: int = 0
    in_review_pods_count: int = 0
    completed_pods_count: int = 0
    total_pods_count: int = 0
    created_at: str | None = None


class StudentProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    headline: str | None = Field(None, max_length=150)
    bio: str | None = Field(None, max_length=1000)
    department: str | None = Field(None, min_length=2, max_length=150)
    graduation_year: int | None = Field(None, ge=1990, le=2040)
    enrollment_number: str | None = Field(None, max_length=100)
    skills: list[str] | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None

    @field_validator("github_url", "linkedin_url", "portfolio_url", mode="before")
    @classmethod
    def validate_url(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                return None
            if not (v_clean.startswith("http://") or v_clean.startswith("https://")):
                return f"https://{v_clean}"
            return v_clean
        return v


# ---------------------------------------------------------------------------
# Impact Report schemas
# ---------------------------------------------------------------------------

class ImpactReportCreate(BaseModel):
    """Submitted by the pod lead when a pod reaches 'completed' status."""

    model_config = ConfigDict(extra="forbid")

    beneficiaries_reached: int | None = Field(None, ge=0, le=10_000_000, description="Estimated number of people impacted")
    outcome_description: str = Field(..., min_length=20, max_length=2000, description="What was achieved and how")
    proof_image_urls: list[str] | None = Field(None, max_length=5, description="Cloudinary URLs, max 5")


class ImpactReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pod_id: uuid.UUID
    submitted_by: uuid.UUID
    submitter_name: str | None = None
    beneficiaries_reached: int | None = None
    outcome_description: str
    proof_image_urls: list[str] = Field(default_factory=list)
    is_verified: bool = False
    verified_by: uuid.UUID | None = None
    verifier_name: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
