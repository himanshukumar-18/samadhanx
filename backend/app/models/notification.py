import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import NotificationType

if TYPE_CHECKING:
    from app.models.user import User


class Notification(BaseModel):
    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notification_type_enum"),
        default=NotificationType.SYSTEM_ALERT,
        nullable=False,
    )
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    recipient: Mapped["User"] = relationship("User")
