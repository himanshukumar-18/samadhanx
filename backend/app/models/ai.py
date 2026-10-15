import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AIDecisionLog(BaseModel):
    """Privacy-safe operational record for an AI suggestion."""

    __tablename__ = "ai_decision_logs"

    feature: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    input_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    output_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AIFeedback(BaseModel):
    __tablename__ = "ai_feedback"

    feature: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating: Mapped[str] = mapped_column(String(4), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(300), nullable=True)
