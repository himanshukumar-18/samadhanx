import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ProblemStatus
from app.models.problem import Problem, ProblemComment, ProblemEndorsement
from app.models.user import User


class ProblemRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_problem(self, problem_data: dict) -> Problem:
        problem = Problem(**problem_data)
        self.db.add(problem)
        await self.db.flush()
        return await self.get_by_id(problem.id)

    async def get_by_id(self, problem_id: uuid.UUID) -> Problem | None:
        query = (
            select(Problem)
            .options(
                selectinload(Problem.author).selectinload(User.citizen_profile),
                selectinload(Problem.author).selectinload(User.student_profile),
                selectinload(Problem.author).selectinload(User.faculty_profile),
                selectinload(Problem.author).selectinload(User.university_profile),
                selectinload(Problem.author).selectinload(User.industry_profile),
                selectinload(Problem.author).selectinload(User.profile_detail),
                selectinload(Problem.comments).selectinload(ProblemComment.author).selectinload(User.profile_detail),
                selectinload(Problem.comments).selectinload(ProblemComment.author).selectinload(User.citizen_profile),
                selectinload(Problem.comments).selectinload(ProblemComment.author).selectinload(User.student_profile),
                selectinload(Problem.comments).selectinload(ProblemComment.author).selectinload(User.faculty_profile),
                selectinload(Problem.endorsements),
                selectinload(Problem.projects),
            )
            .where(Problem.id == problem_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_problems(
        self,
        category: str | None = None,
        status: ProblemStatus | None = None,
        district: str | None = None,
        state: str | None = None,
        created_by_id: uuid.UUID | None = None,
        is_verified_only: bool = False,
        search_query: str | None = None,
        exclude_statuses: list[ProblemStatus] | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Problem]:
        query = (
            select(Problem)
            .options(
                selectinload(Problem.author).selectinload(User.citizen_profile),
                selectinload(Problem.author).selectinload(User.student_profile),
                selectinload(Problem.author).selectinload(User.faculty_profile),
                selectinload(Problem.author).selectinload(User.university_profile),
                selectinload(Problem.author).selectinload(User.industry_profile),
                selectinload(Problem.author).selectinload(User.profile_detail),
                selectinload(Problem.comments).selectinload(ProblemComment.author).selectinload(User.profile_detail),
                selectinload(Problem.endorsements),
                selectinload(Problem.projects),
            )
            .order_by(Problem.created_at.desc())
        )

        if category and category.lower() != "all":
            query = query.where(Problem.category == category)
        if status:
            query = query.where(Problem.status == status)
        if district:
            query = query.where(Problem.district.ilike(f"%{district}%"))
        if state:
            query = query.where(Problem.state.ilike(f"%{state}%"))
        if created_by_id:
            query = query.where(Problem.created_by_id == created_by_id)
        if is_verified_only:
            query = query.where(Problem.is_verified == True)  # noqa: E712
        if search_query:
            pattern = f"%{search_query}%"
            query = query.where(
                Problem.title.ilike(pattern) | Problem.description.ilike(pattern) | Problem.category.ilike(pattern)
            )
        if exclude_statuses:
            query = query.where(Problem.status.not_in(exclude_statuses))

        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_problem(self, problem: Problem, update_data: dict) -> Problem:
        for field, value in update_data.items():
            if value is not None:
                setattr(problem, field, value)
        await self.db.flush()
        return await self.get_by_id(problem.id)

    async def delete_problem(self, problem: Problem) -> None:
        await self.db.delete(problem)
        await self.db.flush()

    async def add_comment(self, problem_id: uuid.UUID, user_id: uuid.UUID, content: str) -> ProblemComment:
        comment = ProblemComment(problem_id=problem_id, user_id=user_id, content=content)
        self.db.add(comment)
        await self.db.flush()
        return await self.get_comment_by_id(comment.id)

    async def get_comment_by_id(self, comment_id: uuid.UUID) -> ProblemComment | None:
        stmt = (
            select(ProblemComment)
            .options(
                selectinload(ProblemComment.author).selectinload(User.profile_detail),
                selectinload(ProblemComment.author).selectinload(User.citizen_profile),
                selectinload(ProblemComment.author).selectinload(User.student_profile),
                selectinload(ProblemComment.author).selectinload(User.faculty_profile),
            )
            .where(ProblemComment.id == comment_id)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_comments(self, problem_id: uuid.UUID) -> Sequence[ProblemComment]:
        stmt = (
            select(ProblemComment)
            .options(
                selectinload(ProblemComment.author).selectinload(User.profile_detail),
                selectinload(ProblemComment.author).selectinload(User.citizen_profile),
                selectinload(ProblemComment.author).selectinload(User.student_profile),
                selectinload(ProblemComment.author).selectinload(User.faculty_profile),
            )
            .where(ProblemComment.problem_id == problem_id)
            .order_by(ProblemComment.created_at.asc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def update_comment(self, comment: ProblemComment, content: str) -> ProblemComment:
        comment.content = content
        await self.db.flush()
        return await self.get_comment_by_id(comment.id)

    async def delete_comment(self, comment: ProblemComment) -> None:
        await self.db.delete(comment)
        await self.db.flush()

    async def toggle_endorsement(self, problem_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        stmt = select(ProblemEndorsement).where(
            ProblemEndorsement.problem_id == problem_id, ProblemEndorsement.user_id == user_id
        )
        res = await self.db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            await self.db.delete(existing)
            await self.db.flush()
            return False  # Un-endorsed
        else:
            endorsement = ProblemEndorsement(problem_id=problem_id, user_id=user_id)
            self.db.add(endorsement)
            await self.db.flush()
            return True  # Endorsed
