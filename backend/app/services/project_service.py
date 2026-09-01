import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProblemStatus, ProjectStatus, UserRole
from app.models.project import ProjectMember, SolutionProject
from app.models.project_update import ProjectUpdate
from app.models.user import User
from app.repositories.problem_repository import ProblemRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectPickCreate, ProjectUpdateCreate


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProjectRepository(db)
        self.problem_repo = ProblemRepository(db)

    async def pick_project(self, lead_student: User, data: ProjectPickCreate) -> SolutionProject:
        if lead_student.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "STUDENT_ONLY", "message": "Only verified student accounts can pick projects."},
            )

        problem = await self.problem_repo.get_by_id(data.problem_id)
        if not problem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROBLEM_NOT_FOUND", "message": "The selected problem does not exist."},
            )

        university_id = lead_student.student_profile.university_id if lead_student.student_profile else None

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

        # Update problem status to in_progress if currently verified or submitted
        if problem.status in [ProblemStatus.SUBMITTED, ProblemStatus.VERIFIED]:
            await self.problem_repo.update_problem(problem, {"status": ProblemStatus.IN_PROGRESS})

        return await self.repo.create_project(project_data)

    async def get_project(self, project_id: uuid.UUID) -> SolutionProject:
        project = await self.repo.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution project not found."},
            )
        return project

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

    async def add_project_update(
        self, user: User, project_id: uuid.UUID, data: ProjectUpdateCreate
    ) -> ProjectUpdate:
        project = await self.get_project(project_id)

        # BOLA Check: User must be lead student or member or admin
        member_user_ids = [m.user_id for m in project.members]
        if user.id != project.lead_student_id and user.id not in member_user_ids and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not a member of this solution project team."},
            )

        update_dict = data.model_dump()
        return await self.repo.add_project_update(project_id, user.id, update_dict)

    async def add_member(self, user: User, project_id: uuid.UUID, new_user_id: uuid.UUID, role_in_team: str) -> ProjectMember:
        project = await self.get_project(project_id)

        # BOLA Check: Only lead student or admin can add team members
        if user.id != project.lead_student_id and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Only the project team lead can add team members."},
            )

        return await self.repo.add_member(project_id, new_user_id, role_in_team)
