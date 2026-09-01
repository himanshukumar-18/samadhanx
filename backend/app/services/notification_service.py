import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.repo = NotificationRepository(db)

    async def notify_user(
        self,
        recipient_id: uuid.UUID,
        title: str,
        message: str,
        type: NotificationType = NotificationType.SYSTEM_ALERT,
        link: str | None = None,
    ) -> Notification:
        return await self.repo.create_notification(
            recipient_id=recipient_id,
            title=title,
            message=message,
            type=type,
            link=link,
        )

    async def list_notifications(self, user: User, limit: int = 30) -> Sequence[Notification]:
        return await self.repo.list_by_recipient(user.id, limit=limit)

    async def mark_all_read(self, user: User) -> None:
        await self.repo.mark_all_read(user.id)
