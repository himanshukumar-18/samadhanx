import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.problem import Problem
from app.models.social import ProblemReport, ProblemSave, ProblemShare, UserFollow


class SocialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def follow_user(self, follower_id: uuid.UUID, following_id: uuid.UUID) -> bool:
        stmt = select(UserFollow).where(
            UserFollow.follower_id == follower_id, UserFollow.following_id == following_id
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            return False  # Already following

        follow = UserFollow(follower_id=follower_id, following_id=following_id)
        self.db.add(follow)
        await self.db.flush()
        return True

    async def unfollow_user(self, follower_id: uuid.UUID, following_id: uuid.UUID) -> bool:
        stmt = select(UserFollow).where(
            UserFollow.follower_id == follower_id, UserFollow.following_id == following_id
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            await self.db.delete(existing)
            await self.db.flush()
            return True
        return False

    async def is_following(self, follower_id: uuid.UUID, following_id: uuid.UUID) -> bool:
        stmt = select(UserFollow).where(
            UserFollow.follower_id == follower_id, UserFollow.following_id == following_id
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def list_followers(self, user_id: uuid.UUID) -> Sequence[UserFollow]:
        stmt = (
            select(UserFollow)
            .options(selectinload(UserFollow.follower))
            .where(UserFollow.following_id == user_id)
            .order_by(UserFollow.created_at.desc())
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def list_following(self, user_id: uuid.UUID) -> Sequence[UserFollow]:
        stmt = (
            select(UserFollow)
            .options(selectinload(UserFollow.following))
            .where(UserFollow.follower_id == user_id)
            .order_by(UserFollow.created_at.desc())
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_connection_stats(self, user_id: uuid.UUID) -> tuple[int, int]:
        followers_q = select(func.count(UserFollow.id)).where(UserFollow.following_id == user_id)
        following_q = select(func.count(UserFollow.id)).where(UserFollow.follower_id == user_id)

        followers_cnt = (await self.db.execute(followers_q)).scalar_one() or 0
        following_cnt = (await self.db.execute(following_q)).scalar_one() or 0
        return followers_cnt, following_cnt

    async def record_share(self, problem_id: uuid.UUID, user_id: uuid.UUID, platform: str) -> ProblemShare:
        share = ProblemShare(problem_id=problem_id, user_id=user_id, platform=platform)
        self.db.add(share)
        await self.db.flush()
        await self.db.refresh(share)
        return share

    async def get_share_count(self, problem_id: uuid.UUID) -> int:
        q = select(func.count(ProblemShare.id)).where(ProblemShare.problem_id == problem_id)
        return (await self.db.execute(q)).scalar_one() or 0

    async def toggle_save(self, problem_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        stmt = select(ProblemSave).where(ProblemSave.problem_id == problem_id, ProblemSave.user_id == user_id)
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            await self.db.delete(existing)
            await self.db.flush()
            return False
        self.db.add(ProblemSave(problem_id=problem_id, user_id=user_id))
        await self.db.flush()
        return True

    async def is_saved(self, problem_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        stmt = select(ProblemSave.id).where(ProblemSave.problem_id == problem_id, ProblemSave.user_id == user_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def list_saved_problems(self, user_id: uuid.UUID) -> Sequence[Problem]:
        stmt = (
            select(Problem)
            .join(ProblemSave, ProblemSave.problem_id == Problem.id)
            .where(ProblemSave.user_id == user_id)
            .order_by(ProblemSave.created_at.desc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def report_problem(self, problem_id: uuid.UUID, reporter_id: uuid.UUID, reason: str, details: str | None) -> bool:
        stmt = select(ProblemReport).where(ProblemReport.problem_id == problem_id, ProblemReport.reporter_id == reporter_id)
        if (await self.db.execute(stmt)).scalar_one_or_none():
            return False
        self.db.add(ProblemReport(problem_id=problem_id, reporter_id=reporter_id, reason=reason, details=details))
        await self.db.flush()
        return True
