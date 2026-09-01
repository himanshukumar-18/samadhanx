import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.user import User


class UserFollow(BaseModel):
    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_follower_following"),)

    follower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    following_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    follower: Mapped["User"] = relationship("User", foreign_keys=[follower_id])
    following: Mapped["User"] = relationship("User", foreign_keys=[following_id])


class ProblemShare(BaseModel):
    __tablename__ = "problem_shares"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(50), default="link", nullable=False)

    problem: Mapped["Problem"] = relationship("Problem")
    user: Mapped["User"] = relationship("User")


class ProblemSave(BaseModel):
    __tablename__ = "problem_saves"
    __table_args__ = (UniqueConstraint("problem_id", "user_id", name="uq_problem_user_save"),)

    problem_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    problem: Mapped["Problem"] = relationship("Problem")
    user: Mapped["User"] = relationship("User")


class ProblemReport(BaseModel):
    __tablename__ = "problem_reports"
    __table_args__ = (UniqueConstraint("problem_id", "reporter_id", name="uq_problem_reporter"),)

    problem_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    problem: Mapped["Problem"] = relationship("Problem")
    reporter: Mapped["User"] = relationship("User")
