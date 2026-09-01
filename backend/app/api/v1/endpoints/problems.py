import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db, get_optional_current_user
from app.models.enums import ProblemStatus
from app.models.user import User
from app.schemas.problem import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    ProblemCreate,
    ProblemResponse,
    ProblemUpdate,
)
from app.services.problem_service import ProblemService

router = APIRouter(prefix="/problems", tags=["Problems Engine"])


def comment_response(comment):
    author_obj = None
    if comment.author:
        avatar = comment.author.profile_detail.avatar_url if comment.author.profile_detail else None
        author_obj = {
            "id": comment.author.id,
            "email": comment.author.email,
            "full_name": comment.author.full_name,
            "role": comment.author.role.value,
            "avatar_url": avatar,
        }

    return {
        "id": comment.id,
        "problem_id": comment.problem_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "created_at": comment.created_at,
        "author_name": comment.author.full_name if comment.author else "Citizen Contributor",
        "author_avatar": comment.author.profile_detail.avatar_url if (comment.author and comment.author.profile_detail) else None,
        "author_role": comment.author.role.value if comment.author else "citizen",
        "author": author_obj,
    }


@router.post("/upload-media", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_problem_media(
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
):
    from app.services.cloudinary_service import CloudinaryService

    return await CloudinaryService.upload_media(
        await file.read(), file.filename or "media", file.content_type, folder="problems"
    )


@router.get("", response_model=list[ProblemResponse])
async def list_problems(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
    category: str | None = Query(None),
    status: ProblemStatus | None = Query(None),
    district: str | None = Query(None),
    state: str | None = Query(None),
    is_verified_only: bool = Query(False),
    search: str | None = Query(None),
    feed_type: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    service = ProblemService(db)
    problems = await service.list_problems(
        category=category,
        status_filter=status,
        district=district,
        state=state,
        is_verified_only=is_verified_only,
        search_query=search,
        offset=offset,
        limit=limit,
    )
    return [await service.enrich_for_viewer(problem, current_user) for problem in problems]


@router.post("", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED)
async def create_problem(
    data: ProblemCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    return await service.create_problem(user=current_user, data=data)


@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem_detail(
    problem_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
):
    service = ProblemService(db)
    return await service.enrich_for_viewer(await service.get_problem(problem_id), current_user)


@router.patch("/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: uuid.UUID,
    data: ProblemUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    return await service.update_problem(user=current_user, problem_id=problem_id, data=data)


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_problem(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    await service.delete_problem(user=current_user, problem_id=problem_id)


@router.post("/{problem_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_problem_comment(
    problem_id: uuid.UUID,
    data: CommentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    comment = await service.add_comment(user=current_user, problem_id=problem_id, content=data.content)
    return comment_response(comment)


@router.get("/{problem_id}/comments", response_model=list[CommentResponse])
async def list_problem_comments(problem_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    return [comment_response(comment) for comment in await ProblemService(db).list_comments(problem_id)]


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_problem_comment(
    comment_id: uuid.UUID,
    data: CommentUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return comment_response(await ProblemService(db).update_comment(current_user, comment_id, data.content))


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_problem_comment(
    comment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await ProblemService(db).delete_comment(current_user, comment_id)


@router.post("/{problem_id}/endorse", response_model=dict)
async def toggle_endorsement(
    problem_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProblemService(db)
    is_endorsed = await service.toggle_endorsement(user=current_user, problem_id=problem_id)
    return {"endorsed": is_endorsed, "problem_id": problem_id}
