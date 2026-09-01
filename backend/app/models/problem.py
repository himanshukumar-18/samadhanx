import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ImpactLevel, ProblemStatus

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class Problem(BaseModel):
    __tablename__ = "problems"

    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    district: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    state: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[ProblemStatus] = mapped_column(
        SQLEnum(ProblemStatus, name="problem_status_enum"),
        default=ProblemStatus.SUBMITTED,
        nullable=False,
        index=True,
    )
    impact_level: Mapped[ImpactLevel] = mapped_column(
        SQLEnum(ImpactLevel, name="impact_level_enum"),
        default=ImpactLevel.MEDIUM,
        nullable=False,
        index=True,
    )

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    media_urls: Mapped[list | None] = mapped_column(JSON, default=list)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    ai_insight: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # Relationships
    author: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    comments: Mapped[list["ProblemComment"]] = relationship(
        "ProblemComment", back_populates="problem", cascade="all, delete-orphan"
    )
    endorsements: Mapped[list["ProblemEndorsement"]] = relationship(
        "ProblemEndorsement", back_populates="problem", cascade="all, delete-orphan"
    )
    projects: Mapped[list["SolutionProject"]] = relationship("SolutionProject", back_populates="problem")

    @property
    def likes_count(self) -> int:
        return len(self.endorsements or [])

    @property
    def comments_count(self) -> int:
        return len(self.comments or [])

    @property
    def active_teams_count(self) -> int:
        return len(self.projects or [])


class ProblemComment(BaseModel):
    __tablename__ = "problem_comments"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    problem: Mapped["Problem"] = relationship("Problem", back_populates="comments")
    author: Mapped["User"] = relationship("User")


class ProblemEndorsement(BaseModel):
    __tablename__ = "problem_endorsements"
    __table_args__ = (UniqueConstraint("problem_id", "user_id", name="uq_problem_user_endorsement"),)

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    problem: Mapped["Problem"] = relationship("Problem", back_populates="endorsements")
    user: Mapped["User"] = relationship("User")
