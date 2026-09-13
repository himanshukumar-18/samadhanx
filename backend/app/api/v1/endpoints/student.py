import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.audit_log import AuditLog
from app.models.enums import NotificationType, ProjectStatus, RequestStatus, UserRole
from app.models.impact_report import ImpactReport
from app.models.industry_support import IndustrySupport
from app.models.notification import Notification
from app.models.profiles import StudentProfile
from app.models.project import ProjectMember, SolutionProject
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.profile_repository import ProfileRepository
from app.schemas.industry import IndustrySupportResponse
from app.schemas.project import ProjectPickCreate, ProjectResponse
from app.schemas.student import (
    ImpactReportCreate,
    ImpactReportResponse,
    StudentProfileResponse,
    StudentProfileUpdate,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/student", tags=["Student Workspace"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_pod_with_membership_check(
    pod_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    require_lead: bool = False,
) -> SolutionProject:
    """
    Load a pod and enforce pod-membership BOLA.
    Raises 404 if pod not found, 403 if user is not a member (or not lead if required).
    """
    project = (
        await db.execute(
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.members),
                selectinload(SolutionProject.supports).selectinload(IndustrySupport.industry_user),
                selectinload(SolutionProject.impact_report)
                .selectinload(ImpactReport.submitter),
            )
            .where(SolutionProject.id == pod_id)
        )
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": "Pod not found."},
        )

    is_lead = project.lead_student_id == current_user.id
    is_member = any(m.user_id == current_user.id for m in project.members)
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_lead or is_member or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "POD_ACCESS_DENIED", "message": "You are not a member of this pod."},
        )

    if require_lead and not is_lead and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_POD_LEAD", "message": "Only the pod lead can perform this action."},
        )

    return project


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=dict)
async def get_student_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    my_projects = await service.list_my_projects(current_user)

    university_name = "Affiliated Institution"
    if current_user.student_profile:
        if getattr(current_user.student_profile, "university", None) and current_user.student_profile.university:
            university_name = current_user.student_profile.university.university_name
        elif getattr(current_user.student_profile, "institution_master", None) and current_user.student_profile.institution_master:
            university_name = current_user.student_profile.institution_master.name

    return {
        "user_name": current_user.student_profile.full_name if current_user.student_profile else current_user.email,
        "university_name": university_name,
        "active_projects_count": len(my_projects),
        "department": current_user.student_profile.department if current_user.student_profile else None,
        "skills": current_user.student_profile.skills if current_user.student_profile else [],
    }


# ---------------------------------------------------------------------------
# My Pods
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=list[ProjectResponse])
async def list_student_projects(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.list_my_projects(current_user)


@router.post("/pick-project", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def pick_project(
    data: ProjectPickCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new solution pod.
    Security: faculty_mentor_id is NOT accepted from student input — it can only be
    set by a Faculty member through the adopt endpoint.
    """
    service = ProjectService(db)
    return await service.pick_project(lead_student=current_user, data=data)


# ---------------------------------------------------------------------------
# Discover People (Find Teammates)
# ---------------------------------------------------------------------------

@router.get("/people", response_model=list[dict])
async def list_student_innovators(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, max_length=100),
    skill: str | None = Query(None, max_length=100, description="Filter by a single skill tag (case-insensitive)"),
    department: str | None = Query(None, max_length=150, description="Filter by department name"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """Discover fellow student innovators. Email is NOT returned to protect privacy."""
    query = (
        select(StudentProfile)
        .options(
            selectinload(StudentProfile.university),
            selectinload(StudentProfile.institution_master),
            selectinload(StudentProfile.user),
        )
    )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            (StudentProfile.full_name.ilike(pattern)) | (StudentProfile.department.ilike(pattern))
        )

    if department:
        query = query.where(StudentProfile.department.ilike(f"%{department.strip()}%"))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    profiles = result.scalars().all()

    # Apply skill filter in Python (JSON column — compatible with both Postgres & SQLite)
    if skill:
        skill_lower = skill.strip().lower()
        profiles = [p for p in profiles if p.skills and any(s.lower() == skill_lower for s in p.skills)]

    items = []
    for p in profiles:
        institution = "Affiliated Institution"
        if p.university and p.university.university_name:
            institution = p.university.university_name
        elif p.institution_master and p.institution_master.name:
            institution = p.institution_master.name

        items.append({
            "id": str(p.user_id),
            "full_name": p.full_name,
            "department": p.department,
            "graduation_year": p.graduation_year,
            "institution_name": institution,
            "skills": p.skills or [],
            # NOTE: email intentionally omitted — privacy protection
        })
    return items


# ---------------------------------------------------------------------------
# Funding Offers (student read + respond)
# ---------------------------------------------------------------------------

@router.get("/pods/{pod_id}/funding-offers", response_model=list[IndustrySupportResponse])
async def list_pod_funding_offers(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List all industry funding/support offers for a specific pod.
    Requires caller to be a pod member or lead.
    """
    await _get_pod_with_membership_check(pod_id, current_user, db)

    offers = (
        await db.execute(
            select(IndustrySupport)
            .options(selectinload(IndustrySupport.project))
            .where(IndustrySupport.project_id == pod_id)
            .order_by(IndustrySupport.created_at.desc())
        )
    ).scalars().all()

    return offers


@router.patch("/funding-offers/{offer_id}/respond", response_model=IndustrySupportResponse)
async def respond_to_funding_offer(
    offer_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
    decision: str = Query(..., description="'accepted' or 'declined'"),
):
    """
    Accept or decline a funding offer. Only the pod lead can respond.
    Row-level check: verifies user is lead of the pod this offer belongs to.
    """
    if decision not in ("accepted", "declined"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_DECISION", "message": "Decision must be 'accepted' or 'declined'."},
        )

    offer = (
        await db.execute(
            select(IndustrySupport)
            .options(selectinload(IndustrySupport.project), selectinload(IndustrySupport.industry_user))
            .where(IndustrySupport.id == offer_id)
        )
    ).scalar_one_or_none()

    if not offer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FUNDING_OFFER_NOT_FOUND", "message": "Funding offer not found."},
        )

    if offer.status not in (RequestStatus.PENDING,):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "OFFER_ALREADY_RESPONDED", "message": "This offer has already been responded to."},
        )

    # Row-level: only pod lead (or admin) can respond
    await _get_pod_with_membership_check(offer.project_id, current_user, db, require_lead=True)

    old_status = offer.status
    offer.status = RequestStatus.APPROVED if decision == "accepted" else RequestStatus.REJECTED
    await db.flush()

    # Notify the industry partner
    notif_repo = NotificationRepository(db)
    if offer.industry_user_id:
        decision_label = "✅ Accepted" if decision == "accepted" else "❌ Declined"
        try:
            async with db.begin_nested():
                await notif_repo.create_notification(
                    recipient_id=offer.industry_user_id,
                    title=f"Funding Offer {decision_label}",
                    message=(
                        f'Your support offer for pod "{offer.project.title if offer.project else str(offer.project_id)}" '
                        f"has been {decision} by the pod lead."
                    ),
                    type=NotificationType.FUNDING_OFFER_RESPONSE,
                    link=f"/projects/{offer.project_id}",
                )
        except Exception:
            pass

    # Audit log
    try:
        async with db.begin_nested():
            db.add(AuditLog(
                actor_id=current_user.id,
                action="FUNDING_OFFER_RESPONDED",
                target_type="industry_support",
                target_id=str(offer_id),
                metadata_json={"decision": decision, "old_status": old_status.value},
            ))
    except Exception:
        pass

    await db.commit()
    await db.refresh(offer)
    return offer


# ---------------------------------------------------------------------------
# Impact Report
# ---------------------------------------------------------------------------

@router.post(
    "/pods/{pod_id}/impact-report",
    response_model=ImpactReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_impact_report(
    pod_id: uuid.UUID,
    data: ImpactReportCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Submit an impact report for a completed pod.
    - Only the pod lead (or admin) can submit.
    - Pod must be in 'completed' status.
    - Only one report allowed per pod (use PATCH /pods/{id}/impact-report to update).
    """
    pod = await _get_pod_with_membership_check(pod_id, current_user, db, require_lead=True)

    if pod.status != ProjectStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "POD_NOT_COMPLETED",
                "message": f"Impact reports can only be submitted for completed pods. Current status: {pod.status.value}.",
            },
        )

    if pod.impact_report is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "IMPACT_REPORT_ALREADY_EXISTS",
                "message": "An impact report already exists for this pod. Use PATCH to update it.",
            },
        )

    report = ImpactReport(
        pod_id=pod_id,
        submitted_by=current_user.id,
        beneficiaries_reached=data.beneficiaries_reached,
        outcome_description=data.outcome_description,
        proof_image_urls=data.proof_image_urls or [],
        is_verified=False,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    # Notify faculty mentor and admin
    notif_repo = NotificationRepository(db)
    notify_targets = []
    if pod.faculty_mentor_id:
        notify_targets.append(pod.faculty_mentor_id)

    submitter_name = current_user.full_name or current_user.email.split("@")[0]
    for recipient_id in notify_targets:
        try:
            async with db.begin_nested():
                await notif_repo.create_notification(
                    recipient_id=recipient_id,
                    title="Impact Report Submitted 🌟",
                    message=(
                        f'{submitter_name} submitted an impact report for pod "{pod.title}". '
                        f"Beneficiaries: {data.beneficiaries_reached or 'N/A'}."
                    ),
                    type=NotificationType.IMPACT_REPORT_SUBMITTED,
                    link=f"/projects/{pod_id}",
                )
        except Exception:
            pass

    # Audit log
    try:
        async with db.begin_nested():
            db.add(AuditLog(
                actor_id=current_user.id,
                action="IMPACT_REPORT_SUBMITTED",
                target_type="impact_report",
                target_id=str(report.id),
                metadata_json={
                    "pod_id": str(pod_id),
                    "pod_title": pod.title,
                    "beneficiaries_reached": data.beneficiaries_reached,
                },
            ))
    except Exception:
        pass

    await db.commit()

    # Re-fetch with submitter loaded
    report = (
        await db.execute(
            select(ImpactReport)
            .options(selectinload(ImpactReport.submitter), selectinload(ImpactReport.verifier))
            .where(ImpactReport.id == report.id)
        )
    ).scalar_one()

    return ImpactReportResponse(
        id=report.id,
        pod_id=report.pod_id,
        submitted_by=report.submitted_by,
        submitter_name=report.submitter_name,
        beneficiaries_reached=report.beneficiaries_reached,
        outcome_description=report.outcome_description,
        proof_image_urls=report.proof_image_urls or [],
        is_verified=report.is_verified,
        verified_by=report.verified_by,
        verifier_name=report.verifier_name,
        created_at=report.created_at.isoformat() if report.created_at else None,
        updated_at=report.updated_at.isoformat() if report.updated_at else None,
    )


@router.patch("/pods/{pod_id}/impact-report", response_model=ImpactReportResponse)
async def update_impact_report(
    pod_id: uuid.UUID,
    data: ImpactReportCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an existing impact report. Only the original submitter (or admin) can update."""
    pod = await _get_pod_with_membership_check(pod_id, current_user, db, require_lead=True)

    if pod.impact_report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "IMPACT_REPORT_NOT_FOUND", "message": "No impact report exists for this pod yet."},
        )

    report = pod.impact_report
    if data.beneficiaries_reached is not None:
        report.beneficiaries_reached = data.beneficiaries_reached
    report.outcome_description = data.outcome_description
    if data.proof_image_urls is not None:
        report.proof_image_urls = data.proof_image_urls

    await db.commit()

    report = (
        await db.execute(
            select(ImpactReport)
            .options(selectinload(ImpactReport.submitter), selectinload(ImpactReport.verifier))
            .where(ImpactReport.id == report.id)
        )
    ).scalar_one()

    return ImpactReportResponse(
        id=report.id,
        pod_id=report.pod_id,
        submitted_by=report.submitted_by,
        submitter_name=report.submitter_name,
        beneficiaries_reached=report.beneficiaries_reached,
        outcome_description=report.outcome_description,
        proof_image_urls=report.proof_image_urls or [],
        is_verified=report.is_verified,
        verified_by=report.verified_by,
        verifier_name=report.verifier_name,
        created_at=report.created_at.isoformat() if report.created_at else None,
        updated_at=report.updated_at.isoformat() if report.updated_at else None,
    )


@router.get("/pods/{pod_id}/impact-report", response_model=ImpactReportResponse)
async def get_impact_report(
    pod_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get the impact report for a pod.
    Accessible by: pod members, faculty mentor, admin, citizen (public-ish — they must be authenticated).
    """
    # Fetch report directly without membership check for broader read access
    report = (
        await db.execute(
            select(ImpactReport)
            .options(selectinload(ImpactReport.submitter), selectinload(ImpactReport.verifier))
            .where(ImpactReport.pod_id == pod_id)
        )
    ).scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "IMPACT_REPORT_NOT_FOUND", "message": "No impact report found for this pod."},
        )

    return ImpactReportResponse(
        id=report.id,
        pod_id=report.pod_id,
        submitted_by=report.submitted_by,
        submitter_name=report.submitter_name,
        beneficiaries_reached=report.beneficiaries_reached,
        outcome_description=report.outcome_description,
        proof_image_urls=report.proof_image_urls or [],
        is_verified=report.is_verified,
        verified_by=report.verified_by,
        verifier_name=report.verifier_name,
        created_at=report.created_at.isoformat() if report.created_at else None,
        updated_at=report.updated_at.isoformat() if report.updated_at else None,
    )


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=StudentProfileResponse)
async def get_student_profile(
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get authenticated student innovator profile with academic and pod stats."""
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.student_profile).selectinload(StudentProfile.university),
                selectinload(User.student_profile).selectinload(StudentProfile.institution_master),
                selectinload(User.profile_detail),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.student_profile if user_with_profile else None
    if not profile:
        profile = StudentProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or current_user.email.split("@")[0],
            department="General Engineering",
            skills=[],
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    # Calculate pod stats for this student (lead or member)
    pod_query = (
        select(SolutionProject)
        .outerjoin(ProjectMember, ProjectMember.project_id == SolutionProject.id)
        .where(
            (SolutionProject.lead_student_id == current_user.id)
            | (ProjectMember.user_id == current_user.id)
        )
        .distinct()
    )
    res = await db.execute(pod_query)
    user_pods = res.scalars().all()

    active_count = sum(
        1 for p in user_pods if p.status in [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS, ProjectStatus.PROTOTYPE]
    )
    in_review_count = sum(
        1 for p in user_pods if p.status in [ProjectStatus.REVIEW, ProjectStatus.PILOT]
    )
    completed_count = sum(1 for p in user_pods if p.status == ProjectStatus.COMPLETED)
    total_count = len(user_pods)

    univ_name = None
    univ_state = None
    univ_district = None
    aishe_code = None

    if profile.university:
        univ_name = profile.university.university_name
        univ_state = profile.university.state
        univ_district = profile.university.district
        aishe_code = profile.university.aishe_code
    elif profile.institution_master:
        univ_name = profile.institution_master.name
        univ_state = profile.institution_master.state
        univ_district = profile.institution_master.district
        aishe_code = profile.institution_master.aishe_code

    detail = user_with_profile.profile_detail if user_with_profile else None
    avatar_url = detail.avatar_url if detail else None
    skills = profile.skills or (detail.skills if detail else []) or []

    return StudentProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        email=current_user.email,
        full_name=profile.full_name,
        headline=profile.headline or (detail.headline if detail else None),
        bio=profile.bio or (detail.bio if detail else None),
        department=profile.department,
        graduation_year=profile.graduation_year,
        enrollment_number=profile.enrollment_number,
        university_name=univ_name,
        university_state=univ_state,
        university_district=univ_district,
        aishe_code=aishe_code,
        skills=skills,
        github_url=profile.github_url or (detail.github_url if detail else None),
        linkedin_url=profile.linkedin_url or (detail.linkedin_url if detail else None),
        portfolio_url=profile.portfolio_url or (detail.website if detail else None),
        avatar_url=avatar_url,
        active_pods_count=active_count,
        in_review_pods_count=in_review_count,
        completed_pods_count=completed_count,
        total_pods_count=total_count,
        created_at=profile.created_at.isoformat() if profile.created_at else None,
    )


@router.patch("/profile", response_model=StudentProfileResponse)
async def update_student_profile(
    data: StudentProfileUpdate,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update student profile attributes, skills, and links."""
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.student_profile).selectinload(StudentProfile.university),
                selectinload(User.student_profile).selectinload(StudentProfile.institution_master),
                selectinload(User.profile_detail),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.student_profile if user_with_profile else None
    if not profile:
        profile = StudentProfile(
            user_id=current_user.id,
            full_name=data.full_name or current_user.full_name or current_user.email.split("@")[0],
            department=data.department or "General Engineering",
            skills=[],
        )
        db.add(profile)
        await db.flush()

    repo = ProfileRepository(db)
    detail = await repo.get_or_create_detail(current_user.id)

    updated_fields = []

    if data.full_name is not None:
        name = data.full_name.strip()
        if len(name) >= 2:
            profile.full_name = name
            updated_fields.append("full_name")

    if data.headline is not None:
        val = data.headline.strip() or None
        profile.headline = val
        detail.headline = val
        updated_fields.append("headline")

    if data.bio is not None:
        val = data.bio.strip() or None
        profile.bio = val
        detail.bio = val
        updated_fields.append("bio")

    if data.department is not None:
        profile.department = data.department.strip()
        updated_fields.append("department")

    if data.graduation_year is not None:
        profile.graduation_year = data.graduation_year
        updated_fields.append("graduation_year")

    if data.enrollment_number is not None:
        profile.enrollment_number = data.enrollment_number.strip() or None
        updated_fields.append("enrollment_number")

    if data.skills is not None:
        clean_skills = [s.strip() for s in data.skills if s.strip()][:30]
        profile.skills = clean_skills
        detail.skills = clean_skills
        updated_fields.append("skills")

    if data.github_url is not None:
        val = data.github_url.strip() or None
        profile.github_url = val
        detail.github_url = val
        updated_fields.append("github_url")

    if data.linkedin_url is not None:
        val = data.linkedin_url.strip() or None
        profile.linkedin_url = val
        detail.linkedin_url = val
        updated_fields.append("linkedin_url")

    if data.portfolio_url is not None:
        val = data.portfolio_url.strip() or None
        profile.portfolio_url = val
        detail.website = val
        updated_fields.append("portfolio_url")

    audit = AuditLog(
        actor_id=current_user.id,
        action="STUDENT_PROFILE_UPDATED",
        target_type="student_profile",
        target_id=str(profile.id),
        metadata_json={"updated_fields": updated_fields},
    )
    db.add(audit)
    await db.commit()

    return await get_student_profile(current_user=current_user, db=db)
