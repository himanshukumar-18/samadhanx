import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AIAssistantSession(BaseModel):
    __tablename__ = "ai_assistant_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    turn_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    messages: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    draft: Mapped[dict | None] = mapped_column(JSON, nullable=True)
