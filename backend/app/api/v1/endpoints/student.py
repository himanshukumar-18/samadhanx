import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.enums import UserRole
from app.models.profiles import StudentProfile
from app.models.user import User
from app.schemas.project import ProjectPickCreate, ProjectResponse
from app.services.project_service import ProjectService

router = APIRouter(prefix="/student", tags=["Student Workspace"])


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
    service = ProjectService(db)
    return await service.pick_project(lead_student=current_user, data=data)


@router.get("/people", response_model=list[dict])
async def list_student_innovators(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """Discover fellow student innovators across departments & colleges."""
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

    query = query.limit(limit)
    result = await db.execute(query)
    profiles = result.scalars().all()

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
            "email": p.user.email if p.user else None,
        })
    return items
