import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.project_service import ProjectService
from app.services.review_service import ReviewService

router = APIRouter(prefix="/faculty", tags=["Faculty Mentorship"])


@router.get("/dashboard", response_model=dict)
async def get_faculty_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.FACULTY, UserRole.UNIVERSITY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project_service = ProjectService(db)
    assigned_projects = await project_service.list_projects(faculty_mentor_id=current_user.id)

    return {
        "faculty_name": current_user.faculty_profile.full_name if current_user.faculty_profile else current_user.email,
        "designation": current_user.faculty_profile.designation if current_user.faculty_profile else "Faculty Mentor",
        "department": current_user.faculty_profile.department if current_user.faculty_profile else None,
        "assigned_projects_count": len(assigned_projects),
    }


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
