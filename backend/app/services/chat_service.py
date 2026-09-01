import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage
from app.models.enums import NotificationType
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.chat import ChatMessageCreate


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ChatRepository(db)
        self.social_repo = SocialRepository(db)
        self.notif_repo = NotificationRepository(db)

    async def send_message(self, sender: User, data: ChatMessageCreate) -> ChatMessage:
        target_recipient_id = data.recipient_id

        # Resolve user by email if recipient_email provided
        if not target_recipient_id and data.recipient_email:
            q = select(User).where(User.email.ilike(data.recipient_email.strip()))
            res = await self.db.execute(q)
            target_user = res.scalar_one_or_none()
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "USER_NOT_FOUND", "message": f"User with email '{data.recipient_email}' was not found."},
                )
            target_recipient_id = target_user.id

        if not target_recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "MISSING_RECIPIENT", "message": "Please specify a recipient email or user ID."},
            )

        if sender.id == target_recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_MESSAGE", "message": "You cannot send messages to yourself."},
            )

        # Check if recipient follows sender (Connection established)
        recipient_follows_sender = await self.social_repo.is_following(target_recipient_id, sender.id)
        sender_follows_recipient = await self.social_repo.is_following(sender.id, target_recipient_id)

        # Direct inbox delivery if recipient follows sender or mutually connected
        is_accepted = recipient_follows_sender or sender_follows_recipient

        msg = await self.repo.create_message(
            sender_id=sender.id,
            recipient_id=target_recipient_id,
            content=data.content,
            media_url=data.media_url,
            is_accepted=is_accepted,
        )

        # Dispatch notification if message request
        if not is_accepted:
            await self.notif_repo.create_notification(
                recipient_id=target_recipient_id,
                title="New Message Request",
                message=f"{sender.full_name} sent you a message request.",
                type=NotificationType.SYSTEM_ALERT,
            )

        return msg

    async def list_thread(self, current_user: User, other_user_id: uuid.UUID, limit: int = 50) -> Sequence[ChatMessage]:
        return await self.repo.list_thread(current_user.id, other_user_id, limit=limit)

    async def list_pending_requests(self, current_user: User) -> Sequence[ChatMessage]:
        return await self.repo.list_pending_requests(current_user.id)

    async def accept_request(self, current_user: User, message_id: uuid.UUID) -> ChatMessage:
        msg = await self.repo.accept_message_request(message_id, current_user.id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Message request not found or already accepted."},
            )
        return msg
