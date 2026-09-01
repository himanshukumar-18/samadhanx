import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType
from app.models.social import UserFollow
from app.repositories.problem_repository import ProblemRepository
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.social_repository import SocialRepository


class SocialService:
    def __init__(self, db: AsyncSession):
        self.repo = SocialRepository(db)
        self.notif_repo = NotificationRepository(db)
        self.problem_repo = ProblemRepository(db)

    async def follow_user(self, current_user: User, target_user_id: uuid.UUID) -> bool:
        if current_user.id == target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_FOLLOW", "message": "You cannot follow yourself."},
            )

        success = await self.repo.follow_user(current_user.id, target_user_id)
        if success:
            await self.notif_repo.create_notification(
                recipient_id=target_user_id,
                title="New Connection / Follower",
                message=f"{current_user.full_name} started following you on SamadhanX.",
                type=NotificationType.SYSTEM_ALERT,
            )
        return success

    async def unfollow_user(self, current_user: User, target_user_id: uuid.UUID) -> bool:
        return await self.repo.unfollow_user(current_user.id, target_user_id)

    async def list_followers(self, user_id: uuid.UUID) -> Sequence[UserFollow]:
        return await self.repo.list_followers(user_id)

    async def list_following(self, user_id: uuid.UUID) -> Sequence[UserFollow]:
        return await self.repo.list_following(user_id)

    async def get_connection_stats(self, current_user: User, target_user_id: uuid.UUID) -> dict:
        followers_cnt, following_cnt = await self.repo.get_connection_stats(target_user_id)
        is_following = await self.repo.is_following(current_user.id, target_user_id)
        is_followed_by = await self.repo.is_following(target_user_id, current_user.id)

        return {
            "followers_count": followers_cnt,
            "following_count": following_cnt,
            "is_following": is_following,
            "is_followed_by": is_followed_by,
        }

    async def share_problem(self, current_user: User, problem_id: uuid.UUID, platform: str = "link") -> int:
        if not await self.problem_repo.get_by_id(problem_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "PROBLEM_NOT_FOUND", "message": "Problem not found."})
        await self.repo.record_share(problem_id=problem_id, user_id=current_user.id, platform=platform)
        return await self.repo.get_share_count(problem_id)

    async def toggle_save(self, current_user: User, problem_id: uuid.UUID) -> bool:
        if not await self.problem_repo.get_by_id(problem_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "PROBLEM_NOT_FOUND", "message": "Problem not found."})
        return await self.repo.toggle_save(problem_id, current_user.id)

    async def list_saved_problems(self, current_user: User):
        saved = await self.repo.list_saved_problems(current_user.id)
        return [await self.problem_repo.get_by_id(problem.id) for problem in saved]

    async def report_problem(self, current_user: User, problem_id: uuid.UUID, reason: str, details: str | None) -> bool:
        if not await self.problem_repo.get_by_id(problem_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "PROBLEM_NOT_FOUND", "message": "Problem not found."})
        return await self.repo.report_problem(problem_id, current_user.id, reason, details)
