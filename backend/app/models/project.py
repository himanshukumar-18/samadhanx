import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ProjectStatus

if TYPE_CHECKING:
    from app.models.industry_support import IndustrySupport
    from app.models.problem import Problem
    from app.models.profiles import UniversityProfile
    from app.models.project_review import ProjectReview
    from app.models.project_update import ProjectUpdate
    from app.models.user import User


class SolutionProject(BaseModel):
    __tablename__ = "solution_projects"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    team_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    repository_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[ProjectStatus] = mapped_column(
        SQLEnum(ProjectStatus, name="project_status_enum"),
        default=ProjectStatus.PLANNING,
        nullable=False,
        index=True,
    )

    lead_student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    faculty_mentor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    university_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("university_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    problem: Mapped["Problem"] = relationship("Problem", back_populates="projects")
    lead_student: Mapped["User"] = relationship("User", foreign_keys=[lead_student_id])
    faculty_mentor: Mapped["User | None"] = relationship("User", foreign_keys=[faculty_mentor_id])
    university: Mapped["UniversityProfile | None"] = relationship("UniversityProfile")
    members: Mapped[list["ProjectMember"]] = relationship(
        "ProjectMember", back_populates="project", cascade="all, delete-orphan"
    )
    updates: Mapped[list["ProjectUpdate"]] = relationship(
        "ProjectUpdate", back_populates="project", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["ProjectReview"]] = relationship(
        "ProjectReview", back_populates="project", cascade="all, delete-orphan"
    )
    supports: Mapped[list["IndustrySupport"]] = relationship(
        "IndustrySupport", back_populates="project", cascade="all, delete-orphan"
    )

    # ---------------------------------------------------------------------------
    # Computed shortcut properties (all safe against unloaded relations)
    # ---------------------------------------------------------------------------

    @property
    def problem_title(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.title if prob else None

    @property
    def problem_category(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.category if prob else None

    @property
    def problem_location(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.location if prob else None

    @property
    def problem_district(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.district if prob else None

    @property
    def problem_state(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.state if prob else None

    @property
    def problem_status(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.status.value if prob and hasattr(prob, "status") else None

    @property
    def problem_impact_level(self) -> str | None:
        prob = self.__dict__.get("problem")
        return prob.impact_level.value if prob and hasattr(prob, "impact_level") else None

    @property
    def lead_student_name(self) -> str | None:
        lead = self.__dict__.get("lead_student")
        return lead.full_name if lead else None

    @property
    def faculty_mentor_name(self) -> str | None:
        fm = self.__dict__.get("faculty_mentor")
        return fm.full_name if fm else None

    @property
    def faculty_mentor_department(self) -> str | None:
        fm = self.__dict__.get("faculty_mentor")
        if not fm:
            return None
        fp = fm.__dict__.get("faculty_profile") if hasattr(fm, "__dict__") else None
        if fp and hasattr(fp, "department"):
            return fp.department
        return None

    @property
    def progress(self) -> int:
        """
        Derive pod progress percentage from status + updates count.

        - completed           -> 100%
        - review / pilot      -> min(updates * 12, 95)   [close to finish]
        - rejected            -> min(updates * 12, 80)   [needs revision]
        - planning/in_progress/prototype -> min(updates * 12, 80)
        """
        if self.status == ProjectStatus.COMPLETED:
            return 100
        updates_list = self.__dict__.get("updates")
        update_count = len(updates_list) if updates_list else 0
        if self.status in (ProjectStatus.REVIEW, ProjectStatus.PILOT):
            return min(update_count * 12, 95)
        return min(update_count * 12, 80)

    @property
    def member_count(self) -> int:
        members_list = self.__dict__.get("members")
        return len(members_list) if members_list else 0


class ProjectMember(BaseModel):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_user_member"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_in_team: Mapped[str] = mapped_column(String(100), default="Member", nullable=False)

    project: Mapped["SolutionProject"] = relationship("SolutionProject", back_populates="members")
    user: Mapped["User"] = relationship("User")

    @property
    def member_name(self) -> str | None:
        u = self.__dict__.get("user")
        return u.full_name if u else None

    @property
    def email(self) -> str | None:
        u = self.__dict__.get("user")
        return u.email if u else None

    @property
    def avatar_url(self) -> str | None:
        u = self.__dict__.get("user")
        return u.avatar_url if u else None

