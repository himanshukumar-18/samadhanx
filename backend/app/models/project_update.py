import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import SolutionProject
    from app.models.user import User


class ProjectUpdate(BaseModel):
    __tablename__ = "project_updates"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    prototype_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    media_urls: Mapped[list | None] = mapped_column(JSON, default=list)

    project: Mapped["SolutionProject"] = relationship("SolutionProject", back_populates="updates")
    author: Mapped["User"] = relationship("User")
