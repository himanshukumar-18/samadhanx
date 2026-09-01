import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ReviewDecision

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class ProjectReview(BaseModel):
    __tablename__ = "project_reviews"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[ReviewDecision] = mapped_column(
        SQLEnum(ReviewDecision, name="review_decision_enum"),
        default=ReviewDecision.PENDING,
        nullable=False,
        index=True,
    )
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False)

    project: Mapped["SolutionProject"] = relationship("SolutionProject", back_populates="reviews")
    reviewer: Mapped["User"] = relationship("User")
