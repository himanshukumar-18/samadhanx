import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class ImpactReport(BaseModel):
    """
    One-to-one with a SolutionProject that has reached `completed` status.
    Submitted by the pod lead, optionally verified by Faculty/Admin.
    Visible to Citizen (via problem), Faculty, Admin, Industry.
    """

    __tablename__ = "impact_reports"

    pod_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solution_projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    beneficiaries_reached: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome_description: Mapped[str] = mapped_column(Text, nullable=False)
    proof_image_urls: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list
    )

    # Optional verification by Faculty or Admin
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    pod: Mapped["SolutionProject"] = relationship(
        "SolutionProject", back_populates="impact_report"
    )
    submitter: Mapped["User"] = relationship("User", foreign_keys=[submitted_by])
    verifier: Mapped["User | None"] = relationship("User", foreign_keys=[verified_by])

    @property
    def submitter_name(self) -> str | None:
        u = self.__dict__.get("submitter")
        return u.full_name if u else None

    @property
    def verifier_name(self) -> str | None:
        u = self.__dict__.get("verifier")
        return u.full_name if u else None
