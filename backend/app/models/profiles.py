import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User

class UniversityProfile(BaseModel):
    __tablename__ = "university_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    university_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    aishe_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    nodal_officer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_email: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="university_profile")
    students: Mapped[list["StudentProfile"]] = relationship("StudentProfile", back_populates="university")
    faculty_members: Mapped[list["FacultyProfile"]] = relationship("FacultyProfile", back_populates="university")

class CitizenProfile(BaseModel):
    __tablename__ = "citizen_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="citizen_profile")

class StudentProfile(BaseModel):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    university_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("university_profiles.id", ondelete="RESTRICT"), nullable=False)
    enrollment_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str] = mapped_column(String(150), nullable=False)
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, default=list)

    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    university: Mapped["UniversityProfile"] = relationship("UniversityProfile", back_populates="students")

class FacultyProfile(BaseModel):
    __tablename__ = "faculty_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    university_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("university_profiles.id", ondelete="RESTRICT"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    research_areas: Mapped[list | None] = mapped_column(JSON, default=list)

    user: Mapped["User"] = relationship("User", back_populates="faculty_profile", foreign_keys=[user_id])
    university: Mapped["UniversityProfile"] = relationship("UniversityProfile", back_populates="faculty_members")

class IndustryProfile(BaseModel):
    __tablename__ = "industry_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cin_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    point_of_contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    focus_sectors: Mapped[list | None] = mapped_column(JSON, default=list)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="industry_profile")
