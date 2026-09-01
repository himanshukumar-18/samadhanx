import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class AccountSettings(BaseModel):
    __tablename__ = "account_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    public_profile: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="account_settings")
