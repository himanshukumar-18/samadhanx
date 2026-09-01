from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.repositories.settings_repository import SettingsRepository
from app.schemas.settings import AccountSettingsResponse, AccountSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Account Settings & Privacy"])


@router.get("/me", response_model=AccountSettingsResponse)
async def get_my_settings(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SettingsRepository(db)
    return await repo.get_or_create(current_user.id)


@router.patch("/me", response_model=AccountSettingsResponse)
async def update_my_settings(
    data: AccountSettingsUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SettingsRepository(db)
    update_dict = data.model_dump(exclude_unset=True)
    return await repo.update_settings(current_user.id, update_dict)
