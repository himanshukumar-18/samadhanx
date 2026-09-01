import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    recipient_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    link: str | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
