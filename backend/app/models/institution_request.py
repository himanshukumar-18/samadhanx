import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.institution_master import InstitutionMaster
    from app.models.user import User


class InstitutionVerificationRequest(BaseModel):
    """
    Request submitted when a student's institution is not found in the verified master.
    Allows admins to review, verify, and automatically ingest into the master.
    """
    __tablename__ = "institution_verification_requests"

    submitted_by_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    submitted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    requested_name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_type: Mapped[str] = mapped_column(String(50), default="College", nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    official_website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aishe_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ugc_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institution_masters.id", ondelete="SET NULL"), nullable=True
    )

    submitted_by_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[submitted_by_user_id]
    )
    reviewer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewed_by]
    )
    approved_institution: Mapped["InstitutionMaster | None"] = relationship(
        "InstitutionMaster", foreign_keys=[approved_institution_id]
    )
