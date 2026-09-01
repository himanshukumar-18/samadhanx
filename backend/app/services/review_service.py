import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.models.project_review import ProjectReview
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.repositories.review_repository import ReviewRepository
from app.schemas.review import ReviewCreate


class ReviewService:
    def __init__(self, db: AsyncSession):
        self.repo = ReviewRepository(db)
        self.project_repo = ProjectRepository(db)

    async def create_review(self, faculty_user: User, project_id: uuid.UUID, data: ReviewCreate) -> ProjectReview:
        if faculty_user.role not in [UserRole.FACULTY, UserRole.UNIVERSITY, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FACULTY_ONLY", "message": "Only faculty mentors or administrators can submit project reviews."},
            )

        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution project not found."},
            )

        # BOLA Scoping Check: Faculty must belong to same university or be assigned mentor or admin
        if (
            faculty_user.role == UserRole.FACULTY
            and faculty_user.faculty_profile
            and project.university_id
            and faculty_user.faculty_profile.university_id != project.university_id
            and faculty_user.id != project.faculty_mentor_id
            and faculty_user.role != UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to review projects outside your university."},
            )

        return await self.repo.create_review(
            project_id=project_id,
            reviewer_id=faculty_user.id,
            decision=data.decision,
            feedback_text=data.feedback_text,
        )

    async def list_reviews(self, project_id: uuid.UUID) -> Sequence[ProjectReview]:
        return await self.repo.list_by_project(project_id)
