import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ShareCreate(BaseModel):
    platform: str = Field("link", max_length=50)


class ReportCreate(BaseModel):
    reason: str = Field(..., min_length=2, max_length=100)
    details: str | None = Field(None, max_length=1000)


class UserFollowResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None = None
    role: str
    avatar_url: str | None = None
    followed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConnectionStatsResponse(BaseModel):
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_followed_by: bool = False
