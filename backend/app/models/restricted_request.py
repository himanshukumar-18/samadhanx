import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import OrgType, RequestStatus

if TYPE_CHECKING:
    from app.models.user import User

class RestrictedAccountRequest(BaseModel):
    __tablename__ = "restricted_account_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    org_type: Mapped[OrgType] = mapped_column(SQLEnum(OrgType, name="org_type_enum"), nullable=False)
    org_name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nodal_officer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[RequestStatus] = mapped_column(SQLEnum(RequestStatus, name="request_status_enum"), default=RequestStatus.PENDING, nullable=False, index=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="restricted_request", foreign_keys=[user_id])
    reviewer: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by])
