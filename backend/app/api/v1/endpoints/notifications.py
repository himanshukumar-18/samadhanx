from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications Inbox"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(30, ge=1, le=100),
):
    service = NotificationService(db)
    return await service.list_notifications(user=current_user, limit=limit)


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_read(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = NotificationService(db)
    await service.mark_all_read(user=current_user)
    return {"message": "All notifications marked as read."}
