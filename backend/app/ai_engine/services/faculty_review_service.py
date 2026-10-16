"""Service for Faculty AI Review Assistant.

Coordinates authorization, database retrieval of solution projects and milestone evidence,
and execution of the LangGraph review pipeline.
"""

import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_engine.graphs.faculty_review import FacultyReviewGraphBuilder
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.schemas.faculty_review import (
    FacultyAIReviewInput,
    FacultyAIReviewOutput,
    ProjectReviewSummary,
    ProjectUpdateSummary,
)
from app.models.enums import UserRole
from app.models.profiles import FacultyProfile
from app.models.project import ProjectMember, SolutionProject
from app.models.user import User

logger = logging.getLogger("samadhanx.ai.faculty_review_service")


class FacultyAIReviewService:
    """Service handling Faculty AI Review Assistant operations."""

    def __init__(self, db: AsyncSession, provider: ModelProvider | None = None):
        self.db = db
        self.provider = provider

    async def generate_review(
        self,
        project_id: uuid.UUID,
        current_user: User,
    ) -> FacultyAIReviewOutput:
        """Fetch project context, verify permissions, and run AI review assistant."""
        # 1. Fetch solution project with eager loading
        stmt = (
            select(SolutionProject)
            .options(
                selectinload(SolutionProject.problem),
                selectinload(SolutionProject.updates),
                selectinload(SolutionProject.reviews).selectinload(SolutionProject.reviews.property.mapper.class_.reviewer),
                selectinload(SolutionProject.members).selectinload(ProjectMember.user),
                selectinload(SolutionProject.lead_student).selectinload(User.student_profile),
            )
            .where(SolutionProject.id == project_id)
        )
        res = await self.db.execute(stmt)
        project = res.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROJECT_NOT_FOUND", "message": "Solution pod not found."},
            )

        # 2. Permission / BOLA check
        if current_user.role not in [UserRole.FACULTY, UserRole.UNIVERSITY, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Only faculty or administrators can trigger AI review assistance."},
            )

        if current_user.role == UserRole.FACULTY:
            # Check if assigned mentor or same university
            faculty_stmt = select(FacultyProfile).where(FacultyProfile.user_id == current_user.id)
            faculty_res = await self.db.execute(faculty_stmt)
            faculty_profile = faculty_res.scalar_one_or_none()

            is_direct_mentor = project.faculty_mentor_id == current_user.id
            is_same_univ = (
                faculty_profile is not None
                and faculty_profile.university_id is not None
                and (
                    project.university_id == faculty_profile.university_id
                    or (project.faculty_mentor_id is None and project.university_id is None)
                )
            )

            if not is_direct_mentor and not is_same_univ:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "FACULTY_REVIEW_ACCESS_DENIED",
                        "message": "You are not authorized to review this student pod.",
                    },
                )

        # 3. Assemble milestone updates summary
        raw_updates = sorted(project.updates or [], key=lambda u: u.created_at)
        update_summaries = [
            ProjectUpdateSummary(
                title=u.title,
                content=u.content,
                prototype_url=u.prototype_url,
                created_at=u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "",
            )
            for u in raw_updates
        ]

        # 4. Assemble previous reviews summary
        raw_reviews = sorted(project.reviews or [], key=lambda r: r.created_at)
        review_summaries = [
            ProjectReviewSummary(
                reviewer_name=r.reviewer.full_name if r.reviewer else None,
                decision=r.decision.value if hasattr(r.decision, "value") else str(r.decision),
                feedback_text=r.feedback_text,
                created_at=r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            )
            for r in raw_reviews
        ]

        # 5. Extract student lead name
        lead_name = None
        if project.lead_student:
            if hasattr(project.lead_student, "student_profile") and project.lead_student.student_profile:
                lead_name = project.lead_student.student_profile.full_name
            else:
                lead_name = project.lead_student.full_name or project.lead_student.email

        # 6. Build input payload
        problem = project.problem
        review_input = FacultyAIReviewInput(
            project_id=project.id,
            project_title=project.title,
            project_description=project.description,
            project_status=project.status.value if hasattr(project.status, "value") else str(project.status),
            team_name=project.team_name,
            lead_student_name=lead_name,
            repository_url=project.repository_url,
            problem_title=problem.title if problem else "Civic Problem",
            problem_description=problem.description if problem else "",
            problem_category=problem.category if problem else "General",
            problem_location=problem.location if problem else None,
            problem_district=problem.district if problem else None,
            updates=update_summaries,
            previous_reviews=review_summaries,
            member_count=len(project.members) if project.members else 1,
        )

        # 7. Run LangGraph workflow pipeline
        builder = FacultyReviewGraphBuilder(provider=self.provider)
        return await builder.run(review_input)

