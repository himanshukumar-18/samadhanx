from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.problem import ProblemCreate, ProblemResponse
from app.services.problem_service import ProblemService

router = APIRouter(prefix="/citizen", tags=["Citizen"])


@router.get("/dashboard", response_model=dict)
async def get_citizen_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    my_problems = await service.list_problems(created_by_id=current_user.id, limit=50)

    solved_count = sum(1 for p in my_problems if p.status == "solved")
    active_teams_count = sum(len(p.projects) for p in my_problems)
    pending_review_count = sum(1 for p in my_problems if p.status in ["submitted", "under_review"])

    return {
        "user_name": current_user.citizen_profile.full_name if current_user.citizen_profile else current_user.email,
        "solved_problems_count": solved_count,
        "active_teams_count": active_teams_count,
        "pending_review_count": pending_review_count,
        "total_submitted_count": len(my_problems),
    }


@router.post("/problems", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED)
async def submit_problem(
    data: ProblemCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    problem = await service.create_problem(user=current_user, data=data)
    return problem


@router.get("/problems/my", response_model=list[ProblemResponse])
async def get_my_problems(
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    service = ProblemService(db)
    return await service.list_problems(created_by_id=current_user.id, offset=offset, limit=limit)
