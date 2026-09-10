import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.profiles import UniversityProfile
    from app.models.project import SolutionProject
    from app.models.user import User


class PatentIP(BaseModel):
    __tablename__ = "patents_ip"

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    university_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("university_profiles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    inventor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    application_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    filing_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PROVISIONAL_FILED", nullable=False, index=True)
    patent_office: Mapped[str] = mapped_column(String(100), default="Indian Patent Office (IPO)", nullable=False)
    abstract: Mapped[str] = mapped_column(Text, nullable=False)
    field_of_invention: Mapped[str] = mapped_column(String(100), default="CleanTech", nullable=False, index=True)
    commercial_readiness: Mapped[str] = mapped_column(String(50), default="TRL-4 (Lab Validation)", nullable=False)
    grant_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    grant_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    project: Mapped["SolutionProject | None"] = relationship("SolutionProject")
    university: Mapped["UniversityProfile | None"] = relationship("UniversityProfile")
    inventor: Mapped["User"] = relationship("User")

    @property
    def project_title(self) -> str | None:
        proj = self.__dict__.get("project")
        return proj.title if proj else None

    @property
    def university_name(self) -> str | None:
        univ = self.__dict__.get("university")
        return univ.university_name if univ else None

    @property
    def inventor_name(self) -> str | None:
        inv = self.__dict__.get("inventor")
        return inv.full_name if inv else None
