import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.profile_detail import UserProfileDetailResponse, UserProfileUpdate
from app.services.cloudinary_service import CloudinaryService
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["User Profiles & Media"])


@router.get("/me", response_model=UserProfileDetailResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProfileService(db)
    return await service.get_profile(current_user=current_user, target_user_id=current_user.id)


@router.get("/user/{user_id}", response_model=UserProfileDetailResponse)
async def get_public_profile(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProfileService(db)
    return await service.get_profile(current_user=current_user, target_user_id=user_id)


@router.patch("/me", response_model=UserProfileDetailResponse)
async def update_my_profile(
    data: UserProfileUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProfileService(db)
    return await service.update_my_profile(current_user=current_user, data=data)


@router.post("/upload-media", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_profile_media(
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
    media_type: str = Form("avatar"),  # avatar or cover
):
    content = await file.read()
    folder = "avatars" if media_type == "avatar" else "covers"
    result = await CloudinaryService.upload_media(content, file.filename or "media", file.content_type, folder=folder)
    return {"media_type": media_type, **result}
