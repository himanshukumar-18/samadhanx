import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserProfileUpdate(BaseModel):
    bio: str | None = Field(None, max_length=1000)
    headline: str | None = Field(None, max_length=255)
    avatar_url: str | None = None
    cover_url: str | None = None
    website: str | None = None
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
    cover_url: str | None = None
    website: str | None = None
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

    model_config = ConfigDict(from_attributes=True)
