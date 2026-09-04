import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.institution_master import InstitutionMaster
    from app.models.user import User


class UniversityProfile(BaseModel):
    __tablename__ = "university_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    institution_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("institution_masters.id", ondelete="SET NULL"), nullable=True)
    university_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    aishe_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    nodal_officer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_email: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="university_profile")
    institution_master: Mapped["InstitutionMaster | None"] = relationship("InstitutionMaster", back_populates="university_profiles")
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

    # New civic profile fields
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    full_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    interests: Mapped[list | None] = mapped_column(JSON, default=list)

    # Legacy social fields — kept in DB, not used for citizen API (kept nullable, never exposed)
    headline: Mapped[str | None] = mapped_column(String(120), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_picture_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="citizen_profile")


class StudentProfile(BaseModel):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    university_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("university_profiles.id", ondelete="RESTRICT"), nullable=True)
    institution_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("institution_masters.id", ondelete="RESTRICT"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    enrollment_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str] = mapped_column(String(150), nullable=False)
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, default=list)

    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    university: Mapped["UniversityProfile"] = relationship("UniversityProfile", back_populates="students")
    institution_master: Mapped["InstitutionMaster | None"] = relationship("InstitutionMaster", back_populates="students")


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
    registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry_type: Mapped[str] = mapped_column(String(100), nullable=False)
    point_of_contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_email: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="industry_profile")
