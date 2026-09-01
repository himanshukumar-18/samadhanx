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

class ProblemStatus(StrEnum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    SOLUTION_SUBMITTED = "solution_submitted"
    PILOT = "pilot"
    SOLVED = "solved"

class ImpactLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ProjectStatus(StrEnum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    PROTOTYPE = "prototype"
    REVIEW = "review"
    PILOT = "pilot"
    COMPLETED = "completed"
    REJECTED = "rejected"

class ReviewDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"

class SupportType(StrEnum):
    SPONSORSHIP = "sponsorship"
    MENTORSHIP = "mentorship"
    PILOT_PARTNER = "pilot_partner"
    BOUNTY = "bounty"

class NotificationType(StrEnum):
    PROBLEM_UPDATED = "problem_updated"
    PROJECT_ASSIGNED = "project_assigned"
    REVIEW_FEEDBACK = "review_feedback"
    INDUSTRY_SUPPORT = "industry_support"
    SYSTEM_ALERT = "system_alert"
