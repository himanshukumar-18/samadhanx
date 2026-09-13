import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import NotificationType, ProjectStatus, ReviewDecision, UserRole
from app.models.project_review import ProjectReview
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.review_repository import ReviewRepository
from app.schemas.review import ReviewCreate

# State machine: what project status results from each review decision
_REVIEW_STATUS_TRANSITIONS: dict[ReviewDecision, ProjectStatus] = {
    ReviewDecision.APPROVED: ProjectStatus.PILOT,
    ReviewDecision.CHANGES_REQUESTED: ProjectStatus.IN_PROGRESS,
    ReviewDecision.REJECTED: ProjectStatus.REJECTED,
    # PENDING keeps current status (intermediate state, not normally submitted)
}

_DECISION_LABELS: dict[ReviewDecision, str] = {
    ReviewDecision.APPROVED: "✅ Approved",
    ReviewDecision.CHANGES_REQUESTED: "🔁 Revision Required",
    ReviewDecision.REJECTED: "❌ Rejected",
    ReviewDecision.PENDING: "⏳ Pending",
}


class ReviewService:
    def __init__(self, db: AsyncSession):
        self.repo = ReviewRepository(db)
        self.project_repo = ProjectRepository(db)
        self._notif_repo = NotificationRepository(db)

    async def _notify_safe(
        self,
        recipient_id: uuid.UUID,
        title: str,
        message: str,
        notif_type: NotificationType,
        link: str | None = None,
    ) -> None:
        """Fire-and-forget notification; never raises — uses savepoint to protect main transaction."""
        try:
            async with self.project_repo.db.begin_nested():
                await self._notif_repo.create_notification(
                    recipient_id=recipient_id,
                    title=title,
                    message=message,
                    type=notif_type,
                    link=link,
                )
        except Exception:
            pass

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

        # Create review record
        review = await self.repo.create_review(
            project_id=project_id,
            reviewer_id=faculty_user.id,
            decision=data.decision,
            feedback_text=data.feedback_text,
        )

        # ── State machine: update pod status based on review decision ──
        new_status = _REVIEW_STATUS_TRANSITIONS.get(data.decision)
        if new_status is not None:
            project.status = new_status
            await self.project_repo.db.flush()

        # ── Notifications ──
        db = self.project_repo.db
        decision_label = _DECISION_LABELS.get(data.decision, data.decision.value)
        reviewer_name = (
            faculty_user.faculty_profile.full_name
            if (faculty_user.faculty_profile and faculty_user.faculty_profile.full_name)
            else faculty_user.email.split("@")[0]
        )
        pod_link = f"/projects/{project_id}"

        # Notify pod lead
        notif_title = f"Faculty Review: {decision_label}"
        notif_body = (
            f'{reviewer_name} reviewed your pod "{project.title}". '
            f'Decision: {decision_label}. '
            f'Feedback: "{data.feedback_text[:120]}{"..." if len(data.feedback_text) > 120 else ""}"'
        )
        await self._notify_safe(
            recipient_id=project.lead_student_id,
            title=notif_title,
            message=notif_body,
            notif_type=NotificationType.POD_REVIEW_FEEDBACK,
            link=pod_link,
        )

        # Notify all other pod members (not the lead, they already got it)
        if project.members:
            for member in project.members:
                if member.user_id != project.lead_student_id:
                    await self._notify_safe(
                        recipient_id=member.user_id,
                        title=notif_title,
                        message=notif_body,
                        notif_type=NotificationType.POD_REVIEW_FEEDBACK,
                        link=pod_link,
                    )

        # ── Audit log ──
        try:
            async with db.begin_nested():
                audit = AuditLog(
                    actor_id=faculty_user.id,
                    action="FACULTY_REVIEW_SUBMITTED",
                    target_type="solution_project",
                    target_id=str(project_id),
                    metadata_json={
                        "decision": data.decision.value,
                        "new_project_status": new_status.value if new_status else None,
                        "reviewer_name": reviewer_name,
                        "project_title": project.title,
                    },
                )
                db.add(audit)
        except Exception:
            pass

        await db.commit()
        return review

    async def list_reviews(self, project_id: uuid.UUID) -> Sequence[ProjectReview]:
        return await self.repo.list_by_project(project_id)

