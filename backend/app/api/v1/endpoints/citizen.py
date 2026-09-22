import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.problem import CitizenProblemTimelineResponse, ProblemCreate, ProblemResponse
from app.schemas.profile_detail import CitizenProfileResponse, CitizenProfileUpdate
from app.services.problem_service import ProblemService
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/citizen", tags=["Citizen"])


# ---------------------------------------------------------------------------
# Citizen Profile — GET
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=CitizenProfileResponse)
async def get_citizen_profile(
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the authenticated citizen's full civic profile."""
    service = ProfileService(db)
    return await service.get_citizen_profile(current_user)


# ---------------------------------------------------------------------------
# Citizen Profile — PATCH
# ---------------------------------------------------------------------------

@router.patch("/profile", response_model=CitizenProfileResponse)
async def update_citizen_profile(
    data: CitizenProfileUpdate,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update the authenticated citizen's profile.

    Only whitelisted civic fields are accepted. The schema uses extra='forbid'
    so attempts to send role/email/account_status/activity will be rejected 422.

    Ownership is enforced server-side — the user can only update their own profile.
    """
    service = ProfileService(db)
    return await service.update_citizen_profile(current_user, data)


# ---------------------------------------------------------------------------
# Citizen Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=dict)
async def get_citizen_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.problem import Problem
    from app.models.project import SolutionProject
    from sqlalchemy import func, select

    status_stmt = (
        select(Problem.status, func.count(Problem.id))
        .where(Problem.created_by_id == current_user.id)
        .group_by(Problem.status)
    )
    status_res = await db.execute(status_stmt)
    status_counts = dict(status_res.all())

    solved_count = status_counts.get(ProblemStatus.SOLVED, 0)
    pending_review_count = (
        status_counts.get(ProblemStatus.SUBMITTED, 0)
        + status_counts.get(ProblemStatus.UNDER_REVIEW, 0)
    )
    total_submitted_count = sum(status_counts.values())

    active_teams_stmt = (
        select(func.count(SolutionProject.id))
        .join(Problem, SolutionProject.problem_id == Problem.id)
        .where(Problem.created_by_id == current_user.id)
    )
    active_teams_count = (await db.execute(active_teams_stmt)).scalar_one() or 0

    return {
        "user_name": current_user.citizen_profile.full_name if current_user.citizen_profile else current_user.email,
        "solved_problems_count": solved_count,
        "active_teams_count": active_teams_count,
        "pending_review_count": pending_review_count,
        "total_submitted_count": total_submitted_count,
    }


# ---------------------------------------------------------------------------
# Citizen Problems
# ---------------------------------------------------------------------------

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
    problems = await service.list_problems(created_by_id=current_user.id, offset=offset, limit=limit)
    return await service.batch_enrich_for_viewer(problems, current_user)


# ---------------------------------------------------------------------------
# Citizen Problem Lifecycle Timeline (Core Tracking)
# ---------------------------------------------------------------------------

@router.get("/my-problems/{problem_id}/timeline", response_model=CitizenProblemTimelineResponse)
@router.get("/problems/{problem_id}/timeline", response_model=CitizenProblemTimelineResponse)
async def get_problem_timeline(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role([UserRole.CITIZEN, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Return the full real-time problem-to-impact lifecycle timeline for a problem.

    Enforces BOLA: only the citizen who submitted the problem or an administrator
    can access the detailed timeline.
    """
    service = ProblemService(db)
    return await service.get_problem_timeline(user=current_user, problem_id=problem_id)

