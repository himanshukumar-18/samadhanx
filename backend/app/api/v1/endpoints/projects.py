import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.enums import ProjectStatus
from app.models.user import User
from app.schemas.project import (
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectReviewResponse,
    ProjectUpdateCreate,
    ProjectUpdateResponse,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Solution Projects / Problem Pods"])


# ---------------------------------------------------------------------------
# Public listing — anyone can browse pods (read-only, no sensitive data)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    problem_id: uuid.UUID | None = Query(None),
    lead_student_id: uuid.UUID | None = Query(None),
    status: ProjectStatus | None = Query(None),
    university_id: uuid.UUID | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """Browse all solution pods (public — limited detail, no reviews exposed here)."""
    service = ProjectService(db)
    return await service.list_projects(
        problem_id=problem_id,
        lead_student_id=lead_student_id,
        status_filter=status,
        university_id=university_id,
        offset=offset,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Authenticated: My pods
# ---------------------------------------------------------------------------

@router.get("/my", response_model=list[ProjectResponse])
async def list_my_projects(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return all pods where the authenticated user is lead or member."""
    service = ProjectService(db)
    return await service.list_my_projects(current_user)


# ---------------------------------------------------------------------------
# Authenticated: Pod detail — BOLA protected
# ---------------------------------------------------------------------------

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_detail(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get full pod detail including members, updates, reviews.

    BOLA: caller must be pod lead, member, faculty mentor, or admin.
    Returns 403 otherwise.
    """
    service = ProjectService(db)
    return await service.get_project(project_id, viewer=current_user)


# ---------------------------------------------------------------------------
# Authenticated: Submit pod for faculty review
# ---------------------------------------------------------------------------

@router.post("/{project_id}/submit", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
async def submit_pod_for_review(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Submit a pod for faculty review.

    Only the pod lead may trigger this.
    Valid from: planning, in_progress, prototype → review.
    Returns 409 on invalid transition.
    """
    service = ProjectService(db)
    return await service.submit_for_review(user=current_user, project_id=project_id)


# ---------------------------------------------------------------------------
# Authenticated: Milestone update
# ---------------------------------------------------------------------------

@router.post("/{project_id}/updates", response_model=ProjectUpdateResponse, status_code=status.HTTP_201_CREATED)
async def add_project_update(
    project_id: uuid.UUID,
    data: ProjectUpdateCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Post a milestone / engineering log update. Caller must be pod member or lead."""
    service = ProjectService(db)
    return await service.add_project_update(user=current_user, project_id=project_id, data=data)


# ---------------------------------------------------------------------------
# Authenticated: Add team member
# ---------------------------------------------------------------------------

@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: uuid.UUID,
    data: ProjectMemberAdd,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a student to this pod's team. Only the pod lead may do this."""
    service = ProjectService(db)
    return await service.add_member(
        user=current_user, project_id=project_id, new_user_id=data.user_id, role_in_team=data.role_in_team
    )


# ---------------------------------------------------------------------------
# Authenticated: Faculty reviews for this pod
# ---------------------------------------------------------------------------

@router.get("/{project_id}/reviews", response_model=list[ProjectReviewResponse])
async def list_pod_reviews(
    project_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return all faculty review decisions for this pod. Caller must be member or lead."""
    service = ProjectService(db)
    return await service.list_reviews(user=current_user, project_id=project_id)
