import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    role: UserRole
    is_verified: bool
    is_active: bool
    is_approved: bool


class CitizenRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone_number: str | None = None
    location: str = Field(..., min_length=2, max_length=255)
    district: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)


class StudentRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=255)
    university_id: uuid.UUID | None = None
    institution_id: uuid.UUID | None = None
    pending_institution_request_id: uuid.UUID | None = None
    enrollment_number: str | None = None
    department: str = Field(..., min_length=2, max_length=150)
    graduation_year: int | None = None
    skills: list[str] | None = Field(default_factory=list)


from datetime import datetime

class UniversityRequestRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., min_length=8)
    university_name: str = Field(..., min_length=3, max_length=255)
    institution_id: uuid.UUID | None = None
    aishe_code: str | None = None
    state: str = Field(..., min_length=2, max_length=100)
    district: str = Field(..., min_length=2, max_length=100)
    nodal_officer_name: str = Field(..., min_length=2, max_length=255)
    official_email: EmailStr
    website: str | None = None


class IndustryRequestRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., min_length=8)
    company_name: str = Field(..., min_length=2, max_length=255)
    cin_number: str | None = None
    website: str | None = None
    point_of_contact_name: str = Field(..., min_length=2, max_length=255)
    designation: str = Field(..., min_length=2, max_length=100)
    focus_sectors: list[str] | None = Field(default_factory=list)


class FacultyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=255)
    department: str = Field(..., min_length=2, max_length=150)
    designation: str = Field(..., min_length=2, max_length=100)
    research_areas: list[str] | None = Field(default_factory=list)


class FacultyInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    department: str = Field(..., min_length=2, max_length=150)
    designation: str = Field(..., min_length=2, max_length=100)
    research_areas: list[str] | None = Field(default_factory=list)


class FacultyInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str
    department: str
    designation: str
    research_areas: list[str] | None = Field(default_factory=list)
    status: str
    expires_at: datetime
    created_at: datetime
    accepted_at: datetime | None = None


class PublicInvitationInfo(BaseModel):
    university_name: str
    email: str
    full_name: str
    department: str
    designation: str
    expires_at: datetime
    is_valid: bool = True


class AcceptInvitationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(..., min_length=8)
    full_name: str | None = None
    department: str | None = None
    designation: str | None = None
    research_areas: list[str] | None = None


class FacultyMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    department: str
    designation: str
    research_areas: list[str] | None = Field(default_factory=list)
    is_active: bool
    created_at: datetime


class UniversityListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    university_name: str
    state: str
    district: str
