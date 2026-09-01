import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.user_profile import UserProfileDetail


class ProfileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_detail(self, user_id: uuid.UUID) -> UserProfileDetail:
        q = select(UserProfileDetail).where(UserProfileDetail.user_id == user_id)
        res = await self.db.execute(q)
        detail = res.scalar_one_or_none()

        if not detail:
            detail = UserProfileDetail(
                user_id=user_id,
                skills=[],
                experience=[],
                education=[],
            )
            self.db.add(detail)
            await self.db.flush()
            await self.db.refresh(detail)

        return detail

    async def update_detail(self, user_id: uuid.UUID, update_dict: dict) -> UserProfileDetail:
        detail = await self.get_or_create_detail(user_id)
        for k, v in update_dict.items():
            if v is not None:
                setattr(detail, k, v)
        await self.db.flush()
        await self.db.refresh(detail)
        return detail

    async def get_user_with_profiles(self, user_id: uuid.UUID) -> User | None:
        q = (
            select(User)
            .options(
                selectinload(User.citizen_profile),
                selectinload(User.student_profile).selectinload(User.student_profile.property.mapper.class_.university),
                selectinload(User.faculty_profile).selectinload(User.faculty_profile.property.mapper.class_.university),
                selectinload(User.university_profile),
                selectinload(User.industry_profile),
                selectinload(User.profile_detail),
            )
            .where(User.id == user_id)
        )
        res = await self.db.execute(q)
        return res.scalar_one_or_none()
