import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class CitizenProfileStats(BaseModel):
    problems_submitted: int = 0
    problems_approved: int = 0
    problems_pending: int = 0
    problems_rejected: int = 0
    problems_solved: int = 0


class CitizenProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    headline: str | None = Field(None, max_length=120)
    bio: str | None = Field(None, max_length=500)
    website_url: HttpUrl | None = None
    github_url: HttpUrl | None = None
    linkedin_url: HttpUrl | None = None
    avatar_url: str | None = None
    profile_picture_url: str | None = None

    @field_validator("github_url", mode="before")
    @classmethod
    def validate_github(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str) and v.strip():
            url_str = v.strip()
            if not (url_str.startswith("http://") or url_str.startswith("https://")):
                raise ValueError("URL must start with http:// or https://")
            if "github.com" not in url_str:
                raise ValueError("GitHub URL must contain github.com")
        return v

    @field_validator("linkedin_url", mode="before")
    @classmethod
    def validate_linkedin(cls, v: Any) -> Any:
        if v is not None and isinstance(v, str) and v.strip():
            url_str = v.strip()
            if not (url_str.startswith("http://") or url_str.startswith("https://")):
                raise ValueError("URL must start with http:// or https://")
            if "linkedin.com" not in url_str:
                raise ValueError("LinkedIn URL must contain linkedin.com")
        return v


class CitizenProfileRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    role: str = "citizen"
    headline: str | None = None
    bio: str | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    profile_picture_url: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    stats: CitizenProfileStats = Field(default_factory=CitizenProfileStats)

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
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
