from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.profiles import (
        CitizenProfile,
        FacultyProfile,
        IndustryProfile,
        StudentProfile,
        UniversityProfile,
    )
    from app.models.restricted_request import RestrictedAccountRequest

class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole, name="user_role_enum"), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships to profiles
    citizen_profile: Mapped["CitizenProfile"] = relationship("CitizenProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    student_profile: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    faculty_profile: Mapped["FacultyProfile"] = relationship("FacultyProfile", back_populates="user", foreign_keys="FacultyProfile.user_id", uselist=False, cascade="all, delete-orphan")
    industry_profile: Mapped["IndustryProfile"] = relationship("IndustryProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    university_profile: Mapped["UniversityProfile"] = relationship("UniversityProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    restricted_request: Mapped["RestrictedAccountRequest"] = relationship("RestrictedAccountRequest", back_populates="user", foreign_keys="RestrictedAccountRequest.user_id", uselist=False, cascade="all, delete-orphan")
