import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import get_db, require_approved_university
from app.core.security import get_password_hash
from app.models.audit_log import AuditLog
from app.models.enums import InvitationStatus, UserRole
from app.models.invitation import FacultyInvitation
from app.models.profiles import FacultyProfile, UniversityProfile
from app.models.user import User
from app.schemas.common import StandardApiResponse
from app.schemas.user import (
    FacultyCreate,
    FacultyInviteRequest,
    FacultyInvitationResponse,
    FacultyMemberResponse,
)
from app.tasks.email import send_faculty_invitation_email_task, send_welcome_email_task

router = APIRouter(prefix="/university", tags=["University Management"])


class FacultyStatusUpdate(BaseModel):
    is_active: bool | None = None


# 1. Invite Faculty Member (Secure token-based invitation)
@router.post("/faculty/invite", response_model=StandardApiResponse[FacultyInvitationResponse])
async def invite_faculty_member(
    data: FacultyInviteRequest,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    # Check if an active user with this email already exists
    existing_user = (await db.execute(select(User).where(User.email == data.email.lower()))).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "An active account with this email already exists."},
        )

    # Check for existing pending invitation for this university and email
    existing_invitation = (
        await db.execute(
            select(FacultyInvitation).where(
                and_(
                    FacultyInvitation.university_id == univ_prof.id,
                    FacultyInvitation.email == data.email.lower(),
                    FacultyInvitation.status == InvitationStatus.PENDING,
                )
            )
        )
    ).scalar_one_or_none()

    # Generate cryptographically secure 32-byte urlsafe token
    plain_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)

    if existing_invitation:
        # Check if already expired, refresh it
        existing_invitation.token_hash = token_hash
        existing_invitation.expires_at = expires_at
        existing_invitation.full_name = data.full_name
        existing_invitation.department = data.department
        existing_invitation.designation = data.designation
        existing_invitation.research_areas = data.research_areas or []
        invitation = existing_invitation
    else:
        invitation = FacultyInvitation(
            university_id=univ_prof.id,
            invited_by=current_univ_user.id,
            email=data.email.lower(),
            full_name=data.full_name,
            department=data.department,
            designation=data.designation,
            research_areas=data.research_areas or [],
            token_hash=token_hash,
            status=InvitationStatus.PENDING,
            expires_at=expires_at,
        )
        db.add(invitation)

    audit = AuditLog(
        actor_id=current_univ_user.id,
        action="INVITE_FACULTY_MEMBER",
        target_type="faculty_invitation",
        target_id=str(invitation.id),
        metadata_json={
            "faculty_email": invitation.email,
            "faculty_name": data.full_name,
            "university": univ_prof.university_name,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(invitation)

    # Dispatch invitation email via Celery
    invite_url = f"{settings.FRONTEND_URL}/invite/faculty?token={plain_token}"
    try:
        send_faculty_invitation_email_task.delay(
            invitation.email,
            data.full_name,
            univ_prof.university_name,
            data.department,
            data.designation,
            invite_url,
        )
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data=FacultyInvitationResponse(
            id=invitation.id,
            email=invitation.email,
            full_name=invitation.full_name,
            department=invitation.department,
            designation=invitation.designation,
            research_areas=invitation.research_areas or [],
            status=invitation.status.value,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
        ),
        message=f"Invitation sent successfully to {data.email}.",
    )


# 2. List Sent Invitations (University Isolation)
@router.get("/faculty/invitations", response_model=StandardApiResponse[list[FacultyInvitationResponse]])
async def list_faculty_invitations(
    status_filter: str | None = Query(None, alias="status"),
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        return StandardApiResponse(success=True, data=[])

    query = select(FacultyInvitation).where(FacultyInvitation.university_id == univ_prof.id)

    if status_filter:
        try:
            enum_val = InvitationStatus(status_filter.lower())
            query = query.where(FacultyInvitation.status == enum_val)
        except ValueError:
            pass

    query = query.order_by(FacultyInvitation.created_at.desc())
    result = await db.execute(query)
    invitations = result.scalars().all()

    now = datetime.now(UTC)
    items = []
    for inv in invitations:
        # Check if expired on the fly
        exp = inv.expires_at if inv.expires_at.tzinfo else inv.expires_at.replace(tzinfo=UTC)
        current_status = inv.status.value
        if inv.status == InvitationStatus.PENDING and now > exp:
            current_status = "expired"

        items.append(
            FacultyInvitationResponse(
                id=inv.id,
                email=inv.email,
                full_name=inv.full_name,
                department=inv.department,
                designation=inv.designation,
                research_areas=inv.research_areas or [],
                status=current_status,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
                accepted_at=inv.accepted_at,
            )
        )

    return StandardApiResponse(success=True, data=items)


# 3. Resend Faculty Invitation
@router.post("/faculty/invitations/{invitation_id}/resend", response_model=StandardApiResponse[FacultyInvitationResponse])
async def resend_faculty_invitation(
    invitation_id: uuid.UUID,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    # IDOR protection: Verify invitation belongs to caller's university
    query = select(FacultyInvitation).where(
        and_(
            FacultyInvitation.id == invitation_id,
            FacultyInvitation.university_id == univ_prof.id,
        )
    )
    invitation = (await db.execute(query)).scalar_one_or_none()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "INVITATION_NOT_FOUND", "message": "Invitation record not found in your institution."},
        )

    if invitation.status == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_ACCEPTED", "message": "This invitation has already been accepted."},
        )

    # Rate limiting: at most once every 2 minutes
    last_update = invitation.updated_at if invitation.updated_at.tzinfo else invitation.updated_at.replace(tzinfo=UTC)
    if datetime.now(UTC) - last_update < timedelta(minutes=2):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RESEND_RATE_LIMITED", "message": "Please wait at least 2 minutes before resending this invitation."},
        )

    plain_token = secrets.token_urlsafe(32)
    invitation.token_hash = hashlib.sha256(plain_token.encode("utf-8")).hexdigest()
    invitation.expires_at = datetime.now(UTC) + timedelta(days=7)
    invitation.status = InvitationStatus.PENDING

    audit = AuditLog(
        actor_id=current_univ_user.id,
        action="RESEND_FACULTY_INVITATION",
        target_type="faculty_invitation",
        target_id=str(invitation.id),
        metadata_json={"email": invitation.email},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(invitation)

    invite_url = f"{settings.FRONTEND_URL}/invite/faculty?token={plain_token}"
    try:
        send_faculty_invitation_email_task.delay(
            invitation.email,
            invitation.full_name,
            univ_prof.university_name,
            invitation.department,
            invitation.designation,
            invite_url,
        )
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data=FacultyInvitationResponse(
            id=invitation.id,
            email=invitation.email,
            full_name=invitation.full_name,
            department=invitation.department,
            designation=invitation.designation,
            research_areas=invitation.research_areas or [],
            status=invitation.status.value,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
        ),
        message=f"Fresh invitation dispatched to {invitation.email}.",
    )


# 4. Revoke Faculty Invitation
@router.delete("/faculty/invitations/{invitation_id}", response_model=StandardApiResponse[dict])
async def revoke_faculty_invitation(
    invitation_id: uuid.UUID,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    # IDOR protection
    query = select(FacultyInvitation).where(
        and_(
            FacultyInvitation.id == invitation_id,
            FacultyInvitation.university_id == univ_prof.id,
        )
    )
    invitation = (await db.execute(query)).scalar_one_or_none()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "INVITATION_NOT_FOUND", "message": "Invitation record not found in your institution."},
        )

    if invitation.status == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_ACCEPTED", "message": "Cannot revoke an invitation that has already been accepted."},
        )

    invitation.status = InvitationStatus.REVOKED
    audit = AuditLog(
        actor_id=current_univ_user.id,
        action="REVOKE_FACULTY_INVITATION",
        target_type="faculty_invitation",
        target_id=str(invitation.id),
        metadata_json={"email": invitation.email},
    )
    db.add(audit)
    await db.commit()

    return StandardApiResponse(success=True, message=f"Invitation for {invitation.email} revoked.")


# 5. List Faculty for this University (Filterable, Searchable, IDOR-isolated)
@router.get("/faculty", response_model=StandardApiResponse[list[FacultyMemberResponse]])
async def list_university_faculty(
    q: str | None = Query(None, description="Search by name, email, or department"),
    department: str | None = Query(None, description="Filter by department"),
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        return StandardApiResponse(success=True, data=[])

    query = (
        select(FacultyProfile)
        .options(selectinload(FacultyProfile.user))
        .where(FacultyProfile.university_id == univ_prof.id)
    )

    if department and department.strip():
        query = query.where(FacultyProfile.department.ilike(f"%{department.strip()}%"))

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.join(FacultyProfile.user).where(
            or_(
                FacultyProfile.full_name.ilike(term),
                FacultyProfile.department.ilike(term),
                FacultyProfile.designation.ilike(term),
                User.email.ilike(term),
            )
        )

    query = query.order_by(FacultyProfile.created_at.desc())
    result = await db.execute(query)
    members = result.scalars().all()

    data = [
        FacultyMemberResponse(
            id=m.id,
            user_id=m.user_id,
            email=m.user.email if m.user else "",
            full_name=m.full_name,
            department=m.department,
            designation=m.designation,
            research_areas=m.research_areas or [],
            is_active=m.user.is_active if m.user else True,
            created_at=m.created_at,
        )
        for m in members
    ]
    return StandardApiResponse(success=True, data=data)


# 6. Deactivate / Reactivate Faculty Member (IDOR-protected)
@router.patch("/faculty/{faculty_id}/status", response_model=StandardApiResponse[dict])
async def toggle_faculty_status(
    faculty_id: uuid.UUID,
    data: FacultyStatusUpdate | None = None,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    # IDOR protection: Verify faculty belongs to caller's university
    query = (
        select(FacultyProfile)
        .options(selectinload(FacultyProfile.user))
        .where(
            and_(
                FacultyProfile.id == faculty_id,
                FacultyProfile.university_id == univ_prof.id,
            )
        )
    )
    fac_prof = (await db.execute(query)).scalar_one_or_none()
    if not fac_prof or not fac_prof.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FACULTY_NOT_FOUND", "message": "Faculty member not found in your institution."},
        )

    target_user = fac_prof.user
    if data and data.is_active is not None:
        target_user.is_active = data.is_active
    else:
        target_user.is_active = not target_user.is_active

    action_label = "REACTIVATE_FACULTY" if target_user.is_active else "DEACTIVATE_FACULTY"
    audit = AuditLog(
        actor_id=current_univ_user.id,
        action=action_label,
        target_type="faculty",
        target_id=str(target_user.id),
        metadata_json={
            "faculty_name": fac_prof.full_name,
            "faculty_email": target_user.email,
            "is_active": target_user.is_active,
        },
    )
    db.add(audit)
    await db.commit()

    state_str = "activated" if target_user.is_active else "deactivated"
    return StandardApiResponse(
        success=True,
        data={"id": str(fac_prof.id), "user_id": str(target_user.id), "is_active": target_user.is_active},
        message=f"Faculty account for '{fac_prof.full_name}' has been {state_str}.",
    )


# 7. Direct Create Faculty Member (Legacy fallback with strong password hashing)
@router.post("/faculty", response_model=StandardApiResponse[dict])
async def create_faculty_member(
    data: FacultyCreate,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (
        await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))
    ).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "A faculty or user account with this email already exists."},
        )

    faculty_user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(faculty_user)
    await db.flush()

    faculty_profile = FacultyProfile(
        user_id=faculty_user.id,
        university_id=univ_prof.id,
        created_by=current_univ_user.id,
        full_name=data.full_name,
        department=data.department,
        designation=data.designation,
        research_areas=data.research_areas or [],
    )
    db.add(faculty_profile)

    audit = AuditLog(
        actor_id=current_univ_user.id,
        action="CREATE_FACULTY_MEMBER",
        target_type="faculty",
        target_id=str(faculty_user.id),
        metadata_json={
            "faculty_email": faculty_user.email,
            "faculty_name": data.full_name,
            "university": univ_prof.university_name,
        },
    )
    db.add(audit)
    await db.commit()

    try:
        send_welcome_email_task.delay(faculty_user.email, data.full_name, "faculty")
    except Exception:
        pass

    return StandardApiResponse(
        success=True,
        data={
            "user_id": str(faculty_user.id),
            "email": faculty_user.email,
            "full_name": data.full_name,
            "university": univ_prof.university_name,
            "role": "faculty",
        },
        message=f"Faculty account for '{data.full_name}' created successfully.",
    )
