"""
industry.py — Industry Partner API endpoints.

Security model:
- All Phase E endpoints require `require_approved_industry` (approved role + profile.is_approved).
- Every project/pod list query filters status IN (pilot, completed) at the DB level.
- Student personal contact info (email, phone) is NEVER returned to industry users.
- Comments and Engineering Log access require an ACCEPTED (approved) IndustrySupport record on that specific pod.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_current_active_user,
    get_db,
    require_approved_industry,
    require_role,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.industry import (
    FundedProjectCommentCreate,
    FundedProjectCommentResponse,
    FundingOfferCreate,
    FundingOfferResponse,
    IndustryDashboardStats,
    IndustryPartnershipsOverviewResponse,
    IndustrySupportCreate,
    IndustrySupportResponse,
    IndustrySupportUpdateStatus,
    VettedProjectDetail,
    VettedProjectListItem,
)
from app.services.industry_service import IndustryService

router = APIRouter(prefix="/industry", tags=["Industry Partner & CSR"])


# =============================================================================
# PHASE E: Industry Dashboard
# =============================================================================

@router.get("/dashboard/stats", response_model=IndustryDashboardStats)
async def get_industry_dashboard_stats(
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregated stats for the Industry partner dashboard."""
    service = IndustryService(db)
    return await service.get_dashboard_stats(current_user)


# =============================================================================
# PHASE E: Vetted Solution Pods Discovery
# =============================================================================

@router.get("/vetted-projects", response_model=list[VettedProjectListItem])
async def list_vetted_projects(
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = Query(None, description="Filter by problem category"),
    state: str | None = Query(None, description="Filter by problem state"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Discover faculty-approved student solution pods.
    SECURITY: status IN (pilot, completed) enforced at DB query level.
    """
    service = IndustryService(db)
    pods = await service.list_vetted_projects(
        category=category, state=state, offset=offset, limit=limit
    )
    return [
        {
            "id": p.id,
            "title": p.title,
            "team_name": p.team_name,
            "description": p.description,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "problem_title": p.problem_title,
            "problem_category": p.problem_category,
            "problem_state": p.problem_state,
            "problem_district": p.problem_district,
            "university_name": p.university.university_name if p.university else None,
            "member_count": p.member_count,
            "created_at": p.created_at,
        }
        for p in pods
    ]


@router.get("/vetted-projects/{pod_id}", response_model=VettedProjectDetail)
async def get_vetted_project_detail(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Full detail of a faculty-approved pod.
    Returns 404 if pod doesn't exist or is not faculty-approved.
    NOTE: Engineering Log and student personal details are NOT returned here.
    """
    service = IndustryService(db)
    pod = await service.get_vetted_project_detail(pod_id)

    # Build latest faculty review summary
    latest_review = None
    if pod.reviews:
        approved_reviews = [r for r in pod.reviews if hasattr(r, "decision") and r.decision.value in ("approved", "changes_requested")]
        if approved_reviews:
            r = max(approved_reviews, key=lambda x: x.created_at)
            latest_review = {
                "id": r.id,
                "decision": r.decision.value if hasattr(r.decision, "value") else str(r.decision),
                "feedback": r.feedback_text,
                "reviewer_name": None,  # Faculty name intentionally omitted for industry
                "created_at": r.created_at,
            }

    # Return only last 3 milestone updates for teaser (not full Engineering Log)
    recent_updates = []
    if pod.updates:
        for u in sorted(pod.updates, key=lambda x: x.created_at, reverse=True)[:3]:
            recent_updates.append({
                "id": u.id,
                "content": u.content[:300] if u.content else "",
                "milestone": u.title,
                "created_at": u.created_at,
            })

    return {
        "id": pod.id,
        "title": pod.title,
        "team_name": pod.team_name,
        "description": pod.description,
        "status": pod.status.value if hasattr(pod.status, "value") else str(pod.status),
        "repository_url": pod.repository_url,
        "problem_title": pod.problem_title,
        "problem_category": pod.problem_category,
        "problem_state": pod.problem_state,
        "problem_district": pod.problem_district,
        "problem_impact_level": pod.problem_impact_level,
        "university_name": pod.university.university_name if pod.university else None,
        "member_count": pod.member_count,
        "progress": pod.progress,
        "latest_faculty_review": latest_review,
        "recent_updates": recent_updates,
        "created_at": pod.created_at,
    }


# =============================================================================
# PHASE E: Funding Offers
# =============================================================================

@router.post("/offers", response_model=FundingOfferResponse, status_code=status.HTTP_201_CREATED)
async def create_funding_offer(
    data: FundingOfferCreate,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Submit a funding offer on a faculty-approved pod.
    Raises DUPLICATE_OFFER if a pending offer already exists.
    """
    service = IndustryService(db)
    return await service.create_funding_offer(user=current_user, data=data)


@router.get("/offers/my", response_model=list[FundingOfferResponse])
async def list_my_offers(
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all funding offers made by this industry user (all statuses)."""
    service = IndustryService(db)
    return await service.list_my_offers(current_user)


@router.patch("/offers/{offer_id}/withdraw", response_model=FundingOfferResponse)
async def withdraw_offer(
    offer_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Withdraw a pending funding offer.
    Only PENDING offers can be withdrawn. Raises OFFER_NOT_PENDING otherwise.
    """
    service = IndustryService(db)
    return await service.withdraw_offer(user=current_user, offer_id=offer_id)


# =============================================================================
# PHASE E: Funded Projects (Accepted Offers)
# =============================================================================

@router.get("/funded-projects", response_model=list[FundingOfferResponse])
async def list_funded_projects(
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all pods where this industry user has an accepted (approved) funding offer."""
    service = IndustryService(db)
    return await service.list_funded_pods(current_user)


@router.get("/funded-projects/{pod_id}/updates")
async def get_pod_updates_as_funder(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    View Engineering Log updates for a funded pod.
    BOLA: requires an ACCEPTED offer on this specific pod.
    """
    service = IndustryService(db)
    updates = await service.get_pod_updates_as_funder(user=current_user, pod_id=pod_id)
    return [
        {
            "id": u.id,
            "content": u.content if hasattr(u, "content") else "",
            "milestone": getattr(u, "milestone", None),
            "created_at": u.created_at,
        }
        for u in updates
    ]


@router.get("/funded-projects/{pod_id}/impact-report")
async def get_impact_report_as_funder(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    View Impact Report for a funded pod.
    BOLA: requires an ACCEPTED offer on this specific pod.
    """
    service = IndustryService(db)
    report = await service.get_impact_report_as_funder(user=current_user, pod_id=pod_id)
    return {
        "id": report.id,
        "pod_id": report.pod_id,
        "beneficiaries_reached": report.beneficiaries_reached,
        "outcome_description": report.outcome_description,
        "proof_image_urls": report.proof_image_urls,
        "is_verified": report.is_verified,
        "created_at": report.created_at,
    }


# =============================================================================
# PHASE E: Funder Comments
# =============================================================================

@router.get("/funded-projects/{pod_id}/comments", response_model=list[FundedProjectCommentResponse])
async def list_pod_comments(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List comments by all funders on a pod.
    BOLA: requires an ACCEPTED offer on this specific pod.
    """
    service = IndustryService(db)
    return await service.list_pod_comments(user=current_user, pod_id=pod_id)


@router.post(
    "/funded-projects/{pod_id}/comments",
    response_model=FundedProjectCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_pod_comment(
    pod_id: uuid.UUID,
    data: FundedProjectCommentCreate,
    current_user: Annotated[User, Depends(require_approved_industry)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Add a comment on a funded pod.
    BOLA: requires an ACCEPTED offer on this specific pod.
    """
    service = IndustryService(db)
    return await service.add_pod_comment(user=current_user, pod_id=pod_id, data=data)


# =============================================================================
# LEGACY: Kept for backward compat with other roles' partnerships view
# =============================================================================

@router.get("/dashboard", response_model=dict)
async def get_industry_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Legacy dashboard endpoint — returns basic stats. Use /dashboard/stats for Phase E."""
    service = IndustryService(db)
    my_supports = await service.list_my_supports(current_user)

    company_name = (
        current_user.industry_profile.company_name
        if current_user.industry_profile
        else current_user.email
    )

    return {
        "company_name": company_name,
        "contact_person": current_user.industry_profile.point_of_contact_name if current_user.industry_profile else None,
        "designation": None,
        "supported_projects_count": len(my_supports),
        "total_supported_projects_count": len(my_supports),
        "pending_intents_count": sum(1 for s in my_supports if s.status == "pending"),
        "approved_intents_count": sum(1 for s in my_supports if s.status == "approved"),
    }


@router.get("/partnerships", response_model=IndustryPartnershipsOverviewResponse)
async def get_industry_partnerships(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Role-aware partnerships overview.
    SECURITY: available_projects now only returns faculty-approved pods.
    """
    service = IndustryService(db)
    return await service.get_partnerships_overview(current_user)


@router.post("/support", response_model=IndustrySupportResponse, status_code=status.HTTP_201_CREATED)
async def submit_support_intent(
    data: IndustrySupportCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Legacy support intent endpoint. Prefer POST /industry/offers for Phase E flow."""
    service = IndustryService(db)
    return await service.create_support_intent(industry_user=current_user, data=data)


@router.get("/support/my", response_model=list[IndustrySupportResponse])
async def list_my_supports(
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    return await service.list_my_supports(current_user)


@router.patch("/support/{support_id}/status", response_model=IndustrySupportResponse)
async def update_support_status(
    support_id: uuid.UUID,
    data: IndustrySupportUpdateStatus,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    return await service.update_status(user=current_user, support_id=support_id, data=data)
