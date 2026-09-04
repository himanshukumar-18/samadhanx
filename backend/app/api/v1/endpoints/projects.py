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
    ProjectUpdateCreate,
    ProjectUpdateResponse,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Solution Projects"])


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
    service = ProjectService(db)
    return await service.list_projects(
        problem_id=problem_id,
        lead_student_id=lead_student_id,
        status_filter=status,
        university_id=university_id,
        offset=offset,
        limit=limit,
    )


@router.get("/my", response_model=list[ProjectResponse])
async def list_my_projects(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.list_my_projects(current_user)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_detail(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.get_project(project_id)


@router.post("/{project_id}/updates", response_model=ProjectUpdateResponse, status_code=status.HTTP_201_CREATED)
async def add_project_update(
    project_id: uuid.UUID,
    data: ProjectUpdateCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.add_project_update(user=current_user, project_id=project_id, data=data)


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: uuid.UUID,
    data: ProjectMemberAdd,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProjectService(db)
    return await service.add_member(
        user=current_user, project_id=project_id, new_user_id=data.user_id, role_in_team=data.role_in_team
    )
