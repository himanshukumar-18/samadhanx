import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.problem import Problem
from app.models.profiles import CitizenProfile
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
            if v is not None and hasattr(detail, k):
                setattr(detail, k, v)
        await self.db.flush()
        await self.db.refresh(detail)
        return detail

    async def get_or_create_citizen_profile(self, user_id: uuid.UUID, default_name: str = "") -> CitizenProfile:
        q = select(CitizenProfile).where(CitizenProfile.user_id == user_id)
        res = await self.db.execute(q)
        cp = res.scalar_one_or_none()
        if not cp:
            cp = CitizenProfile(
                user_id=user_id,
                full_name=default_name or "Citizen Solver",
                location="India",
                district="Default District",
                state="Default State",
                interests=[],
            )
            self.db.add(cp)
            await self.db.flush()
            await self.db.refresh(cp)
        return cp

    async def get_citizen_profile(self, user_id: uuid.UUID) -> CitizenProfile | None:
        """Load the CitizenProfile for a given user, or None if not found."""
        q = select(CitizenProfile).where(CitizenProfile.user_id == user_id)
        res = await self.db.execute(q)
        return res.scalar_one_or_none()

    async def update_citizen_profile(self, user_id: uuid.UUID, update_dict: dict) -> CitizenProfile:
        cp = await self.get_or_create_citizen_profile(user_id)
        for k, v in update_dict.items():
            if hasattr(cp, k):
                setattr(cp, k, v)
        await self.db.flush()
        await self.db.refresh(cp)
        return cp

    async def get_citizen_activity_stats(self, user_id: uuid.UUID) -> dict[str, int]:
        """
        Aggregate real problem counts from the DB.
        Returns keys matching CitizenActivityStats: submitted, approved, pending, rejected, solved.
        """
        q = (
            select(Problem.status, func.count(Problem.id))
            .where(Problem.created_by_id == user_id)
            .group_by(Problem.status)
        )
        res = await self.db.execute(q)
        counts = {str(r[0]): r[1] for r in res.all()}

        total = sum(counts.values())
        pending = counts.get("submitted", 0) + counts.get("under_review", 0)
        approved = (
            counts.get("verified", 0)
            + counts.get("in_progress", 0)
            + counts.get("pilot", 0)
            + counts.get("solution_submitted", 0)
        )
        rejected = counts.get("rejected", 0)
        solved = counts.get("solved", 0)

        return {
            "submitted": total,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "solved": solved,
        }

    # Legacy method name kept for backward-compat (used by non-citizen profile service path)
    async def get_citizen_problem_stats(self, user_id: uuid.UUID) -> dict[str, int]:
        stats = await self.get_citizen_activity_stats(user_id)
        return {
            "problems_submitted": stats["submitted"],
            "problems_approved": stats["approved"],
            "problems_pending": stats["pending"],
            "problems_rejected": stats["rejected"],
            "problems_solved": stats["solved"],
        }

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
