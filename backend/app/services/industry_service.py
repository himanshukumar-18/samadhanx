import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RequestStatus, UserRole
from app.models.industry_support import IndustrySupport
from app.models.user import User
from app.repositories.industry_repository import IndustryRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.industry import IndustrySupportCreate, IndustrySupportUpdateStatus


class IndustryService:
    def __init__(self, db: AsyncSession):
        self.repo = IndustryRepository(db)
        self.project_repo = ProjectRepository(db)

    async def create_support_intent(self, industry_user: User, data: IndustrySupportCreate) -> IndustrySupport:
        if industry_user.role != UserRole.INDUSTRY and industry_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "INDUSTRY_ONLY", "message": "Only verified industry partner accounts can submit CSR support intents."},
            )

        project = await self.project_repo.get_by_id(data.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution project not found."},
            )

        company_name = (
            industry_user.industry_profile.company_name
            if industry_user.industry_profile
            else data.company_name
        )

        support_data = {
            "project_id": data.project_id,
            "industry_user_id": industry_user.id,
            "company_name": company_name,
            "support_type": data.support_type,
            "amount_or_terms": data.amount_or_terms,
            "status": RequestStatus.PENDING,
        }

        return await self.repo.create_support_intent(support_data)

    async def list_my_supports(self, industry_user: User) -> Sequence[IndustrySupport]:
        return await self.repo.list_by_industry_user(industry_user.id)

    async def get_partnerships_overview(self, user: User) -> dict:
        univ_id = user.university_profile.id if (user.role == UserRole.UNIVERSITY and user.university_profile) else None

        if user.role == UserRole.INDUSTRY:
            supports = await self.repo.list_by_industry_user(user.id)
            available_projects = await self.repo.list_available_projects()
            company_name = user.industry_profile.company_name if user.industry_profile else user.full_name
        elif user.role == UserRole.UNIVERSITY and univ_id:
            supports = await self.repo.list_by_university(univ_id)
            available_projects = await self.repo.list_available_projects(university_id=univ_id)
            company_name = user.university_profile.university_name if user.university_profile else None
        else:
            supports = await self.repo.list_all_partnerships()
            available_projects = await self.repo.list_available_projects()
            company_name = None

        total_partnerships = len(supports)
        active_grants = sum(1 for s in supports if s.status == RequestStatus.APPROVED)
        pending_reviews = sum(1 for s in supports if s.status == RequestStatus.PENDING)

        return {
            "partnerships": supports,
            "available_projects": [
                {
                    "id": p.id,
                    "title": p.title,
                    "team_name": p.team_name,
                    "description": p.description,
                    "problem_title": p.problem_title,
                    "university_name": p.university.university_name if p.university else None,
                    "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                    "created_at": p.created_at,
                }
                for p in available_projects
            ],
            "total_partnerships_count": total_partnerships,
            "active_grants_count": active_grants,
            "pending_reviews_count": pending_reviews,
            "user_role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "company_name": company_name,
        }

    async def update_status(self, user: User, support_id: uuid.UUID, data: IndustrySupportUpdateStatus) -> IndustrySupport:
        support = await self.repo.get_by_id(support_id)
        if not support:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Support record not found."},
            )

        # BOLA Check: Only project lead student, project mentor, university nodal officer, or admin
        project = await self.project_repo.get_by_id(support.project_id)
        is_authorized = False
        if user.role == UserRole.ADMIN:
            is_authorized = True
        elif project:
            if user.id == project.lead_student_id or user.id == project.faculty_mentor_id:
                is_authorized = True
            elif (
                user.role == UserRole.UNIVERSITY
                and user.university_profile
                and user.university_profile.id == project.university_id
            ):
                is_authorized = True

        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to moderate support requests for this project."},
            )

        return await self.repo.update_status(support, data.status)
