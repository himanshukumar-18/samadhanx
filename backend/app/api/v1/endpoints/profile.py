import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.problem import ProblemResponse
from app.schemas.profile_detail import (
    PublicUserProfileResponse,
    UserProfileDetailResponse,
    UserProfileUpdate,
)
from app.services.cloudinary_service import CloudinaryService
from app.services.problem_service import ProblemService
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["User Profiles & Media"])

# Allowed MIME types for avatar/cover uploads
_ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024   # 5 MB
_MAX_COVER_BYTES  = 8 * 1024 * 1024   # 8 MB


@router.get("/me", response_model=UserProfileDetailResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ProfileService(db)
    return await service.get_profile(current_user=current_user, target_user_id=current_user.id)


@router.get("/user/{user_id}", response_model=PublicUserProfileResponse)
async def get_public_profile(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Public profile for any user.

    Privacy-enforced server-side:
    - Returns PublicUserProfileResponse which never contains email, phone,
      DOB, full_address, pincode, password, tokens, or admin/moderation data.
    - FastAPI enforces the response_model — no private field can leak via
      serialization even if the service were to return extra fields.
    - Suspended/deactivated users: account_available=False, minimal data.
    - Non-existent user: 404.

    Auth required: prevents unauthenticated scraping.
    IDOR/BOLA safe: reads only the target_user's public data, never the
    viewer's private data; viewer can only see public fields regardless of role.
    """
    service = ProfileService(db)
    return await service.get_public_profile(target_user_id=user_id)


@router.get("/user/{user_id}/problems", response_model=list[ProblemResponse])
async def get_user_public_problems(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
):
    """
    Paginated public problems for a given user.

    Server-side filtering:
    - Only problems with status NOT 'rejected' are returned.
      (Rejected problems are private to protect citizen dignity.)
    - Backend determines visibility — frontend must never filter.
    - Viewer-aware enrichment via enrich_for_viewer (like/save state).

    Pagination: offset + limit (matches existing /problems convention).
    """
    from app.models.enums import ProblemStatus
    service = ProblemService(db)
    problems = await service.list_problems(
        created_by_id=user_id,
        offset=offset,
        limit=limit,
        exclude_statuses=[ProblemStatus.REJECTED],
    )
    return [await service.enrich_for_viewer(p, current_user) for p in problems]


@router.patch("/me", response_model=UserProfileDetailResponse)
async def update_my_profile(
    payload: dict,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Shared profile update for non-citizen roles (Student, Faculty, Industry, University).
    Citizens must use PATCH /citizen/profile instead.
    """
    if current_user.role == UserRole.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "USE_CITIZEN_ENDPOINT",
                "message": "Citizens must use PATCH /api/v1/citizen/profile to update their profile.",
            },
        )

    service = ProfileService(db)
    update_data = UserProfileUpdate(**payload)
    return await service.update_my_profile(current_user=current_user, data=update_data)


@router.post("/upload-media", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_profile_media(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    media_type: str = Form("avatar"),  # "avatar" or "cover"
):
    """
    Upload a profile avatar or cover image.

    Security checks:
    - MIME type must be an allowed image type (no executables, no video)
    - File size limited: avatar ≤ 5 MB, cover ≤ 8 MB
    - File extension validated against MIME type
    - Cloudinary public_id is generated server-side (never trusted from client)
    """
    # 1. Validate media_type value
    if media_type not in ("avatar", "cover"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_MEDIA_TYPE", "message": "media_type must be 'avatar' or 'cover'."},
        )

    # 2. Validate MIME type
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_MEDIA_TYPE",
                "message": f"Only JPEG, PNG, WebP, or GIF images are accepted. Got: {content_type}",
            },
        )

    # 3. Read & validate size
    content = await file.read()
    max_bytes = _MAX_AVATAR_BYTES if media_type == "avatar" else _MAX_COVER_BYTES
    max_label = "5 MB" if media_type == "avatar" else "8 MB"
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": f"Image must be smaller than {max_label}."},
        )

    # 4. Upload via Cloudinary service (server generates safe public_id)
    folder = "avatars" if media_type == "avatar" else "covers"
    result = await CloudinaryService.upload_media(content, file.filename or "media", content_type, folder=folder)

    url = result.get("url")
    if url:
        service = ProfileService(db)
        if current_user.role == UserRole.CITIZEN:
            # Update CitizenProfile.profile_picture_url for citizens
            from app.schemas.profile_detail import CitizenProfileUpdate
            await service.update_citizen_profile(
                current_user, CitizenProfileUpdate(profile_picture_url=url)
            )
        else:
            if media_type == "avatar":
                await service.update_my_profile(current_user, UserProfileUpdate(avatar_url=url))
            elif media_type == "cover":
                await service.update_my_profile(current_user, UserProfileUpdate(cover_url=url))

    return {"media_type": media_type, **result}
