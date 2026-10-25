import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from pgvector.sqlalchemy import Vector
    VectorType = Vector(384)
except Exception:
    VectorType = JSON

from app.models.base import BaseModel
from app.models.enums import ImpactLevel, ProblemStatus

if TYPE_CHECKING:
    from app.models.problem_ai_analysis import ProblemAIAnalysis
    from app.models.problem_duplicate_link import ProblemDuplicateLink
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

    # Duplicate Problem Detection & Embeddings
    embedding: Mapped[list[float] | None] = mapped_column(VectorType, nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    embedding_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    author: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    comments: Mapped[list["ProblemComment"]] = relationship(
        "ProblemComment", back_populates="problem", cascade="all, delete-orphan"
    )
    endorsements: Mapped[list["ProblemEndorsement"]] = relationship(
        "ProblemEndorsement", back_populates="problem", cascade="all, delete-orphan"
    )
    projects: Mapped[list["SolutionProject"]] = relationship("SolutionProject", back_populates="problem")
    ai_analyses: Mapped[list["ProblemAIAnalysis"]] = relationship(
        "ProblemAIAnalysis",
        back_populates="problem",
        cascade="all, delete-orphan",
        order_by="ProblemAIAnalysis.analysis_version.desc()",
    )
    canonical_problem: Mapped["Problem | None"] = relationship(
        "Problem", remote_side="Problem.id", foreign_keys=[duplicate_of_id], backref="duplicates"
    )
    duplicate_links_as_primary: Mapped[list["ProblemDuplicateLink"]] = relationship(
        "ProblemDuplicateLink",
        foreign_keys="ProblemDuplicateLink.problem_id",
        back_populates="problem",
        cascade="all, delete-orphan",
    )
    duplicate_links_as_candidate: Mapped[list["ProblemDuplicateLink"]] = relationship(
        "ProblemDuplicateLink",
        foreign_keys="ProblemDuplicateLink.candidate_problem_id",
        back_populates="candidate_problem",
        cascade="all, delete-orphan",
    )


    @property
    def latest_ai_analysis(self) -> "ProblemAIAnalysis | None":
        if self.ai_analyses and len(self.ai_analyses) > 0:
            return self.ai_analyses[0]
        return None

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
