import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import DuplicateLinkStatus, DuplicateVerdict

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.user import User


class ProblemDuplicateLink(BaseModel):
    __tablename__ = "problem_duplicate_links"
    __table_args__ = (
        UniqueConstraint("problem_id", "candidate_problem_id", name="uq_problem_duplicate_link_pair"),
        CheckConstraint("problem_id != candidate_problem_id", name="chk_not_self_duplicate"),
    )

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )

    similarity: Mapped[float] = mapped_column(Float, nullable=False)
    verdict: Mapped[DuplicateVerdict] = mapped_column(
        SQLEnum(
            DuplicateVerdict,
            name="duplicate_verdict_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        default=DuplicateVerdict.POSSIBLE_DUPLICATE,
        nullable=False,
        index=True,
    )
    llm_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    llm_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[DuplicateLinkStatus] = mapped_column(
        SQLEnum(
            DuplicateLinkStatus,
            name="duplicate_link_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        default=DuplicateLinkStatus.PENDING,
        nullable=False,
        index=True,
    )

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    problem: Mapped["Problem"] = relationship(
        "Problem", foreign_keys=[problem_id], back_populates="duplicate_links_as_primary"
    )
    candidate_problem: Mapped["Problem"] = relationship(
        "Problem", foreign_keys=[candidate_problem_id], back_populates="duplicate_links_as_candidate"
    )
    reviewed_by: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by_id])

