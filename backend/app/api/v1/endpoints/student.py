from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import UserRole
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
    my_projects = await service.list_projects(lead_student_id=current_user.id)

    university_name = (
        current_user.student_profile.university.university_name
        if current_user.student_profile and current_user.student_profile.university
        else "Affiliated University"
    )

    return {
        "user_name": current_user.student_profile.full_name if current_user.student_profile else current_user.email,
        "university_name": university_name,
        "active_projects_count": len(my_projects),
        "department": current_user.student_profile.department if current_user.student_profile else None,
        "skills": current_user.student_profile.skills if current_user.student_profile else [],
    }


@router.post("/pick-project", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def pick_project(
    data: ProjectPickCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.pick_project(lead_student=current_user, data=data)
