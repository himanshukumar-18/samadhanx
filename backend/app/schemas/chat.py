import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    recipient_id: uuid.UUID | None = None
    recipient_email: str | None = None
    content: str = Field(..., min_length=1, max_length=5000)
    media_url: str | None = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    media_url: str | None = None
    is_accepted: bool
    is_read: bool
    created_at: datetime

    sender_name: str | None = None
    recipient_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
