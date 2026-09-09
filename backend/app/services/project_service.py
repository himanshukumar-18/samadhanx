import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType, ProblemStatus, ProjectStatus, UserRole
from app.models.project import ProjectMember, SolutionProject
from app.models.project_review import ProjectReview
from app.models.project_update import ProjectUpdate
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.problem_repository import ProblemRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectPickCreate, ProjectUpdateCreate

# Status transitions a student/lead is allowed to trigger
_STUDENT_SUBMIT_TRANSITIONS: dict[ProjectStatus, ProjectStatus] = {
    ProjectStatus.PLANNING: ProjectStatus.REVIEW,
    ProjectStatus.IN_PROGRESS: ProjectStatus.REVIEW,
    ProjectStatus.PROTOTYPE: ProjectStatus.REVIEW,
}


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProjectRepository(db)
        self.problem_repo = ProblemRepository(db)
        self._notif_repo = NotificationRepository(db)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _notify(
        self,
        recipient_id: uuid.UUID,
        title: str,
        message: str,
        notif_type: NotificationType = NotificationType.SYSTEM_ALERT,
        link: str | None = None,
    ) -> None:
        """Fire-and-forget notification; never raises."""
        try:
            await self._notif_repo.create_notification(
                recipient_id=recipient_id,
                title=title,
                message=message,
                type=notif_type,
                link=link,
            )
        except Exception:
            pass  # Notifications are non-critical; never block the main flow.

    async def _assert_membership(
        self, user: User, project: SolutionProject, *, allow_admin: bool = True
    ) -> None:
        """Raise 403 if user is not lead, member, mentor or admin."""
        if allow_admin and user.role == UserRole.ADMIN:
            return
        if user.id == project.lead_student_id:
            return
        if user.id == project.faculty_mentor_id:
            return
        member_ids = {m.user_id for m in project.members}
        if user.id in member_ids:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You are not authorised to access this solution pod."},
        )

    # ------------------------------------------------------------------
    # Pod creation
    # ------------------------------------------------------------------

    async def pick_project(self, lead_student: User, data: ProjectPickCreate) -> SolutionProject:
        if lead_student.role not in (UserRole.STUDENT, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "STUDENT_ONLY", "message": "Only verified student accounts can create solution pods."},
            )

        problem = await self.problem_repo.get_by_id(data.problem_id)
        if not problem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROBLEM_NOT_FOUND", "message": "The selected problem does not exist."},
            )

        # Duplicate-pod guard: the same student cannot LEAD two active pods on
        # the same problem.  We check by querying solution_projects directly.
        dup_result = await self.db.execute(
            select(SolutionProject).where(
                SolutionProject.problem_id == data.problem_id,
                SolutionProject.lead_student_id == lead_student.id,
                SolutionProject.status.not_in([ProjectStatus.COMPLETED, ProjectStatus.REJECTED]),
            )
        )
        if dup_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_POD",
                    "message": "You are already leading an active solution pod for this problem.",
                },
            )

        university_id = (
            lead_student.student_profile.university_id
            if lead_student.student_profile
            else None
        )

        project_data = {
            "problem_id": data.problem_id,
            "team_name": data.team_name,
            "title": data.title,
            "description": data.description,
            "repository_url": data.repository_url,
            "status": ProjectStatus.PLANNING,
            "lead_student_id": lead_student.id,
            "faculty_mentor_id": data.faculty_mentor_id,
            "university_id": university_id,
        }

        # Move problem to in_progress if it's not already past that point
        if problem.status in (ProblemStatus.SUBMITTED, ProblemStatus.VERIFIED):
            await self.problem_repo.update_problem(problem, {"status": ProblemStatus.IN_PROGRESS})

        project = await self.repo.create_project(project_data)

        # Notify the pod lead (useful when pod is created on their behalf or as confirmation)
        await self._notify(
            recipient_id=lead_student.id,
            title="Solution Pod Created 🚀",
            message=f"Your pod \"{project.title}\" has been created for the problem \"{problem.title}\".",
            notif_type=NotificationType.POD_CREATED,
            link=f"/projects/{project.id}",
        )

        return project

    # ------------------------------------------------------------------
    # Get single pod — with BOLA enforcement
    # ------------------------------------------------------------------

    async def get_project(self, project_id: uuid.UUID, viewer: User | None = None) -> SolutionProject:
        project = await self.repo.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution pod not found."},
            )
        # If a viewer is provided, enforce BOLA
        if viewer is not None:
            await self._assert_membership(viewer, project)
        return project

    # ------------------------------------------------------------------
    # List pods
    # ------------------------------------------------------------------

    async def list_projects(
        self,
        problem_id: uuid.UUID | None = None,
        lead_student_id: uuid.UUID | None = None,
        faculty_mentor_id: uuid.UUID | None = None,
        university_id: uuid.UUID | None = None,
        status_filter: ProjectStatus | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[SolutionProject]:
        return await self.repo.list_projects(
            problem_id=problem_id,
            lead_student_id=lead_student_id,
            faculty_mentor_id=faculty_mentor_id,
            university_id=university_id,
            status=status_filter,
            offset=offset,
            limit=limit,
        )

    async def list_my_projects(self, user: User) -> Sequence[SolutionProject]:
        return await self.repo.list_user_projects(user.id)

    # ------------------------------------------------------------------
    # Submit pod for faculty review
    # ------------------------------------------------------------------

    async def submit_for_review(self, user: User, project_id: uuid.UUID) -> SolutionProject:
        project = await self.repo.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution pod not found."},
            )

        # Only the pod lead (or admin) may submit for review
        if user.role != UserRole.ADMIN and user.id != project.lead_student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "LEAD_ONLY", "message": "Only the pod lead can submit for faculty review."},
            )

        # Validate status transition
        new_status = _STUDENT_SUBMIT_TRANSITIONS.get(project.status)
        if new_status is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "INVALID_TRANSITION",
                    "message": (
                        f"Cannot submit a pod with status '{project.status.value}' for review. "
                        "Pod must be in planning, in_progress, or prototype stage."
                    ),
                },
            )

        project.status = new_status
        await self.db.flush()
        await self.db.refresh(project)

        # Notify the pod lead
        await self._notify(
            recipient_id=user.id,
            title="Pod Submitted for Review ✅",
            message=f"Your pod \"{project.title}\" has been submitted for faculty review.",
            notif_type=NotificationType.POD_SUBMITTED_FOR_REVIEW,
            link=f"/projects/{project.id}",
        )

        # Notify faculty mentor if assigned
        if project.faculty_mentor_id:
            await self._notify(
                recipient_id=project.faculty_mentor_id,
                title="New Pod Awaiting Your Review",
                message=f"The pod \"{project.title}\" has been submitted and requires your review.",
                notif_type=NotificationType.POD_SUBMITTED_FOR_REVIEW,
                link=f"/projects/{project.id}",
            )

        return project

    # ------------------------------------------------------------------
    # Project updates (milestone log)
    # ------------------------------------------------------------------

    async def add_project_update(
        self, user: User, project_id: uuid.UUID, data: ProjectUpdateCreate
    ) -> ProjectUpdate:
        project = await self.get_project(project_id)

        # Membership check — lead, member, or admin
        member_ids = {m.user_id for m in project.members}
        if (
            user.id != project.lead_student_id
            and user.id not in member_ids
            and user.role != UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not a member of this solution pod."},
            )

        update_dict = data.model_dump()
        return await self.repo.add_project_update(project_id, user.id, update_dict)

    # ------------------------------------------------------------------
    # Add team member
    # ------------------------------------------------------------------

    async def add_member(
        self, user: User, project_id: uuid.UUID, new_user_id: uuid.UUID, role_in_team: str
    ) -> ProjectMember:
        project = await self.get_project(project_id)

        # Only pod lead or admin may add members
        if user.id != project.lead_student_id and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Only the pod lead can add team members."},
            )

        member = await self.repo.add_member(project_id, new_user_id, role_in_team)

        # Notify the newly added member
        await self._notify(
            recipient_id=new_user_id,
            title="You've Joined a Solution Pod 🎉",
            message=f"You have been added to the pod \"{project.title}\" as {role_in_team}.",
            notif_type=NotificationType.POD_MEMBER_JOINED,
            link=f"/projects/{project.id}",
        )

        return member

    # ------------------------------------------------------------------
    # Get reviews for a pod
    # ------------------------------------------------------------------

    async def list_reviews(self, user: User, project_id: uuid.UUID) -> Sequence[ProjectReview]:
        project = await self.get_project(project_id)
        await self._assert_membership(user, project)
        return project.reviews
