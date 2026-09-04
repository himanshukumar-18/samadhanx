import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Public profile schemas (read-only, privacy-enforced, no private data)
# ---------------------------------------------------------------------------


class PublicActivityStats(BaseModel):
    """
    Activity counts safe for public visibility.
    Pending/rejected intentionally omitted — not meaningful externally.
    """
    submitted: int = 0
    approved: int = 0
    solved: int = 0


class PublicUserProfileResponse(BaseModel):
    """
    Privacy-clean public profile response — safe to return to any authenticated user.

    NEVER contains:
      - email / phone / date_of_birth / full_address / pincode
      - password / OTP / access_token / refresh_token
      - admin_notes / moderation_data / audit_log entries
      - Cloudinary API keys or upload credentials
      - Internal IDs beyond the public user UUID

    account_available=False means the profile cannot be shown (suspended/deactivated).
    When False the caller should display a generic "unavailable" message.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    profile_picture_url: str | None = None
    role: str
    bio: str | None = None

    # General public location — never pincode or full_address
    state: str | None = None
    district: str | None = None
    city: str | None = None

    member_since: str          # human-readable e.g. "September 2026"
    preferred_language: str | None = None
    interests: list[str] = Field(default_factory=list)

    is_active: bool = True
    account_available: bool = True   # False = suspended/deactivated

    activity: PublicActivityStats = Field(default_factory=PublicActivityStats)


# ---------------------------------------------------------------------------
# Citizen-specific schemas
# ---------------------------------------------------------------------------

ALLOWED_INTERESTS = [
    "Water & Sanitation",
    "Roads & Transport",
    "Education",
    "Healthcare",
    "Agriculture",
    "Environment",
    "Electricity",
    "Public Safety",
    "Waste Management",
    "Digital Services",
    "Housing",
    "Employment",
    "Women & Child Welfare",
    "Senior Citizens",
    "Other",
]

ALLOWED_GENDERS = {"male", "female", "other", "prefer_not_to_say"}
ALLOWED_LANGUAGES = {"en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa"}


class CitizenActivityStats(BaseModel):
    """Real activity counts aggregated from the problems table — never manually editable."""
    submitted: int = 0
    approved: int = 0
    pending: int = 0
    rejected: int = 0
    solved: int = 0


class CitizenProfileUpdate(BaseModel):
    """
    Explicitly whitelisted fields a citizen may edit.
    extra='forbid' blocks mass-assignment of any unlisted field (role, email, status, etc.).
    """
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(None, min_length=2, max_length=100)
    phone_number: str | None = Field(None, max_length=20)
    date_of_birth: date | None = None
    gender: str | None = None
    state: str | None = Field(None, max_length=100)
    district: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    pincode: str | None = Field(None, pattern=r"^\d{6}$")
    full_address: str | None = Field(None, max_length=500)
    bio: str | None = Field(None, max_length=500)
    preferred_language: str | None = None
    interests: list[str] | None = None
    profile_picture_url: str | None = None  # set only by avatar upload endpoint

    @field_validator("full_name", mode="before")
    @classmethod
    def sanitize_full_name(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str):
            import re
            # Strip HTML tags
            v = re.sub(r"<[^>]*>", "", v).strip()
            if len(v) < 2:
                raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def validate_dob(cls, v: Any) -> Any:
        if v is not None:
            from datetime import date as dt
            if isinstance(v, str):
                from datetime import datetime
                v = datetime.strptime(v, "%Y-%m-%d").date()
            if isinstance(v, dt) and v >= dt.today():
                raise ValueError("Date of birth must be in the past.")
        return v

    @field_validator("gender", mode="before")
    @classmethod
    def validate_gender(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str):
            if v.lower() not in ALLOWED_GENDERS:
                raise ValueError(f"Gender must be one of: {', '.join(sorted(ALLOWED_GENDERS))}")
            return v.lower()
        return v

    @field_validator("preferred_language", mode="before")
    @classmethod
    def validate_language(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str):
            if v.lower() not in ALLOWED_LANGUAGES:
                raise ValueError(f"Language code must be one of: {', '.join(sorted(ALLOWED_LANGUAGES))}")
            return v.lower()
        return v

    @field_validator("interests", mode="before")
    @classmethod
    def validate_interests(cls, v: Any) -> Any:
        if v is not None:
            if not isinstance(v, list):
                raise ValueError("Interests must be a list.")
            if len(v) > 10:
                raise ValueError("You may select up to 10 areas of interest.")
            invalid = [i for i in v if i not in ALLOWED_INTERESTS]
            if invalid:
                raise ValueError(f"Invalid interest(s): {', '.join(invalid)}")
        return v

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str):
            import re
            # Strip spaces/dashes for normalization, then validate
            cleaned = re.sub(r"[\s\-\(\)]", "", v.strip())
            if cleaned and not re.match(r"^\+?[\d]{7,15}$", cleaned):
                raise ValueError("Invalid phone number format.")
        return v


class CitizenProfileResponse(BaseModel):
    """
    Clean civic identity profile response for citizens.
    Never exposes: password, tokens, OTP, Cloudinary secrets,
    social/developer fields (GitHub/LinkedIn/Website/Headline),
    or the private full_address.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    email_verified: bool
    phone_number: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    profile_picture_url: str | None = None

    # Location (district & state always available; city/pincode may be None for existing users)
    state: str | None = None
    district: str | None = None
    city: str | None = None
    pincode: str | None = None
    # full_address intentionally omitted — never publicly exposed

    bio: str | None = None
    preferred_language: str | None = None
    interests: list[str] = Field(default_factory=list)

    # Account info — all server-controlled, read-only
    role: str = "citizen"
    member_since: str  # human-readable, e.g. "September 2026"
    account_status: str  # "active" | "suspended" | "deactivated"

    # Real activity counts from DB aggregation
    activity: CitizenActivityStats = Field(default_factory=CitizenActivityStats)

    created_at: datetime


# ---------------------------------------------------------------------------
# Legacy / shared schemas (used by Student, Faculty, Industry, University)
# Keep these unchanged — other roles depend on them.
# ---------------------------------------------------------------------------

class CitizenProfileStats(BaseModel):
    """Legacy name kept for backward-compat with existing non-citizen profile usage."""
    problems_submitted: int = 0
    problems_approved: int = 0
    problems_pending: int = 0
    problems_rejected: int = 0
    problems_solved: int = 0


class UserProfileUpdate(BaseModel):
    """Used by non-citizen roles (Student, Faculty, Industry, University, Admin)."""
    headline: str | None = Field(None, max_length=120)
    bio: str | None = Field(None, max_length=500)
    avatar_url: str | None = None
    cover_url: str | None = None
    website: str | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    skills: list[str] | None = None
    experience: list[dict] | None = None
    education: list[dict] | None = None


class UserProfileDetailResponse(BaseModel):
    """Shared profile response for non-citizen roles."""
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    organization_name: str | None = None
    bio: str | None = None
    headline: str | None = None
    avatar_url: str | None = None
    profile_picture_url: str | None = None
    cover_url: str | None = None
    website: str | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list)
    education: list[dict] = Field(default_factory=list)
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_verified: bool = True
    created_at: datetime
    stats: CitizenProfileStats | None = None

    model_config = ConfigDict(from_attributes=True)
