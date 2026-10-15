import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import AIAnalysisStatus, AIModerationRecommendation

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.user import User


class ProblemAIAnalysis(BaseModel):
    __tablename__ = "problem_ai_analyses"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    analysis_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False, index=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    status: Mapped[AIAnalysisStatus] = mapped_column(
        SQLEnum(AIAnalysisStatus, name="ai_analysis_status_enum"),
        default=AIAnalysisStatus.NOT_STARTED,
        nullable=False,
        index=True,
    )

    # Provider & Model Metadata
    provider: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(50), default="v1", nullable=False)
    trigger: Mapped[str | None] = mapped_column(String(50), default="auto_submission", nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Inferred Categorization & Summary
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[list[str] | None] = mapped_column(JSON, default=list)

    # Scores & Signals
    spam_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    spam_reasons: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_flags: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, default=list)

    # Decision Recommendation
    recommendation: Mapped[AIModerationRecommendation | None] = mapped_column(
        SQLEnum(AIModerationRecommendation, name="ai_moderation_recommendation_enum"),
        nullable=True,
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Duplicate / Similarity signal
    duplicate_signal: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)

    # Execution telemetry & Error tracking
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_sanitized_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_usage: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=dict)

    # Traceability
    triggered_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    problem: Mapped["Problem"] = relationship("Problem", back_populates="ai_analyses")
    triggered_by: Mapped["User | None"] = relationship("User", foreign_keys=[triggered_by_id])
