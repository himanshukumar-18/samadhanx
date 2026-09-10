import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_role
from app.models.audit_log import AuditLog
from app.models.enums import NotificationType, ProjectStatus, ReviewDecision, UserRole
from app.models.profiles import FacultyProfile
from app.models.project import SolutionProject
from app.models.project_review import ProjectReview
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.schemas.faculty import (
    FacultyDashboardResponse,
    FacultyProfileResponse,
    FacultyProfileUpdate,
    PodItem,
)
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/faculty", tags=["Faculty Mentorship"])


@router.get("/dashboard", response_model=FacultyDashboardResponse)
async def get_faculty_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.UNIVERSITY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Load faculty profile with university
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.faculty_profile).selectinload(FacultyProfile.university),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.faculty_profile if user_with_profile else None
    univ_name = profile.university.university_name if profile and profile.university else None
    univ_id = profile.university_id if profile else None

    # 2. Query directly supervised projects
    assigned_stmt = (
        select(SolutionProject)
        .options(
            selectinload(SolutionProject.problem),
            selectinload(SolutionProject.lead_student).selectinload(User.student_profile),
            selectinload(SolutionProject.university),
            selectinload(SolutionProject.members),
            selectinload(SolutionProject.reviews),
        )
        .where(SolutionProject.faculty_mentor_id == current_user.id)
        .order_by(SolutionProject.updated_at.desc())
    )
    assigned_res = await db.execute(assigned_stmt)
    assigned_projects = assigned_res.scalars().all()

    # 3. Query available campus / unassigned pods seeking faculty mentorship
    avail_stmt = (
        select(SolutionProject)
        .options(
            selectinload(SolutionProject.problem),
            selectinload(SolutionProject.lead_student).selectinload(User.student_profile),
            selectinload(SolutionProject.university),
            selectinload(SolutionProject.members),
            selectinload(SolutionProject.reviews),
        )
        .where(
            SolutionProject.faculty_mentor_id.is_(None),
            SolutionProject.status.not_in([ProjectStatus.COMPLETED, ProjectStatus.REJECTED]),
        )
    )
    if univ_id:
        avail_stmt = avail_stmt.where(
            or_(
                SolutionProject.university_id == univ_id,
                SolutionProject.university_id.is_(None),
            )
        )
    avail_stmt = avail_stmt.order_by(SolutionProject.created_at.desc()).limit(30)
    avail_res = await db.execute(avail_stmt)
    available_projects = avail_res.scalars().all()

    # 4. Query reviews submitted by this faculty
    rev_stmt = (
        select(ProjectReview)
        .options(selectinload(ProjectReview.project))
        .where(ProjectReview.reviewer_id == current_user.id)
        .order_by(ProjectReview.created_at.desc())
    )
    reviews_res = await db.execute(rev_stmt)
    faculty_reviews = reviews_res.scalars().all()

    approved_reviews_count = sum(1 for r in faculty_reviews if r.decision == ReviewDecision.APPROVED)
    pending_reviews_count = sum(1 for p in assigned_projects if p.status == ProjectStatus.REVIEW)

    def format_pod(p: SolutionProject, is_direct: bool) -> PodItem:
        lead_name = (
            p.lead_student.student_profile.full_name
            if p.lead_student and p.lead_student.student_profile
            else (p.lead_student.email if p.lead_student else "Student Lead")
        )
        lead_email = p.lead_student.email if p.lead_student else None
        p_univ_name = p.university.university_name if p.university else None
        return PodItem(
            id=str(p.id),
            title=p.title,
            team_name=p.team_name,
            description=p.description,
            status=p.status.value,
            problem_id=str(p.problem_id),
            problem_title=p.problem.title if p.problem else "Civic Problem",
            lead_name=lead_name,
            lead_email=lead_email,
            university_name=p_univ_name,
            is_direct_mentor=is_direct,
            member_count=len(p.members) if p.members else 1,
            updated_at=p.updated_at.isoformat(),
        )

    formatted_assigned = [format_pod(p, True) for p in assigned_projects]
    formatted_available = [format_pod(p, False) for p in available_projects]

    formatted_reviews = [
        {
            "id": str(r.id),
            "project_id": str(r.project_id),
            "project_title": r.project.title if r.project else "Project",
            "decision": r.decision.value,
            "feedback_text": r.feedback_text,
            "created_at": r.created_at.isoformat(),
        }
        for r in faculty_reviews[:15]
    ]

    return FacultyDashboardResponse(
        faculty_name=profile.full_name if profile else (current_user.email.split("@")[0]),
        designation=profile.designation if profile else "Faculty Mentor",
        department=profile.department if profile else None,
        university_name=univ_name,
        research_areas=profile.research_areas or [] if profile else [],
        assigned_projects_count=len(assigned_projects),
        available_pods_count=len(available_projects),
        pending_reviews_count=pending_reviews_count,
        approved_reviews_count=approved_reviews_count,
        assigned_projects=formatted_assigned,
        available_projects=formatted_available,
        recent_reviews=formatted_reviews,
    )


@router.post("/projects/{project_id}/adopt", response_model=dict)
async def adopt_project_for_mentorship(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Adopt a student solution pod for academic mentorship.
    Sets faculty_mentor_id to current_user.id, links university if empty,
    and alerts the student lead.
    """
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.faculty_profile).selectinload(FacultyProfile.university),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.faculty_profile if user_with_profile else None

    project = (
        await db.execute(
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.lead_student).selectinload(User.student_profile),
                selectinload(SolutionProject.university),
            )
            .where(SolutionProject.id == project_id)
        )
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": "Solution pod not found."},
        )

    if project.faculty_mentor_id == current_user.id:
        return {
            "status": "already_mentoring",
            "message": "You are already mentoring this solution pod.",
            "project_id": str(project.id),
        }

    if project.faculty_mentor_id is not None and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALREADY_MENTORED",
                "message": "This pod is already mentored by another faculty member.",
            },
        )

    # University affiliation validation
    if profile and profile.university_id:
        if project.university_id and project.university_id != profile.university_id and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "UNIVERSITY_MISMATCH",
                    "message": "This solution pod belongs to a different university.",
                },
            )
        if not project.university_id:
            project.university_id = profile.university_id

    project.faculty_mentor_id = current_user.id

    # Notify student lead
    faculty_display_name = profile.full_name if profile else "A Faculty Mentor"
    univ_display_name = profile.university.university_name if profile and profile.university else "your campus"
    notif_repo = NotificationRepository(db)
    await notif_repo.create_notification(
        recipient_id=project.lead_student_id,
        title="Academic Mentor Assigned! 🎓",
        message=f"{faculty_display_name} ({univ_display_name}) has adopted your pod \"{project.title}\" for academic mentorship.",
        type=NotificationType.PROJECT_ASSIGNED,
        link=f"/projects/{project.id}",
    )

    # Audit log
    audit = AuditLog(
        actor_id=current_user.id,
        action="FACULTY_ADOPT_POD",
        target_type="solution_project",
        target_id=str(project.id),
        metadata_json={
            "faculty_name": faculty_display_name,
            "project_title": project.title,
            "team_name": project.team_name,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(project)

    return {
        "status": "success",
        "message": f"Successfully adopted pod \"{project.title}\" for academic mentorship.",
        "project_id": str(project.id),
        "faculty_mentor_id": str(current_user.id),
    }


@router.delete("/projects/{project_id}/relinquish", response_model=dict)
async def relinquish_project_mentorship(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Relinquish mentorship of a solution pod."""
    project = (
        await db.execute(
            select(SolutionProject).where(SolutionProject.id == project_id)
        )
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": "Solution pod not found."},
        )

    if project.faculty_mentor_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_MENTOR", "message": "You are not the assigned mentor for this pod."},
        )

    project.faculty_mentor_id = None

    notif_repo = NotificationRepository(db)
    await notif_repo.create_notification(
        recipient_id=project.lead_student_id,
        title="Faculty Mentor Update",
        message=f"Mentorship for pod \"{project.title}\" is now open for campus faculty re-assignment.",
        type=NotificationType.SYSTEM_ALERT,
        link=f"/projects/{project.id}",
    )

    audit = AuditLog(
        actor_id=current_user.id,
        action="FACULTY_RELINQUISH_POD",
        target_type="solution_project",
        target_id=str(project.id),
        metadata_json={"project_title": project.title},
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "message": "Mentorship relinquished successfully."}


@router.get("/profile", response_model=FacultyProfileResponse)
async def get_faculty_profile(
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get authenticated faculty mentor academic profile."""
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.faculty_profile).selectinload(FacultyProfile.university),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.faculty_profile if user_with_profile else None
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROFILE_NOT_FOUND", "message": "Faculty profile not found."},
        )

    # Supervised pods count
    proj_res = await db.execute(
        select(SolutionProject).where(SolutionProject.faculty_mentor_id == current_user.id)
    )
    supervised_count = len(proj_res.scalars().all())

    # Approved reviews count
    rev_res = await db.execute(
        select(ProjectReview).where(
            ProjectReview.reviewer_id == current_user.id,
            ProjectReview.decision == ReviewDecision.APPROVED,
        )
    )
    approved_count = len(rev_res.scalars().all())

    univ = profile.university
    return FacultyProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        email=current_user.email,
        full_name=profile.full_name,
        department=profile.department,
        designation=profile.designation,
        research_areas=profile.research_areas or [],
        university_name=univ.university_name if univ else None,
        university_state=univ.state if univ else None,
        university_district=univ.district if univ else None,
        aishe_code=univ.aishe_code if univ else None,
        supervised_pods_count=supervised_count,
        approved_reviews_count=approved_count,
    )


@router.patch("/profile", response_model=FacultyProfileResponse)
async def update_faculty_profile(
    data: FacultyProfileUpdate,
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update faculty academic profile (department, designation, research areas)."""
    user_with_profile = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.faculty_profile).selectinload(FacultyProfile.university),
            )
            .where(User.id == current_user.id)
        )
    ).scalar_one_or_none()

    profile = user_with_profile.faculty_profile if user_with_profile else None
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROFILE_NOT_FOUND", "message": "Faculty profile not found."},
        )

    if data.full_name is not None:
        profile.full_name = data.full_name.strip()
    if data.department is not None:
        profile.department = data.department.strip()
    if data.designation is not None:
        profile.designation = data.designation.strip()
    if data.research_areas is not None:
        profile.research_areas = [a.strip() for a in data.research_areas if a.strip()]

    audit = AuditLog(
        actor_id=current_user.id,
        action="UPDATE_FACULTY_PROFILE",
        target_type="faculty_profile",
        target_id=str(profile.id),
        metadata_json={
            "department": profile.department,
            "designation": profile.designation,
            "research_areas": profile.research_areas,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(profile)

    return await get_faculty_profile(current_user, db)


@router.post("/projects/{project_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def submit_project_review(
    project_id: uuid.UUID,
    data: ReviewCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.UNIVERSITY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    review_service = ReviewService(db)
    return await review_service.create_review(faculty_user=current_user, project_id=project_id, data=data)


@router.get("/projects/{project_id}/reviews", response_model=list[ReviewResponse])
async def list_project_reviews(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    review_service = ReviewService(db)
    return await review_service.list_reviews(project_id)
