import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType, RequestStatus, UserRole
from app.models.funded_project_comment import FundedProjectComment
from app.models.industry_support import IndustrySupport
from app.models.user import User
from app.repositories.industry_repository import IndustryRepository, FACULTY_APPROVED_STATUSES
from app.repositories.project_repository import ProjectRepository
from app.schemas.industry import (
    FundedProjectCommentCreate,
    FundingOfferCreate,
    IndustrySupportCreate,
    IndustrySupportUpdateStatus,
)


class IndustryService:
    def __init__(self, db: AsyncSession):
        self.repo = IndustryRepository(db)
        self.project_repo = ProjectRepository(db)
        self.db = db

    # -------------------------------------------------------------------------
    # Legacy support intent flow (kept for backward compat)
    # -------------------------------------------------------------------------

    async def create_support_intent(self, industry_user: User, data: IndustrySupportCreate) -> IndustrySupport:
        if industry_user.role not in (UserRole.INDUSTRY, UserRole.ADMIN):
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
            # SECURITY: available_projects uses status-filtered query
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

    # -------------------------------------------------------------------------
    # Phase E: Industry Dashboard Stats
    # -------------------------------------------------------------------------

    async def get_dashboard_stats(self, user: User) -> dict:
        """Aggregated stats for the industry dashboard."""
        my_supports = await self.repo.list_by_industry_user(user.id)
        vetted = await self.repo.list_available_projects(limit=1000)  # total count

        profile = user.industry_profile
        return {
            "company_name": profile.company_name if profile else None,
            "contact_person": profile.point_of_contact_name if profile else None,
            "designation": getattr(profile, "designation", None),
            "is_approved": profile.is_approved if profile else False,
            "total_offers": len(my_supports),
            "pending_offers": sum(1 for s in my_supports if s.status == RequestStatus.PENDING),
            "accepted_offers": sum(1 for s in my_supports if s.status == RequestStatus.APPROVED),
            "withdrawn_offers": sum(1 for s in my_supports if s.status == RequestStatus.WITHDRAWN),
            "funded_pods_count": sum(1 for s in my_supports if s.status == RequestStatus.APPROVED),
            "vetted_pods_available": len(vetted),
        }

    # -------------------------------------------------------------------------
    # Phase E: Vetted Projects Discovery
    # -------------------------------------------------------------------------

    async def list_vetted_projects(
        self,
        category: str | None = None,
        state: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ):
        """SECURITY: All returned pods are guaranteed to be faculty-approved at DB level."""
        return await self.repo.list_vetted_projects(
            category=category, state=state, offset=offset, limit=limit
        )

    async def get_vetted_project_detail(self, pod_id: uuid.UUID):
        """SECURITY: Returns 404 if pod is not in a faculty-approved status."""
        pod = await self.repo.get_vetted_project_detail(pod_id)
        if not pod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "PROJECT_NOT_VETTED",
                    "message": "Solution pod not found or has not yet received faculty approval.",
                },
            )
        return pod

    # -------------------------------------------------------------------------
    # Phase E: Funding Offers
    # -------------------------------------------------------------------------

    async def create_funding_offer(self, user: User, data: FundingOfferCreate) -> IndustrySupport:
        """
        Industry user creates a funding offer.
        Security:
        - Pod must be faculty-approved (pilot/completed).
        - Reject duplicate pending offer from same user on same pod.
        - company_name is taken from the user's profile, never from frontend.
        """
        # Verify pod is faculty-approved
        pod = await self.repo.get_vetted_project_detail(data.pod_id)
        if not pod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "PROJECT_NOT_VETTED",
                    "message": "You can only make offers on faculty-approved solution pods.",
                },
            )

        # Reject duplicate pending offers
        existing = await self.repo.get_pending_offer_by_user_and_pod(user.id, data.pod_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_OFFER",
                    "message": "You already have a pending offer on this pod. Wait for a response or withdraw it first.",
                },
            )

        profile = user.industry_profile
        company_name = profile.company_name if profile else user.full_name or "Industry Partner"

        # Combine amount_or_terms and optional message
        terms = data.amount_or_terms
        if data.message:
            terms = f"{data.amount_or_terms}\n\nMessage: {data.message}"

        support_data = {
            "project_id": data.pod_id,
            "industry_user_id": user.id,
            "company_name": company_name,
            "support_type": data.support_type,
            "amount_or_terms": terms,
            "status": RequestStatus.PENDING,
        }
        support = await self.repo.create_support_intent(support_data)

        # Fire notification to pod lead (best-effort, non-blocking)
        try:
            from app.repositories.notification_repository import NotificationRepository
            notif_repo = NotificationRepository(self.db)
            async with self.db.begin_nested():
                await notif_repo.create_notification(
                    recipient_id=pod.lead_student_id,
                    title="New Industry Funding Offer",
                    message=f"{company_name} has submitted a funding offer for '{pod.title}'. Review it in your pod workspace.",
                    type=NotificationType.INDUSTRY_OFFER_MADE,
                    link=f"/student/pods/{pod.id}",
                )
        except Exception:
            pass  # Never let notification failure block the offer creation

        return support

    async def withdraw_offer(self, user: User, offer_id: uuid.UUID) -> IndustrySupport:
        """
        Industry user withdraws their own pending offer.
        - BOLA: can only withdraw their own offers.
        - Only PENDING offers can be withdrawn.
        """
        offer = await self.repo.get_by_id(offer_id)
        if not offer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "OFFER_NOT_FOUND", "message": "Funding offer not found."},
            )
        if offer.industry_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only withdraw your own funding offers."},
            )
        if offer.status != RequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "OFFER_NOT_PENDING",
                    "message": f"Cannot withdraw an offer with status '{offer.status}'. Only pending offers can be withdrawn.",
                },
            )
        return await self.repo.update_status(offer, RequestStatus.WITHDRAWN)

    async def list_my_offers(self, user: User) -> Sequence[IndustrySupport]:
        return await self.repo.list_by_industry_user(user.id)

    async def list_funded_pods(self, user: User):
        """All pods where this user has an APPROVED (accepted) offer."""
        return await self.repo.list_funded_pods_for_user(user.id)

    # -------------------------------------------------------------------------
    # Phase E: Funded Pod Access (gated on accepted offer)
    # -------------------------------------------------------------------------

    async def _verify_funder_access(self, user: User, pod_id: uuid.UUID):
        """Raises 403 if this user does not have an accepted offer on the pod."""
        has_access = await self.repo.has_accepted_offer(user.id, pod_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "NO_ACCEPTED_OFFER",
                    "message": "You must have an accepted funding offer on this pod to access this resource.",
                },
            )

    async def get_pod_updates_as_funder(self, user: User, pod_id: uuid.UUID):
        """Industry partner can see Engineering Log only if they have an accepted offer."""
        await self._verify_funder_access(user, pod_id)
        pod = await self.repo.get_vetted_project_detail(pod_id)
        if not pod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Pod not found."},
            )
        return pod.updates if pod.updates else []

    async def get_impact_report_as_funder(self, user: User, pod_id: uuid.UUID):
        """Industry partner can see Impact Report only if they have an accepted offer."""
        await self._verify_funder_access(user, pod_id)
        pod = await self.repo.get_vetted_project_detail(pod_id)
        if not pod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Pod not found."},
            )
        if not pod.impact_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NO_IMPACT_REPORT", "message": "This pod has not submitted an impact report yet."},
            )
        return pod.impact_report

    # -------------------------------------------------------------------------
    # Phase E: Funder Comments
    # -------------------------------------------------------------------------

    async def list_pod_comments(self, user: User, pod_id: uuid.UUID) -> Sequence[FundedProjectComment]:
        await self._verify_funder_access(user, pod_id)
        return await self.repo.list_comments_for_pod(pod_id)

    async def add_pod_comment(
        self, user: User, pod_id: uuid.UUID, data: FundedProjectCommentCreate
    ) -> FundedProjectComment:
        await self._verify_funder_access(user, pod_id)

        profile = user.industry_profile
        company_name = profile.company_name if profile else user.full_name or "Industry Partner"

        return await self.repo.create_comment(
            pod_id=pod_id,
            industry_user_id=user.id,
            comment=data.comment,
            company_name=company_name,
        )
