import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.audit_log import AuditLog
from app.models.enums import RequestStatus, UserRole
from app.models.profiles import IndustryProfile, UniversityProfile
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User
from app.schemas.admin import (
    AuditLogResponse,
    RequestReviewAction,
    RestrictedRequestResponse,
)
from app.schemas.common import StandardApiResponse
from app.schemas.problem import ProblemModerationUpdate, ProblemResponse
from app.services.problem_service import ProblemService
from app.tasks.email import send_approval_email_task, send_rejection_email_task

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


# 1. List All Pending / Reviewed Requests
@router.get("/requests", response_model=StandardApiResponse[list[RestrictedRequestResponse]])
async def list_restricted_requests(
    status_filter: RequestStatus | None = None,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(RestrictedAccountRequest).order_by(RestrictedAccountRequest.created_at.desc())
    if status_filter:
        query = query.where(RestrictedAccountRequest.status == status_filter)

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
    return StandardApiResponse(success=True, data=items)


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

    # Dispatch Celery Approval Email
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

    send_rejection_email_task.delay(req.official_email, req.org_name, req.rejection_reason)

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


# 4. Problem Moderation
@router.patch("/problems/{problem_id}/moderate", response_model=ProblemResponse)
async def moderate_problem(
    problem_id: uuid.UUID,
    data: ProblemModerationUpdate,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    service = ProblemService(db)
    problem = await service.get_problem(problem_id)
    update_data = {"status": data.status}
    if data.is_verified is not None:
        update_data["is_verified"] = data.is_verified

    updated = await service.repo.update_problem(problem, update_data)

    # Audit Log
    audit = AuditLog(
        actor_id=current_admin.id,
        action="MODERATE_PROBLEM",
        target_type="problem",
        target_id=str(problem.id),
        metadata_json={"new_status": data.status.value, "is_verified": data.is_verified},
    )
    db.add(audit)
    await db.commit()

    return updated


# 5. View Audit Logs
@router.get("/audit-logs", response_model=StandardApiResponse[list[AuditLogResponse]])
async def list_audit_logs(
    limit: int = 50,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
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
    return StandardApiResponse(success=True, data=items)
