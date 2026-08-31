from enum import StrEnum


class UserRole(StrEnum):
    CITIZEN = "citizen"
    STUDENT = "student"
    FACULTY = "faculty"
    INDUSTRY = "industry"
    ADMIN = "admin"
    UNIVERSITY = "university"

class RequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class OrgType(StrEnum):
    UNIVERSITY = "university"
    INDUSTRY = "industry"

class OTPPurpose(StrEnum):
    REGISTRATION = "registration"
    PASSWORD_RESET = "password_reset"
