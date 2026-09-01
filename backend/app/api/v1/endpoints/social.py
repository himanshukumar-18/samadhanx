import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.social import ConnectionStatsResponse, ReportCreate, ShareCreate
from app.schemas.problem import ProblemResponse
from app.services.problem_service import ProblemService
from app.services.social_service import SocialService

router = APIRouter(prefix="/social", tags=["Social Network & Connections"])


@router.post("/users/{user_id}/follow", response_model=dict)
async def follow_user(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    followed = await service.follow_user(current_user=current_user, target_user_id=user_id)
    return {"following": followed, "target_user_id": user_id}


@router.delete("/users/{user_id}/unfollow", response_model=dict)
async def unfollow_user(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    unfollowed = await service.unfollow_user(current_user=current_user, target_user_id=user_id)
    return {"unfollowed": unfollowed, "target_user_id": user_id}


@router.get("/users/{user_id}/stats", response_model=ConnectionStatsResponse)
async def get_connection_stats(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    return await service.get_connection_stats(current_user=current_user, target_user_id=user_id)


@router.get("/users/{user_id}/followers", response_model=list[dict])
async def list_followers(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    follows = await service.list_followers(user_id)
    return [
        {
            "user_id": f.follower_id,
            "email": f.follower.email if f.follower else "",
            "full_name": f.follower.full_name if f.follower else "",
            "role": f.follower.role.value if f.follower else "",
            "followed_at": f.created_at,
        }
        for f in follows
    ]


@router.get("/users/{user_id}/following", response_model=list[dict])
async def list_following(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    follows = await service.list_following(user_id)
    return [
        {
            "user_id": f.following_id,
            "email": f.following.email if f.following else "",
            "full_name": f.following.full_name if f.following else "",
            "role": f.following.role.value if f.following else "",
            "followed_at": f.created_at,
        }
        for f in follows
    ]


@router.post("/problems/{problem_id}/share", response_model=dict)
async def share_problem(
    problem_id: uuid.UUID,
    data: ShareCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = SocialService(db)
    shares_count = await service.share_problem(current_user=current_user, problem_id=problem_id, platform=data.platform)
    return {"problem_id": problem_id, "shares_count": shares_count}


@router.post("/problems/{problem_id}/save", response_model=dict)
async def toggle_save_problem(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    saved = await SocialService(db).toggle_save(current_user, problem_id)
    return {"problem_id": problem_id, "saved": saved}


@router.get("/problems/saved", response_model=list[ProblemResponse])
async def list_saved_problems(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    problems = await SocialService(db).list_saved_problems(current_user)
    problem_service = ProblemService(db)
    return [await problem_service.enrich_for_viewer(problem, current_user) for problem in problems]


@router.post("/problems/{problem_id}/report", response_model=dict)
async def report_problem(
    problem_id: uuid.UUID,
    data: ReportCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    created = await SocialService(db).report_problem(current_user, problem_id, data.reason, data.details)
    return {"problem_id": problem_id, "reported": created}
