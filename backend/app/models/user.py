from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.account_settings import AccountSettings
    from app.models.profiles import (
        CitizenProfile,
        FacultyProfile,
        IndustryProfile,
        StudentProfile,
        UniversityProfile,
    )
    from app.models.restricted_request import RestrictedAccountRequest
    from app.models.user_profile import UserProfileDetail


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

    account_settings: Mapped["AccountSettings"] = relationship("AccountSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    profile_detail: Mapped["UserProfileDetail"] = relationship("UserProfileDetail", back_populates="user", uselist=False, cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        cp = self.__dict__.get("citizen_profile")
        if cp and getattr(cp, "full_name", None):
            return cp.full_name
        sp = self.__dict__.get("student_profile")
        if sp and getattr(sp, "full_name", None):
            return sp.full_name
        fp = self.__dict__.get("faculty_profile")
        if fp and getattr(fp, "full_name", None):
            return fp.full_name
        up = self.__dict__.get("university_profile")
        if up and getattr(up, "nodal_officer_name", None):
            return up.nodal_officer_name
        ip = self.__dict__.get("industry_profile")
        if ip and getattr(ip, "point_of_contact_name", None):
            return ip.point_of_contact_name
        return self.email

    @property
    def avatar(self) -> str | None:
        pd = self.__dict__.get("profile_detail")
        if pd and getattr(pd, "avatar_url", None):
            return pd.avatar_url
        cp = self.__dict__.get("citizen_profile")
        if cp and getattr(cp, "profile_picture_url", None):
            return cp.profile_picture_url
        sp = self.__dict__.get("student_profile")
        if sp and getattr(sp, "avatar_url", None):
            return sp.avatar_url
        fp = self.__dict__.get("faculty_profile")
        if fp and getattr(fp, "avatar_url", None):
            return fp.avatar_url
        up = self.__dict__.get("university_profile")
        if up and getattr(up, "logo_url", None):
            return up.logo_url
        ip = self.__dict__.get("industry_profile")
        if ip and getattr(ip, "logo_url", None):
            return ip.logo_url
        return None

    @property
    def avatar_url(self) -> str | None:
        return self.avatar

