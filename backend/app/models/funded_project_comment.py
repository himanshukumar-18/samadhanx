"""
funded_project_comment.py — Industry funder comments on pods they sponsor.

Access rule: Industry user MUST have an APPROVED IndustrySupport record for the pod.
Personal contact details of students are never stored here.
"""
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class FundedProjectComment(BaseModel):
    __tablename__ = "funded_project_comments"

    pod_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solution_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    industry_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    # company_name stored at write-time so it survives profile changes
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)

    pod: Mapped["SolutionProject"] = relationship("SolutionProject")
    industry_user: Mapped["User"] = relationship("User")

    @property
    def commenter_name(self) -> str | None:
        u = self.__dict__.get("industry_user")
        return u.full_name if u else None
