import uuid
from collections.abc import Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType
from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        recipient_id: uuid.UUID,
        title: str,
        message: str,
        type: NotificationType = NotificationType.SYSTEM_ALERT,
        link: str | None = None,
    ) -> Notification:
        notification = Notification(
            recipient_id=recipient_id,
            title=title,
            message=message,
            type=type,
            link=link,
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def list_by_recipient(self, recipient_id: uuid.UUID, limit: int = 30) -> Sequence[Notification]:
        query = (
            select(Notification)
            .where(Notification.recipient_id == recipient_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def mark_all_read(self, recipient_id: uuid.UUID) -> None:
        stmt = update(Notification).where(Notification.recipient_id == recipient_id).values(is_read=True)
        await self.db.execute(stmt)
        await self.db.flush()
