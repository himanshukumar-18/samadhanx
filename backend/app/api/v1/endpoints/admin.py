import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.audit_log import AuditLog
from app.models.enums import (
    NotificationType,
    OrgType,
    ProblemStatus,
    ProjectStatus,
    RequestStatus,
    UserRole,
)

from app.models.institution_master import InstitutionMaster
from app.models.institution_request import InstitutionVerificationRequest
from app.models.problem import Problem
from app.models.profiles import IndustryProfile, UniversityProfile
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.schemas.admin import (
    AdminSummaryCountsResponse,
    AuditLogResponse,
    RequestReviewAction,
    RestrictedRequestResponse,
)
from app.schemas.common import StandardApiResponse
from app.core.rate_limit import rate_limiter
from app.schemas.duplicate import (
    AIHealthResponse,
    DuplicateLinkResponse,
    MergeRequest,
    MergeResponse,
)
from app.schemas.problem import ProblemModerationUpdate, ProblemResponse
from app.services.problem_service import ProblemService
from app.api.v1.endpoints.public import invalidate_public_universities_cache
from app.tasks.email import send_approval_email_task, send_rejection_email_task



router = APIRouter(prefix="/admin", tags=["Admin Operations"])


class AIFeedbackRequest(BaseModel):
    feature: str
    entity_id: str
    rating: str
    comment: str | None = None


class AIAcceptCategoryRequest(BaseModel):
    category: str


class AIImpactReportRequest(BaseModel):
    period: str = "30d"
    district: str | None = None


# 0. Live Summary Counts for Badges & Executive Overview
@router.get("/summary-counts", response_model=StandardApiResponse[AdminSummaryCountsResponse])
async def get_admin_summary_counts(
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    pending_partner_q = select(func.count(RestrictedAccountRequest.id)).where(
        RestrictedAccountRequest.status == RequestStatus.PENDING
    )
    pending_inst_q = select(func.count(InstitutionVerificationRequest.id)).where(
        InstitutionVerificationRequest.status == "PENDING"
    )
    pending_prob_q = select(func.count(Problem.id)).where(
        Problem.status == ProblemStatus.SUBMITTED
    )
    verified_inst_q = select(func.count(InstitutionMaster.id)).where(
        InstitutionMaster.verification_status == "verified",
        InstitutionMaster.is_active.is_(True),
    )
    total_users_q = select(func.count(User.id))
    total_problems_q = select(func.count(Problem.id))

    pending_partner = (await db.execute(pending_partner_q)).scalar() or 0
    pending_inst = (await db.execute(pending_inst_q)).scalar() or 0
    pending_prob = (await db.execute(pending_prob_q)).scalar() or 0
    verified_inst = (await db.execute(verified_inst_q)).scalar() or 0
    total_users = (await db.execute(total_users_q)).scalar() or 0
    total_problems = (await db.execute(total_problems_q)).scalar() or 0

    counts = AdminSummaryCountsResponse(
        pending_partner_requests=pending_partner,
        pending_institution_verifications=pending_inst,
        pending_problem_moderations=pending_prob,
        total_verified_institutions=verified_inst,
        total_users=total_users,
        total_problems=total_problems,
    )
    return StandardApiResponse(success=True, data=counts)



# 1. List All Pending / Reviewed Requests
@router.get("/requests", response_model=StandardApiResponse[list[RestrictedRequestResponse]])
async def list_restricted_requests(
    status_filter: RequestStatus | None = None,
    org_type: OrgType | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(RestrictedAccountRequest).order_by(RestrictedAccountRequest.created_at.desc())
    if status_filter:
        query = query.where(RestrictedAccountRequest.status == status_filter)
    if org_type:
        query = query.where(RestrictedAccountRequest.org_type == org_type)
    if q and len(q.strip()) >= 2:
        search_pattern = f"%{q.strip()}%"
        query = query.where(
            RestrictedAccountRequest.org_name.ilike(search_pattern)
            | RestrictedAccountRequest.nodal_officer_name.ilike(search_pattern)
            | RestrictedAccountRequest.official_email.ilike(search_pattern)
            | RestrictedAccountRequest.registration_identifier.ilike(search_pattern)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    requests = result.scalars().all()

    items = [
        RestrictedRequestResponse(
            id=r.id,
            user_id=r.user_id,
            org_type=r.org_type,
            org_name=r.org_name,
            registration_identifier=r.registration_identifier,
            nodal_officer_name=r.nodal_officer_name,
            official_email=r.official_email,
            status=r.status,
            rejection_reason=r.rejection_reason,
            created_at=r.created_at,
            reviewed_at=r.reviewed_at,
        )
        for r in requests
    ]
    return StandardApiResponse(success=True, data=items, message=f"Total {total} requests found.")


# 2. Approve Request
@router.patch("/requests/{request_id}/approve", response_model=StandardApiResponse[RestrictedRequestResponse])
async def approve_request(
    request_id: uuid.UUID,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(RestrictedAccountRequest).where(RestrictedAccountRequest.id == request_id)
    req = (await db.execute(query)).scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "REQUEST_NOT_FOUND", "message": "Account request record not found."},
        )

    if req.status == RequestStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_APPROVED", "message": "This request has already been approved."},
        )

    # Update request state
    req.status = RequestStatus.APPROVED
    req.reviewed_by = current_admin.id
    req.reviewed_at = datetime.now(UTC)
    req.rejection_reason = None

    # Activate & approve the target User account
    user = (await db.execute(select(User).where(User.id == req.user_id))).scalar_one_or_none()
    if user:
        user.is_approved = True

        # Also mark profile as approved
        if user.role == UserRole.UNIVERSITY:
            univ_prof = (await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == user.id))).scalar_one_or_none()
            if univ_prof:
                univ_prof.is_approved = True
                if not univ_prof.institution_id:
                    match_inst = None
                    if req.registration_identifier:
                        match_inst = (await db.execute(select(InstitutionMaster).where(InstitutionMaster.aishe_code == req.registration_identifier.strip()))).scalar_one_or_none()
                    if not match_inst and req.org_name:
                        match_inst = (await db.execute(select(InstitutionMaster).where(InstitutionMaster.name.ilike(req.org_name.strip())))).scalar_one_or_none()
                    if match_inst:
                        univ_prof.institution_id = match_inst.id
        elif user.role == UserRole.INDUSTRY:
            ind_prof = (await db.execute(select(IndustryProfile).where(IndustryProfile.user_id == user.id))).scalar_one_or_none()
            if ind_prof:
                ind_prof.is_approved = True


    # Audit Log
    audit = AuditLog(
        actor_id=current_admin.id,
        action="APPROVE_RESTRICTED_REQUEST",
        target_type="request",
        target_id=str(req.id),
        metadata_json={"org_name": req.org_name, "org_type": req.org_type.value},
    )
    db.add(audit)
    await db.commit()
    invalidate_public_universities_cache()

    # Dispatch Celery Approval Email (safe failure)
    try:
        send_approval_email_task.delay(req.official_email, req.org_name, req.org_type.value)
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data=RestrictedRequestResponse(
            id=req.id,
            user_id=req.user_id,
            org_type=req.org_type,
            org_name=req.org_name,
            registration_identifier=req.registration_identifier,
            nodal_officer_name=req.nodal_officer_name,
            official_email=req.official_email,
            status=req.status,
            rejection_reason=req.rejection_reason,
            created_at=req.created_at,
            reviewed_at=req.reviewed_at,
        ),
        message=f"{req.org_type.value.capitalize()} request for '{req.org_name}' approved successfully.",
    )


# 3. Reject Request
@router.patch("/requests/{request_id}/reject", response_model=StandardApiResponse[RestrictedRequestResponse])
async def reject_request(
    request_id: uuid.UUID,
    data: RequestReviewAction,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(RestrictedAccountRequest).where(RestrictedAccountRequest.id == request_id)
    req = (await db.execute(query)).scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "REQUEST_NOT_FOUND", "message": "Account request record not found."},
        )

    req.status = RequestStatus.REJECTED
    req.reviewed_by = current_admin.id
    req.reviewed_at = datetime.now(UTC)
    req.rejection_reason = data.rejection_reason or "Institutional credentials could not be verified."

    user = (await db.execute(select(User).where(User.id == req.user_id))).scalar_one_or_none()
    if user:
        user.is_approved = False

    audit = AuditLog(
        actor_id=current_admin.id,
        action="REJECT_RESTRICTED_REQUEST",
        target_type="request",
        target_id=str(req.id),
        metadata_json={"org_name": req.org_name, "reason": req.rejection_reason},
    )
    db.add(audit)
    await db.commit()

    # Dispatch Celery Rejection Email (safe failure)
    try:
        send_rejection_email_task.delay(req.official_email, req.org_name, req.rejection_reason)
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data=RestrictedRequestResponse(
            id=req.id,
            user_id=req.user_id,
            org_type=req.org_type,
            org_name=req.org_name,
            registration_identifier=req.registration_identifier,
            nodal_officer_name=req.nodal_officer_name,
            official_email=req.official_email,
            status=req.status,
            rejection_reason=req.rejection_reason,
            created_at=req.created_at,
            reviewed_at=req.reviewed_at,
        ),
        message=f"{req.org_type.value.capitalize()} request for '{req.org_name}' rejected.",
    )



# 4a. List Problems for Content Moderation
@router.get("/moderation/problems", response_model=StandardApiResponse[list[ProblemResponse]])
async def list_moderation_problems(
    status_filter: ProblemStatus | None = None,
    category: str | None = None,
    is_verified: bool | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Problem)
        .options(
            selectinload(Problem.author),
            selectinload(Problem.comments),
            selectinload(Problem.endorsements),
            selectinload(Problem.projects),
        )
        .order_by(Problem.created_at.desc())
    )
    if status_filter:
        query = query.where(Problem.status == status_filter)
    if category:
        query = query.where(Problem.category.ilike(f"%{category.strip()}%"))
    if is_verified is not None:
        query = query.where(Problem.is_verified == is_verified)
    if q and len(q.strip()) >= 2:
        search_pattern = f"%{q.strip()}%"
        query = query.where(
            Problem.title.ilike(search_pattern)
            | Problem.description.ilike(search_pattern)
            | Problem.district.ilike(search_pattern)
            | Problem.state.ilike(search_pattern)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    problems = result.scalars().all()

    return StandardApiResponse(success=True, data=problems, message=f"Total {total} problems found.")


# 4b. Problem Moderation Action
@router.patch("/problems/{problem_id}/moderate", response_model=ProblemResponse)
async def moderate_problem(
    problem_id: uuid.UUID,
    data: ProblemModerationUpdate,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    service = ProblemService(db)
    problem = await service.get_problem(problem_id)
    update_data: dict = {"status": data.status}
    if data.is_verified is not None:
        update_data["is_verified"] = data.is_verified

    updated = await service.repo.update_problem(problem, update_data)

    # Fetch latest AI analysis if available for human override traceability
    from app.ai_engine.services.ai_orchestrator import AIOrchestrator
    latest_ai = await AIOrchestrator.get_latest_analysis(db, problem_id)
    ai_recommendation = latest_ai.recommendation.value if (latest_ai and latest_ai.recommendation) else None

    # Audit Log
    audit = AuditLog(
        actor_id=current_admin.id,
        action="MODERATE_PROBLEM",
        target_type="problem",
        target_id=str(problem.id),
        metadata_json={
            "new_status": data.status.value,
            "is_verified": data.is_verified,
            "ai_recommendation": ai_recommendation,
            "human_decision": data.status.value,
            "ai_override": bool(ai_recommendation and ai_recommendation != data.status.value),
        },
    )
    db.add(audit)

    # In-App Notification to Author
    notif_repo = NotificationRepository(db)
    status_display = data.status.value.replace("_", " ").title()
    msg = f"Your civic problem report '{problem.title}' has been updated to {status_display} by the National Governance Desk."
    if data.is_verified:
        msg += " It has also received the Official Verified Challenge badge."
    await notif_repo.create_notification(
        recipient_id=problem.created_by_id,
        title="Problem Status Moderated",
        message=msg,
        type=NotificationType.PROBLEM_UPDATED,
        link=f"/problems/{problem.id}",
    )

    await db.commit()
    return updated


# 4c. Retrieve AI Moderation Analysis & History for Problem
@router.get("/problems/{problem_id}/ai-analysis", response_model=StandardApiResponse[dict])
async def get_problem_ai_analysis(
    problem_id: uuid.UUID,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    from app.ai_engine.services.ai_orchestrator import AIOrchestrator
    latest = await AIOrchestrator.get_latest_analysis(db, problem_id)
    history = await AIOrchestrator.list_analysis_history(db, problem_id)

    from app.ai_engine.schemas.moderation import PersistedAIAnalysisResponse

    latest_data = PersistedAIAnalysisResponse.model_validate(latest).model_dump(mode="json") if latest else None
    history_data = [PersistedAIAnalysisResponse.model_validate(h).model_dump(mode="json") for h in history]

    return StandardApiResponse(
        success=True,
        data={
            "latest": latest_data,
            "history": history_data,
            "reason": "not_generated" if latest is None else None,
        },
        message=("AI moderation analysis retrieved successfully." if latest else "No analysis generated yet; use Generate AI Insight.") ,
    )


@router.patch("/problems/{problem_id}/accept-ai-category", response_model=ProblemResponse)
async def accept_ai_category(
    problem_id: uuid.UUID,
    body: AIAcceptCategoryRequest,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Apply a category suggestion only after an explicit admin action."""
    from app.ai_engine.services.ai_orchestrator import AIOrchestrator

    problem = await db.get(Problem, problem_id)
    latest = await AIOrchestrator.get_latest_analysis(db, problem_id)
    if not problem or not latest or not latest.category or body.category != latest.category:
        raise HTTPException(status_code=400, detail={"code": "AI_CATEGORY_NOT_AVAILABLE", "message": "No matching AI category suggestion is available."})
    old_category = problem.category
    problem.category = latest.category
    db.add(AuditLog(
        actor_id=current_admin.id,
        action="AI_CATEGORY_ACCEPTED",
        target_type="problem",
        target_id=str(problem_id),
        metadata_json={"old_category": old_category, "new_category": latest.category, "analysis_id": str(latest.id)},
    ))
    await db.commit()
    await db.refresh(problem)
    return problem


@router.post("/ai/feedback", response_model=StandardApiResponse[dict])
async def submit_ai_feedback(
    body: AIFeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.ai import AIFeedback
    if body.rating not in {"up", "down"}:
        raise HTTPException(status_code=422, detail={"code": "INVALID_AI_FEEDBACK", "message": "Rating must be up or down."})
    if len(body.feature) > 64 or len(body.entity_id) > 128 or (body.comment and len(body.comment) > 300):
        raise HTTPException(status_code=422, detail={"code": "INVALID_AI_FEEDBACK", "message": "Feedback fields exceed their limits."})
    db.add(AIFeedback(feature=body.feature, entity_id=body.entity_id, user_id=current_user.id, rating=body.rating, comment=body.comment))
    await db.commit()
    return StandardApiResponse(success=True, data={"recorded": True})


@router.post("/ai/impact-report", response_model=StandardApiResponse[dict])
async def generate_ai_impact_report(
    body: AIImpactReportRequest,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limiter(requests_per_minute=5, key_prefix="ai_impact")),
):
    """Create a number-verifiable deterministic report from aggregate stats."""
    from datetime import timedelta
    from app.core.config import settings as app_settings
    if not getattr(app_settings, "AI_IMPACT_ENABLED", True):
        raise HTTPException(status_code=503, detail={"code": "AI_DISABLED", "message": "Impact AI is disabled."})
    from app.models.project import SolutionProject
    period_days = {"7d": 7, "30d": 30, "all": None}.get(body.period)
    if body.period not in {"7d", "30d", "all"}:
        raise HTTPException(status_code=422, detail={"code": "INVALID_REPORT_PERIOD", "message": "Period must be 7d, 30d, or all."})
    cutoff = datetime.now(UTC) - timedelta(days=period_days) if period_days else None
    problem_filter = []
    if cutoff:
        problem_filter.append(Problem.created_at >= cutoff)
    if body.district:
        problem_filter.append(Problem.district.ilike(body.district.strip()))
    total = (await db.execute(select(func.count(Problem.id)).where(*problem_filter))).scalar() or 0
    solved = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.SOLVED, *problem_filter))).scalar() or 0
    verified = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.VERIFIED, *problem_filter))).scalar() or 0
    pods = (await db.execute(select(func.count(SolutionProject.id)).where(*([SolutionProject.created_at >= cutoff] if cutoff else [])))).scalar() or 0
    stats = {"problems_reported": total, "approved": verified, "solved": solved, "active_pods": pods, "period": body.period, "district": body.district}
    narrative = {
        "headline": f"SamadhanX recorded {total} problem reports in the selected period.",
        "highlights": [f"{verified} problems are verified.", f"{solved} problems are solved.", f"{pods} solution pods are active."],
        "risk": "Some reports still need verification." if total > verified else "Continue monitoring verification capacity.",
        "suggestion": "Prioritize older unverified reports and maintain regular pod updates.",
        "template": True,
        "stats": stats,
        "based_on": f"Based on {body.period} aggregate data" + (f" for {body.district}." if body.district else "."),
    }
    return StandardApiResponse(success=True, data=narrative, message="Template summary generated from aggregate platform data.")


@router.get("/ai/impact-report/latest", response_model=StandardApiResponse[dict])
async def latest_ai_impact_report(current_admin: User = Depends(require_role([UserRole.ADMIN]))):
    return StandardApiResponse(success=True, data=None, message="No persisted impact report is available yet.")


# 4c-POST. On-Demand AI Analysis Generation (synchronous, cached, timeout-guarded)
class AIAnalysisGenerateRequest(BaseModel):
    force: bool = False


@router.post("/problems/{problem_id}/ai-analysis", response_model=StandardApiResponse[dict])
async def generate_problem_ai_analysis(
    problem_id: uuid.UUID,
    body: AIAnalysisGenerateRequest = AIAnalysisGenerateRequest(),
    force: bool = Query(False),
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Synchronous on-demand AI analysis generation for Admin moderation panel.

    - Returns cached result immediately if a completed analysis exists within cooldown.
    - Otherwise runs the full LangGraph pipeline inline (awaited), with a 15s timeout.
    - Never blocks new problem submissions — this endpoint is Admin-only, on-demand.
    """
    import asyncio
    import datetime as dt
    from app.core.config import settings as app_settings
    from app.ai_engine.services.ai_orchestrator import AIOrchestrator
    from app.ai_engine.schemas.moderation import PersistedAIAnalysisResponse

    # Guard: AI must be enabled
    if not (getattr(app_settings, "AI_ENABLED", True) and getattr(app_settings, "AI_MODERATION_ENABLED", True)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_SERVICE_UNAVAILABLE", "message": "AI moderation service is currently disabled."},
        )

    cooldown_secs = getattr(app_settings, "AI_MANUAL_REANALYSIS_COOLDOWN_SECONDS", 60)
    timeout_secs = getattr(app_settings, "AI_TIMEOUT_SECONDS", 15)

    try:
        analysis, was_cached = await asyncio.wait_for(
            AIOrchestrator.generate_or_return_cached(
                db=db,
                problem_id=problem_id,
                triggered_by_id=current_admin.id,
                cooldown_secs=cooldown_secs,
                force=body.force or force,
            ),
            timeout=float(timeout_secs) + 5,  # slight buffer over provider timeout
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "AI_ANALYSIS_TIMEOUT",
                "message": f"AI inference did not complete within {timeout_secs}s. Please try again.",
            },
        )
    except ValueError as e:
        # Problem not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROBLEM_NOT_FOUND", "message": str(e)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "AI_ANALYSIS_FAILED",
                "message": "AI analysis could not be completed. Check provider configuration and retry.",
                "detail": str(e),
            },
        )

    from app.models.enums import AIAnalysisStatus
    if analysis.status == AIAnalysisStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": analysis.error_code or "AI_ANALYSIS_FAILED",
                "message": analysis.error_message or "AI analysis could not be completed. Check provider configuration and retry.",
            },
        )

    analysis_data = PersistedAIAnalysisResponse.model_validate(analysis).model_dump(mode="json")
    msg = (
        f"Returning cached AI analysis (generated {int((dt.datetime.now(dt.timezone.utc) - analysis.completed_at.replace(tzinfo=dt.timezone.utc)).total_seconds())}s ago)."
        if was_cached and analysis.completed_at
        else f"AI analysis version {analysis.analysis_version} completed with status: {analysis.status.value}."
    )

    return StandardApiResponse(
        success=True,
        data=analysis_data,
        message=msg,
    )




# 4d. Trigger AI Re-Analysis on Demand (Admin only, cooldown enforced)
@router.post("/problems/{problem_id}/reanalyze-ai", response_model=StandardApiResponse[dict])
async def trigger_problem_ai_reanalysis(
    problem_id: uuid.UUID,
    data: dict | None = None,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    import datetime as dt
    from app.core.config import settings as app_settings
    from app.ai_engine.services.ai_orchestrator import AIOrchestrator
    from app.ai_engine.schemas.moderation import PersistedAIAnalysisResponse

    # Guard: manual re-analysis must be enabled
    if not getattr(app_settings, "AI_MANUAL_REANALYSIS_ENABLED", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AI_REANALYSIS_DISABLED", "message": "Manual AI re-analysis is currently disabled."},
        )

    # Cooldown enforcement: check when the last completed analysis ran
    cooldown_secs = getattr(app_settings, "AI_MANUAL_REANALYSIS_COOLDOWN_SECONDS", 60)
    latest = await AIOrchestrator.get_latest_analysis(db, problem_id)
    if latest and latest.completed_at:
        elapsed = (dt.datetime.now(dt.timezone.utc) - latest.completed_at.replace(tzinfo=dt.timezone.utc)).total_seconds()
        if elapsed < cooldown_secs:
            remaining = int(cooldown_secs - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "AI_REANALYSIS_COOLDOWN",
                    "message": f"Please wait {remaining}s before triggering another AI analysis.",
                    "retry_after_seconds": remaining,
                },
            )

    force = bool(data.get("force", False)) if data else False
    reason = str(data.get("reason", "Admin manual re-evaluation")) if data else "Admin manual re-evaluation"

    analysis = await AIOrchestrator.reanalyze_problem(
        db=db,
        problem_id=problem_id,
        admin_user=current_admin,
        force=force,
        reason=reason,
    )

    from app.models.enums import AIAnalysisStatus
    if analysis.status == AIAnalysisStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": analysis.error_code or "AI_ANALYSIS_FAILED",
                "message": analysis.error_message or "AI analysis could not be completed. Check provider configuration and retry.",
            },
        )

    analysis_data = PersistedAIAnalysisResponse.model_validate(analysis).model_dump(mode="json")

    return StandardApiResponse(
        success=True,
        data=analysis_data,
        message=f"AI analysis version {analysis.analysis_version} completed with status: {analysis.status.value}.",
    )





from app.models.enums import NotificationType, ProblemStatus, ProjectStatus, RequestStatus, UserRole
from app.models.project import SolutionProject
from app.schemas.admin import (
    AdminAnalyticsResponse,
    AdminSummaryCountsResponse,
    AuditLogResponse,
    CategoryCountItem,
    ProblemStatusBreakdown,
    ProjectStatusBreakdown,
    RequestReviewAction,
    RestrictedRequestResponse,
    UserRoleBreakdown,
)

# 5. View Audit Logs (Filterable & Paginated)
@router.get("/audit-logs", response_model=StandardApiResponse[list[AuditLogResponse]])
async def list_audit_logs(
    action: str | None = None,
    target_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    items = [
        AuditLogResponse(
            id=log_entry.id,
            actor_id=log_entry.actor_id,
            action=log_entry.action,
            target_type=log_entry.target_type,
            target_id=log_entry.target_id,
            metadata_json=log_entry.metadata_json,
            ip_address=log_entry.ip_address,
            created_at=log_entry.created_at,
        )
        for log_entry in logs
    ]
    return StandardApiResponse(success=True, data=items, message=f"Total {total} audit entries found.")


# 6. Platform Analytics & National Governance Scorecard
@router.get("/analytics", response_model=StandardApiResponse[AdminAnalyticsResponse])
async def get_platform_analytics(
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    # 1. User aggregations
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))).scalar() or 0
    verified_users = (await db.execute(select(func.count(User.id)).where(User.is_verified.is_(True)))).scalar() or 0

    citizens = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.CITIZEN))).scalar() or 0
    students = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.STUDENT))).scalar() or 0
    faculty = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.FACULTY))).scalar() or 0
    universities = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.UNIVERSITY))).scalar() or 0
    industry = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.INDUSTRY))).scalar() or 0
    admins = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN))).scalar() or 0

    user_roles = UserRoleBreakdown(
        citizens=citizens,
        students=students,
        faculty=faculty,
        universities=universities,
        industry=industry,
        admins=admins,
    )

    # 2. Problem aggregations
    total_problems = (await db.execute(select(func.count(Problem.id)))).scalar() or 0
    verified_problems = (await db.execute(select(func.count(Problem.id)).where(Problem.is_verified.is_(True)))).scalar() or 0
    solved_problems = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.SOLVED))).scalar() or 0

    prob_submitted = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.SUBMITTED))).scalar() or 0
    prob_under_review = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.UNDER_REVIEW))).scalar() or 0
    prob_verified = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.VERIFIED))).scalar() or 0
    prob_in_progress = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.IN_PROGRESS))).scalar() or 0
    prob_sol_sub = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.SOLUTION_SUBMITTED))).scalar() or 0
    prob_pilot = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.PILOT))).scalar() or 0
    prob_solved = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.SOLVED))).scalar() or 0
    prob_rejected = (await db.execute(select(func.count(Problem.id)).where(Problem.status == ProblemStatus.REJECTED))).scalar() or 0

    problem_statuses = ProblemStatusBreakdown(
        submitted=prob_submitted,
        under_review=prob_under_review,
        verified=prob_verified,
        in_progress=prob_in_progress,
        solution_submitted=prob_sol_sub,
        pilot=prob_pilot,
        solved=prob_solved,
        rejected=prob_rejected,
    )

    # Category breakdown query
    cat_query = select(Problem.category, func.count(Problem.id)).group_by(Problem.category).order_by(func.count(Problem.id).desc()).limit(10)
    cat_rows = (await db.execute(cat_query)).all()
    categories_breakdown = [CategoryCountItem(category=row[0], count=row[1]) for row in cat_rows]

    # 3. Project / Pod aggregations
    total_projects = (await db.execute(select(func.count(SolutionProject.id)))).scalar() or 0
    completed_projects = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.COMPLETED))).scalar() or 0

    proj_planning = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.PLANNING))).scalar() or 0
    proj_in_progress = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.IN_PROGRESS))).scalar() or 0
    proj_prototype = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.PROTOTYPE))).scalar() or 0
    proj_review = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.REVIEW))).scalar() or 0
    proj_pilot = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.PILOT))).scalar() or 0
    proj_completed = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.COMPLETED))).scalar() or 0
    proj_rejected = (await db.execute(select(func.count(SolutionProject.id)).where(SolutionProject.status == ProjectStatus.REJECTED))).scalar() or 0

    project_statuses = ProjectStatusBreakdown(
        planning=proj_planning,
        in_progress=proj_in_progress,
        prototype=proj_prototype,
        review=proj_review,
        pilot=proj_pilot,
        completed=proj_completed,
        rejected=proj_rejected,
    )

    # 4. Institution aggregations
    total_institutions = (await db.execute(select(func.count(InstitutionMaster.id)))).scalar() or 0
    verified_institutions = (await db.execute(select(func.count(InstitutionMaster.id)).where(InstitutionMaster.verification_status == "verified", InstitutionMaster.is_active.is_(True)))).scalar() or 0
    pending_inst_requests = (await db.execute(select(func.count(InstitutionVerificationRequest.id)).where(InstitutionVerificationRequest.status == "PENDING"))).scalar() or 0

    analytics = AdminAnalyticsResponse(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        user_roles=user_roles,
        total_problems=total_problems,
        verified_problems=verified_problems,
        solved_problems=solved_problems,
        problem_statuses=problem_statuses,
        categories_breakdown=categories_breakdown,
        total_projects=total_projects,
        completed_projects=completed_projects,
        project_statuses=project_statuses,
        total_institutions=total_institutions,
        verified_institutions=verified_institutions,
        pending_institution_requests=pending_inst_requests,
        generated_at=datetime.now(UTC),
    )

    return StandardApiResponse(success=True, data=analytics, message="Platform analytics generated successfully.")


# ---------------------------------------------------------
# Duplicate Problem Detection & Deduplication Workflows
# ---------------------------------------------------------

@router.get(
    "/problems/{problem_id}/duplicates",
    response_model=StandardApiResponse[list[DuplicateLinkResponse]],
    summary="Get duplicate links and candidate problems for a problem",
)
async def get_problem_duplicates(
    problem_id: uuid.UUID,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    from app.ai_engine.services.duplicate_service import DuplicateDetectionService
    service = DuplicateDetectionService(db)
    links = await service.get_duplicates_for_problem(problem_id)
    return StandardApiResponse(success=True, data=links, message="Duplicate links retrieved.")


@router.post(
    "/problems/{problem_id}/duplicates/run",
    response_model=StandardApiResponse[list[DuplicateLinkResponse]],
    summary="Run on-demand duplicate detection analysis for a problem",
)
async def run_problem_duplicate_detection(
    problem_id: uuid.UUID,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limiter(requests_per_minute=10, key_prefix="admin_dup_run")),
):
    from app.ai_engine.services.duplicate_service import DuplicateDetectionService
    problem = await db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROBLEM_NOT_FOUND", "message": "Problem not found."},
        )

    service = DuplicateDetectionService(db)
    links, degraded = await service.run_moderation_detection(problem, save_links=True)
    msg = "Duplicate detection completed with degraded mode (fail open)" if degraded else "Duplicate detection completed."
    return StandardApiResponse(success=True, data=links, message=msg)


@router.post(
    "/problems/{problem_id}/merge",
    response_model=StandardApiResponse[MergeResponse],
    summary="Transactionally merge a duplicate problem into a canonical problem",
)
async def merge_duplicate_problem(
    problem_id: uuid.UUID,
    data: MergeRequest,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limiter(requests_per_minute=15, key_prefix="admin_merge")),
):
    from app.ai_engine.services.duplicate_service import DuplicateDetectionService
    service = DuplicateDetectionService(db)
    res = await service.merge_problems(
        problem_id=problem_id,
        target_problem_id=data.target_problem_id,
        admin_user=current_admin,
    )
    return StandardApiResponse(success=True, data=res, message=res.message)


@router.post(
    "/problems/{problem_id}/duplicates/{link_id}/dismiss",
    response_model=StandardApiResponse[dict],
    summary="Dismiss a duplicate candidate link as not a duplicate",
)
async def dismiss_duplicate_candidate(
    problem_id: uuid.UUID,
    link_id: uuid.UUID,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    from app.ai_engine.services.duplicate_service import DuplicateDetectionService
    service = DuplicateDetectionService(db)
    await service.dismiss_link(
        problem_id=problem_id,
        link_id=link_id,
        admin_user=current_admin,
    )
    return StandardApiResponse(
        success=True,
        data={"link_id": str(link_id), "status": "dismissed"},
        message="Duplicate candidate link successfully dismissed.",
    )


@router.get(
    "/ai/health",
    response_model=StandardApiResponse[AIHealthResponse],
    summary="Diagnostic health check for AI embedder and pgvector storage",
)
async def get_ai_and_embedding_health(
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    from app.ai_engine.services.duplicate_service import DuplicateDetectionService
    service = DuplicateDetectionService(db)
    health_info = await service.get_health()
    return StandardApiResponse(
        success=True,
        data=health_info,
        message="AI and vector embedding health retrieved.",
    )
