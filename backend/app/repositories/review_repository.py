import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ReviewDecision
from app.models.project_review import ProjectReview


class ReviewRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(
        self, project_id: uuid.UUID, reviewer_id: uuid.UUID, decision: ReviewDecision, feedback_text: str
    ) -> ProjectReview:
        review = ProjectReview(
            project_id=project_id,
            reviewer_id=reviewer_id,
            decision=decision,
            feedback_text=feedback_text,
        )
        self.db.add(review)
        await self.db.flush()
        await self.db.refresh(review)
        return review

    async def list_by_project(self, project_id: uuid.UUID) -> Sequence[ProjectReview]:
        query = (
            select(ProjectReview)
            .options(selectinload(ProjectReview.reviewer))
            .where(ProjectReview.project_id == project_id)
            .order_by(ProjectReview.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()
