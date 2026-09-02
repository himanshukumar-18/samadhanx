import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.profile_detail import CitizenProfileUpdate, UserProfileDetailResponse, UserProfileUpdate
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
    payload: dict,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProfileService(db)
    if current_user.role == UserRole.CITIZEN:
        try:
            citizen_data = CitizenProfileUpdate.model_validate(payload)
            dict_data = citizen_data.model_dump(exclude_unset=True, mode="json")
            update_data = UserProfileUpdate(**dict_data)
        except ValidationError as ve:
            errors = ve.errors()
            for err in errors:
                loc_field = err["loc"][-1] if err["loc"] else ""
                err_msg = str(err.get("msg", ""))
                if "url" in str(loc_field).lower() or "url" in err_msg.lower():
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "INVALID_PROFILE_URL", "message": f"Invalid URL for field {loc_field}: {err_msg}"},
                    )
                if "headline" in str(loc_field).lower() and "max_length" in err.get("type", ""):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "HEADLINE_TOO_LONG", "message": "Headline exceeds maximum length of 120 characters."},
                    )
                if "bio" in str(loc_field).lower() and "max_length" in err.get("type", ""):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "BIO_TOO_LONG", "message": "Bio exceeds maximum length of 500 characters."},
                    )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "PROFILE_UPDATE_FAILED", "message": "Invalid profile update payload.", "errors": errors},
            )
    else:
        update_data = UserProfileUpdate(**payload)

    return await service.update_my_profile(current_user=current_user, data=update_data)


@router.post("/upload-media", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_profile_media(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    media_type: str = Form("avatar"),  # avatar or cover
):
    content = await file.read()
    folder = "avatars" if media_type == "avatar" else "covers"
    result = await CloudinaryService.upload_media(content, file.filename or "media", file.content_type, folder=folder)

    url = result.get("url")
    if url:
        service = ProfileService(db)
        if media_type == "avatar":
            await service.update_my_profile(current_user, UserProfileUpdate(avatar_url=url))
        elif media_type == "cover":
            await service.update_my_profile(current_user, UserProfileUpdate(cover_url=url))

    return {"media_type": media_type, **result}
