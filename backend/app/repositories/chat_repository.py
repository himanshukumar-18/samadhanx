import uuid
from collections.abc import Sequence

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatMessage


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_message(
        self, sender_id: uuid.UUID, recipient_id: uuid.UUID, content: str, media_url: str | None, is_accepted: bool
    ) -> ChatMessage:
        msg = ChatMessage(
            sender_id=sender_id,
            recipient_id=recipient_id,
            content=content,
            media_url=media_url,
            is_accepted=is_accepted,
        )
        self.db.add(msg)
        await self.db.flush()

        # Re-fetch with eager loaded relationships
        return await self.get_by_id(msg.id)

    async def get_by_id(self, message_id: uuid.UUID) -> ChatMessage | None:
        q = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender), selectinload(ChatMessage.recipient))
            .where(ChatMessage.id == message_id)
        )
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def list_thread(self, user_a: uuid.UUID, user_b: uuid.UUID, limit: int = 50) -> Sequence[ChatMessage]:
        q = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender), selectinload(ChatMessage.recipient))
            .where(
                or_(
                    and_(ChatMessage.sender_id == user_a, ChatMessage.recipient_id == user_b),
                    and_(ChatMessage.sender_id == user_b, ChatMessage.recipient_id == user_a),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        res = await self.db.execute(q)
        return res.scalars().all()

    async def list_pending_requests(self, recipient_id: uuid.UUID) -> Sequence[ChatMessage]:
        q = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender), selectinload(ChatMessage.recipient))
            .where(and_(ChatMessage.recipient_id == recipient_id, ChatMessage.is_accepted.is_(False)))
            .order_by(ChatMessage.created_at.desc())
        )
        res = await self.db.execute(q)
        return res.scalars().all()

    async def accept_message_request(self, message_id: uuid.UUID, recipient_id: uuid.UUID) -> ChatMessage | None:
        msg = await self.get_by_id(message_id)
        if msg and msg.recipient_id == recipient_id:
            msg.is_accepted = True
            await self.db.flush()
            return msg
        return None
