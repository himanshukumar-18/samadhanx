import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import RequestStatus, SupportType

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class IndustrySupport(BaseModel):
    __tablename__ = "industry_supports"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    industry_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    support_type: Mapped[SupportType] = mapped_column(
        SQLEnum(SupportType, name="support_type_enum"),
        default=SupportType.SPONSORSHIP,
        nullable=False,
        index=True,
    )
    amount_or_terms: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RequestStatus] = mapped_column(
        SQLEnum(RequestStatus, name="industry_support_status_enum"),
        default=RequestStatus.PENDING,
        nullable=False,
        index=True,
    )

    project: Mapped["SolutionProject"] = relationship("SolutionProject", back_populates="supports")
    industry_user: Mapped["User"] = relationship("User")
