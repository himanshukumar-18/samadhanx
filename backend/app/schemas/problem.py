import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ImpactLevel, ProblemStatus


class ProblemCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    category: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=2, max_length=255)
    district: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    impact_level: ImpactLevel = ImpactLevel.MEDIUM
    media_urls: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ProblemUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=255)
    description: str | None = Field(None, min_length=20)
    category: str | None = None
    location: str | None = None
    district: str | None = None
    state: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    impact_level: ImpactLevel | None = None
    media_urls: list[str] | None = None
    tags: list[str] | None = None


class ProblemModerationUpdate(BaseModel):
    status: ProblemStatus
    is_verified: bool | None = None


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class CommentUpdate(CommentCreate):
    pass


class CommentAuthorResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CommentResponse(BaseModel):
    id: uuid.UUID
    problem_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    author_name: str | None = None
    author_avatar: str | None = None
    author_role: str | None = None
    author: CommentAuthorResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class ProblemAuthorResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: str
    avatar: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProblemResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    category: str
    location: str
    district: str
    state: str
    latitude: float | None = None
    longitude: float | None = None
    status: ProblemStatus
    impact_level: ImpactLevel
    created_by_id: uuid.UUID
    is_verified: bool
    media_urls: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    ai_insight: dict | None = None
    created_at: datetime
    updated_at: datetime

    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    active_teams_count: int = 0
    is_liked: bool = False
    is_saved: bool = False
    author: ProblemAuthorResponse | None = None

    model_config = ConfigDict(from_attributes=True)
