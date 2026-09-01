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

    async def update_status(self, user: User, support_id: uuid.UUID, data: IndustrySupportUpdateStatus) -> IndustrySupport:
        support = await self.repo.get_by_id(support_id)
        if not support:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Support record not found."},
            )

        # BOLA Check: Only the project lead student, project mentor, or admin can update status
        project = await self.project_repo.get_by_id(support.project_id)
        if project and (
            user.id != project.lead_student_id
            and user.id != project.faculty_mentor_id
            and user.role != UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to moderate support requests for this project."},
            )

        return await self.repo.update_status(support, data.status)
