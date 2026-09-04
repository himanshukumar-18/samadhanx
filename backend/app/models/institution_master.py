import re
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Index, String, Text
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
    official_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    short_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    institution_type: Mapped[str] = mapped_column(String(50), default="UNIVERSITY", nullable=False, index=True)
    ownership_type: Mapped[str] = mapped_column(String(50), default="GOVERNMENT", nullable=False)

    aishe_code: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True, index=True)
    ugc_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    verification_status: Mapped[str] = mapped_column(String(30), default="verified", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    source: Mapped[str] = mapped_column(String(50), default="ugc_dataset", nullable=False)
    source_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    university_profiles: Mapped[list["UniversityProfile"]] = relationship("UniversityProfile", back_populates="institution_master")
    students: Mapped[list["StudentProfile"]] = relationship("StudentProfile", back_populates="institution_master")

    __table_args__ = (
        Index("idx_inst_name_state", "normalized_name", "state"),
        Index("idx_inst_type_state", "institution_type", "state"),
    )
