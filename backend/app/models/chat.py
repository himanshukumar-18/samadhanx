import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_accepted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id])
