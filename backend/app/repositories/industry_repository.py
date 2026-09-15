import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ProjectStatus, RequestStatus
from app.models.funded_project_comment import FundedProjectComment
from app.models.industry_support import IndustrySupport

# Statuses that represent faculty-approved work visible to Industry
FACULTY_APPROVED_STATUSES = [ProjectStatus.PILOT, ProjectStatus.COMPLETED]


class IndustryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # IndustrySupport (Funding Offers)
    # -------------------------------------------------------------------------

    async def create_support_intent(self, data: dict) -> IndustrySupport:
        support = IndustrySupport(**data)
        self.db.add(support)
        await self.db.flush()
        await self.db.refresh(support)
        return support

    async def get_by_id(self, support_id: uuid.UUID) -> IndustrySupport | None:
        from app.models.project import SolutionProject
        query = (
            select(IndustrySupport)
            .options(
                selectinload(IndustrySupport.project).selectinload(SolutionProject.problem),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.university),
                selectinload(IndustrySupport.industry_user),
            )
            .where(IndustrySupport.id == support_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_industry_user(self, industry_user_id: uuid.UUID) -> Sequence[IndustrySupport]:
        from app.models.project import SolutionProject
        query = (
            select(IndustrySupport)
            .options(
                selectinload(IndustrySupport.project).selectinload(SolutionProject.problem),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.university),
                selectinload(IndustrySupport.industry_user),
            )
            .where(IndustrySupport.industry_user_id == industry_user_id)
            .order_by(IndustrySupport.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_by_university(self, university_id: uuid.UUID) -> Sequence[IndustrySupport]:
        from app.models.project import SolutionProject
        query = (
            select(IndustrySupport)
            .join(SolutionProject, IndustrySupport.project_id == SolutionProject.id)
            .options(
                selectinload(IndustrySupport.project).selectinload(SolutionProject.problem),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.university),
                selectinload(IndustrySupport.industry_user),
            )
            .where(SolutionProject.university_id == university_id)
            .order_by(IndustrySupport.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_all_partnerships(self) -> Sequence[IndustrySupport]:
        from app.models.project import SolutionProject
        query = (
            select(IndustrySupport)
            .options(
                selectinload(IndustrySupport.project).selectinload(SolutionProject.problem),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.university),
                selectinload(IndustrySupport.industry_user),
            )
            .order_by(IndustrySupport.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_available_projects(self, university_id: uuid.UUID | None = None, limit: int = 20):
        """
        SECURITY: Only returns faculty-approved pods (pilot or completed).
        This filter is enforced at DB query level — never just on the frontend.
        """
        from app.models.project import SolutionProject
        query = (
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.university),
            )
            .where(SolutionProject.status.in_(FACULTY_APPROVED_STATUSES))
        )
        if university_id:
            query = query.where(SolutionProject.university_id == university_id)
        query = query.order_by(SolutionProject.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_vetted_projects(
        self,
        category: str | None = None,
        state: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ):
        """
        SECURITY: Faculty-approved pods only — enforced at query level.
        Supports category and state filters, pagination.
        """
        from app.models.problem import Problem
        from app.models.project import SolutionProject
        query = (
            select(SolutionProject)
            .join(Problem, SolutionProject.problem_id == Problem.id)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.university),
                selectinload(SolutionProject.members),
            )
            .where(SolutionProject.status.in_(FACULTY_APPROVED_STATUSES))
        )
        if category:
            query = query.where(Problem.category == category)
        if state:
            query = query.where(Problem.state == state)
        query = query.order_by(SolutionProject.updated_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_vetted_project_detail(self, pod_id: uuid.UUID):
        """
        SECURITY: Returns None if pod is NOT in a faculty-approved status.
        Eager-loads everything needed for the detail view.
        """
        from app.models.project import SolutionProject
        query = (
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.university),
                selectinload(SolutionProject.members),
                selectinload(SolutionProject.reviews),
                selectinload(SolutionProject.updates),
                selectinload(SolutionProject.impact_report),
            )
            .where(
                SolutionProject.id == pod_id,
                SolutionProject.status.in_(FACULTY_APPROVED_STATUSES),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_pending_offer_by_user_and_pod(
        self, industry_user_id: uuid.UUID, pod_id: uuid.UUID
    ) -> IndustrySupport | None:
        """Check for duplicate pending offer from same user on same pod."""
        query = select(IndustrySupport).where(
            IndustrySupport.industry_user_id == industry_user_id,
            IndustrySupport.project_id == pod_id,
            IndustrySupport.status == RequestStatus.PENDING,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def has_accepted_offer(self, industry_user_id: uuid.UUID, pod_id: uuid.UUID) -> bool:
        """Check if this industry user has an APPROVED offer on the given pod."""
        query = select(IndustrySupport).where(
            IndustrySupport.industry_user_id == industry_user_id,
            IndustrySupport.project_id == pod_id,
            IndustrySupport.status == RequestStatus.APPROVED,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def list_funded_pods_for_user(self, industry_user_id: uuid.UUID):
        """Return all pods where this user has an APPROVED offer."""
        from app.models.project import SolutionProject
        query = (
            select(IndustrySupport)
            .join(SolutionProject, IndustrySupport.project_id == SolutionProject.id)
            .options(
                selectinload(IndustrySupport.project).selectinload(SolutionProject.problem),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.university),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.members),
                selectinload(IndustrySupport.project).selectinload(SolutionProject.impact_report),
            )
            .where(
                IndustrySupport.industry_user_id == industry_user_id,
                IndustrySupport.status == RequestStatus.APPROVED,
            )
            .order_by(IndustrySupport.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_status(self, support: IndustrySupport, status: RequestStatus) -> IndustrySupport:
        support.status = status
        await self.db.flush()
        await self.db.refresh(support)
        return support

    # -------------------------------------------------------------------------
    # FundedProjectComment
    # -------------------------------------------------------------------------

    async def list_comments_for_pod(self, pod_id: uuid.UUID) -> Sequence[FundedProjectComment]:
        query = (
            select(FundedProjectComment)
            .options(selectinload(FundedProjectComment.industry_user))
            .where(FundedProjectComment.pod_id == pod_id)
            .order_by(FundedProjectComment.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def create_comment(
        self, pod_id: uuid.UUID, industry_user_id: uuid.UUID, comment: str, company_name: str
    ) -> FundedProjectComment:
        new_comment = FundedProjectComment(
            pod_id=pod_id,
            industry_user_id=industry_user_id,
            comment=comment,
            company_name=company_name,
        )
        self.db.add(new_comment)
        await self.db.flush()
        await self.db.refresh(new_comment)
        return new_comment
