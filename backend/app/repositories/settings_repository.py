import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_settings import AccountSettings


class SettingsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self, user_id: uuid.UUID) -> AccountSettings:
        q = select(AccountSettings).where(AccountSettings.user_id == user_id)
        res = await self.db.execute(q)
        settings = res.scalar_one_or_none()

        if not settings:
            settings = AccountSettings(
                user_id=user_id,
                email_notifications=True,
                push_notifications=True,
                public_profile=True,
                show_contact=False,
            )
            self.db.add(settings)
            await self.db.flush()
            await self.db.refresh(settings)

        return settings

    async def update_settings(self, user_id: uuid.UUID, update_dict: dict) -> AccountSettings:
        settings = await self.get_or_create(user_id)
        for k, v in update_dict.items():
            if v is not None:
                setattr(settings, k, v)
        await self.db.flush()
        await self.db.refresh(settings)
        return settings
