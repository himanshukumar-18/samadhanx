import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType, ProblemStatus, UserRole
from app.models.problem import Problem, ProblemComment
from app.models.user import User
from app.repositories.problem_repository import ProblemRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.problem import ProblemCreate, ProblemUpdate


class ProblemService:
    def __init__(self, db: AsyncSession):
        self.repo = ProblemRepository(db)
        self.notification_repo = NotificationRepository(db)
        self.social_repo = SocialRepository(db)

    async def enrich_for_viewer(self, problem: Problem, viewer: User | None) -> Problem:
        problem.is_liked = bool(viewer and any(item.user_id == viewer.id for item in problem.endorsements))
        problem.is_saved = bool(viewer and await self.social_repo.is_saved(problem.id, viewer.id))
        problem.shares_count = await self.social_repo.get_share_count(problem.id)
        return problem

    async def create_problem(self, user: User, data: ProblemCreate) -> Problem:
        data_dict = data.model_dump()
        data_dict["created_by_id"] = user.id
        data_dict["status"] = ProblemStatus.SUBMITTED

        # Mock AI Insight summary generation
        data_dict["ai_insight"] = {
            "summary": f"AI Problem Match: Categorized under {data.category} in {data.district}, {data.state}.",
            "confidenceScore": 0.92,
            "requiredSkills": [data.category, "Field Research", "Data Analysis", "Community Outreach"],
            "matchedPeopleCount": 12,
        }

        return await self.repo.create_problem(data_dict)

    async def get_problem(self, problem_id: uuid.UUID) -> Problem:
        problem = await self.repo.get_by_id(problem_id)
        if not problem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROBLEM_NOT_FOUND", "message": "The requested societal problem does not exist."},
            )
        return problem

    async def list_problems(
        self,
        category: str | None = None,
        status_filter: ProblemStatus | None = None,
        district: str | None = None,
        state: str | None = None,
        created_by_id: uuid.UUID | None = None,
        is_verified_only: bool = False,
        search_query: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Problem]:
        return await self.repo.list_problems(
            category=category,
            status=status_filter,
            district=district,
            state=state,
            created_by_id=created_by_id,
            is_verified_only=is_verified_only,
            search_query=search_query,
            offset=offset,
            limit=limit,
        )

    async def update_problem(self, user: User, problem_id: uuid.UUID, data: ProblemUpdate) -> Problem:
        problem = await self.get_problem(problem_id)

        # BOLA Check: Only the author or Admin can edit
        if problem.created_by_id != user.id and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to edit this problem submission."},
            )

        update_dict = data.model_dump(exclude_unset=True)
        return await self.repo.update_problem(problem, update_dict)

    async def delete_problem(self, user: User, problem_id: uuid.UUID) -> None:
        problem = await self.get_problem(problem_id)

        # BOLA Check
        if problem.created_by_id != user.id and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to delete this problem submission."},
            )

        await self.repo.delete_problem(problem)

    async def add_comment(self, user: User, problem_id: uuid.UUID, content: str) -> ProblemComment:
        problem = await self.get_problem(problem_id)
        comment = await self.repo.add_comment(problem_id=problem_id, user_id=user.id, content=content)
        if problem.created_by_id != user.id:
            await self.notification_repo.create_notification(
                recipient_id=problem.created_by_id,
                title="New comment on your problem",
                message=f"{user.full_name} commented on {problem.title}.",
                type=NotificationType.SYSTEM_ALERT,
                link=f"/problems/{problem.id}",
            )
        return comment

    async def list_comments(self, problem_id: uuid.UUID) -> Sequence[ProblemComment]:
        await self.get_problem(problem_id)
        return await self.repo.list_comments(problem_id)

    async def update_comment(self, user: User, comment_id: uuid.UUID, content: str) -> ProblemComment:
        comment = await self.repo.get_comment_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "COMMENT_NOT_FOUND", "message": "Comment not found."})
        if comment.user_id != user.id and user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "You cannot edit this comment."})
        return await self.repo.update_comment(comment, content)

    async def delete_comment(self, user: User, comment_id: uuid.UUID) -> None:
        comment = await self.repo.get_comment_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "COMMENT_NOT_FOUND", "message": "Comment not found."})
        if comment.user_id != user.id and user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "You cannot delete this comment."})
        await self.repo.delete_comment(comment)

    async def toggle_endorsement(self, user: User, problem_id: uuid.UUID) -> bool:
        await self.get_problem(problem_id)  # Validate existence
        return await self.repo.toggle_endorsement(problem_id=problem_id, user_id=user.id)
