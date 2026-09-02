import re
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.profiles import StudentProfile, UniversityProfile


def normalize_institution_name(name: str) -> str:
    """Normalize institution name by stripping whitespace, converting to lowercase,

    removing common prefixes/suffixes, and removing extra punctuation.
    """
    if not name:
        return ""
    text = name.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class InstitutionMaster(BaseModel):
    __tablename__ = "institution_masters"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    aishe_code: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="ugc_dataset", nullable=False)
    verification_status: Mapped[str] = mapped_column(String(30), default="verified", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    university_profiles: Mapped[list["UniversityProfile"]] = relationship("UniversityProfile", back_populates="institution_master")
    students: Mapped[list["StudentProfile"]] = relationship("StudentProfile", back_populates="institution_master")

    __table_args__ = (
        Index("idx_inst_name_state", "normalized_name", "state"),
    )
