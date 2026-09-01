from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_approved_university
from app.core.security import get_password_hash
from app.models.audit_log import AuditLog
from app.models.enums import UserRole
from app.models.profiles import FacultyProfile, UniversityProfile
from app.models.user import User
from app.schemas.common import StandardApiResponse
from app.schemas.user import FacultyCreate
from app.tasks.email import send_welcome_email_task

router = APIRouter(prefix="/university", tags=["University Management"])

# 1. Create Faculty (Only approved University accounts can invoke)
@router.post("/faculty", response_model=StandardApiResponse[dict])
async def create_faculty_member(
    data: FacultyCreate,
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))).scalar_one_or_none()
    if not univ_prof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROFILE_NOT_FOUND", "message": "University profile record is missing."},
        )

    # Check existing email
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "A faculty or user account with this email already exists."},
        )

    # Create Faculty User
    faculty_user = User(
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        role=UserRole.FACULTY,
        is_verified=True, # University-verified by creation authority
        is_active=True,
        is_approved=True,
    )
    db.add(faculty_user)
    await db.flush()

    # Create Faculty Profile linked to University
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

    # Dispatch welcome email with onboarding info
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

# 2. List Faculty for this University
@router.get("/faculty", response_model=StandardApiResponse[list[dict]])
async def list_university_faculty(
    current_univ_user: User = Depends(require_approved_university),
    db: AsyncSession = Depends(get_db),
):
    univ_prof = (await db.execute(select(UniversityProfile).where(UniversityProfile.user_id == current_univ_user.id))).scalar_one_or_none()
    if not univ_prof:
        return StandardApiResponse(success=True, data=[])

    query = (
        select(FacultyProfile)
        .options(selectinload(FacultyProfile.user))
        .where(FacultyProfile.university_id == univ_prof.id)
        .order_by(FacultyProfile.created_at.desc())
    )
    result = await db.execute(query)
    members = result.scalars().all()

    data = [
        {
            "id": str(m.id),
            "user_id": str(m.user_id),
            "email": m.user.email if m.user else "",
            "full_name": m.full_name,
            "department": m.department,
            "designation": m.designation,
            "research_areas": m.research_areas or [],
            "created_at": m.created_at.isoformat(),
        }
        for m in members
    ]
    return StandardApiResponse(success=True, data=data)
