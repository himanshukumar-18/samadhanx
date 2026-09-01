import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ProjectStatus
from app.models.project import ProjectMember, SolutionProject
from app.models.project_update import ProjectUpdate


class ProjectRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_project(self, project_data: dict) -> SolutionProject:
        project = SolutionProject(**project_data)
        self.db.add(project)
        await self.db.flush()

        # Add team lead as initial project member
        member = ProjectMember(
            project_id=project.id,
            user_id=project.lead_student_id,
            role_in_team="Team Lead",
        )
        self.db.add(member)
        await self.db.flush()
        return await self.get_by_id(project.id)

    async def get_by_id(self, project_id: uuid.UUID) -> SolutionProject | None:
        query = (
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.lead_student),
                selectinload(SolutionProject.faculty_mentor),
                selectinload(SolutionProject.university),
                selectinload(SolutionProject.members).selectinload(ProjectMember.user),
                selectinload(SolutionProject.updates),
                selectinload(SolutionProject.reviews),
                selectinload(SolutionProject.supports),
            )
            .where(SolutionProject.id == project_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_projects(
        self,
        problem_id: uuid.UUID | None = None,
        lead_student_id: uuid.UUID | None = None,
        faculty_mentor_id: uuid.UUID | None = None,
        university_id: uuid.UUID | None = None,
        status: ProjectStatus | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[SolutionProject]:
        query = (
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.lead_student),
                selectinload(SolutionProject.faculty_mentor),
                selectinload(SolutionProject.members).selectinload(ProjectMember.user),
                selectinload(SolutionProject.updates),
                selectinload(SolutionProject.reviews),
            )
            .order_by(SolutionProject.created_at.desc())
        )

        if problem_id:
            query = query.where(SolutionProject.problem_id == problem_id)
        if lead_student_id:
            query = query.where(SolutionProject.lead_student_id == lead_student_id)
        if faculty_mentor_id:
            query = query.where(SolutionProject.faculty_mentor_id == faculty_mentor_id)
        if university_id:
            query = query.where(SolutionProject.university_id == university_id)
        if status:
            query = query.where(SolutionProject.status == status)

        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def add_project_update(
        self, project_id: uuid.UUID, author_id: uuid.UUID, update_data: dict
    ) -> ProjectUpdate:
        update = ProjectUpdate(project_id=project_id, author_id=author_id, **update_data)
        self.db.add(update)
        await self.db.flush()
        await self.db.refresh(update)
        return update

    async def add_member(self, project_id: uuid.UUID, user_id: uuid.UUID, role_in_team: str = "Member") -> ProjectMember:
        member = ProjectMember(project_id=project_id, user_id=user_id, role_in_team=role_in_team)
        self.db.add(member)
        await self.db.flush()
        await self.db.refresh(member)
        return member
