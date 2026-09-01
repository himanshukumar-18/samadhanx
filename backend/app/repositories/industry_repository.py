import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import RequestStatus
from app.models.industry_support import IndustrySupport


class IndustryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_support_intent(self, data: dict) -> IndustrySupport:
        support = IndustrySupport(**data)
        self.db.add(support)
        await self.db.flush()
        await self.db.refresh(support)
        return support

    async def get_by_id(self, support_id: uuid.UUID) -> IndustrySupport | None:
        query = (
            select(IndustrySupport)
            .options(selectinload(IndustrySupport.project), selectinload(IndustrySupport.industry_user))
            .where(IndustrySupport.id == support_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_industry_user(self, industry_user_id: uuid.UUID) -> Sequence[IndustrySupport]:
        query = (
            select(IndustrySupport)
            .options(selectinload(IndustrySupport.project))
            .where(IndustrySupport.industry_user_id == industry_user_id)
            .order_by(IndustrySupport.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_status(self, support: IndustrySupport, status: RequestStatus) -> IndustrySupport:
        support.status = status
        await self.db.flush()
        await self.db.refresh(support)
        return support
