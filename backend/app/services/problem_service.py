import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationType, ProblemStatus, ProjectStatus, RequestStatus, ReviewDecision, UserRole
from app.models.problem import Problem, ProblemComment
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.problem_repository import ProblemRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.problem import (
    CitizenProblemTimelineResponse,
    ImpactReportSummary,
    PodSummary,
    ProblemCreate,
    ProblemUpdate,
    TimelineStage,
)


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
        exclude_statuses: list[ProblemStatus] | None = None,
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
            exclude_statuses=exclude_statuses,
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

    async def get_problem_timeline(self, user: User, problem_id: uuid.UUID) -> CitizenProblemTimelineResponse:
        problem = await self.repo.get_problem_with_timeline_data(problem_id)
        if not problem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PROBLEM_NOT_FOUND", "message": "The requested societal problem does not exist."},
            )

        # BOLA Check: Only the author or Admin can access the detailed timeline
        if problem.created_by_id != user.id and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You are not authorized to view this problem's timeline."},
            )

        # Find primary active pod if any
        pod = problem.projects[0] if problem.projects else None

        timeline: list[TimelineStage] = []

        # 1. Submitted stage
        timeline.append(
            TimelineStage(
                stage="submitted",
                label="Problem Submitted",
                status="completed",
                timestamp=problem.created_at,
                description="Submitted by citizen for nodal verification and campus innovation matching.",
            )
        )

        # 2. Approved / Verified stage
        if problem.status == ProblemStatus.REJECTED:
            timeline.append(
                TimelineStage(
                    stage="approved",
                    label="Submission Rejected",
                    status="rejected",
                    timestamp=problem.updated_at,
                    description="Submission did not meet civic verification guidelines.",
                )
            )
        elif problem.is_verified or problem.status not in [ProblemStatus.SUBMITTED, ProblemStatus.UNDER_REVIEW]:
            timeline.append(
                TimelineStage(
                    stage="approved",
                    label="Approved & Verified by Admin",
                    status="completed",
                    timestamp=problem.updated_at,
                    description="Verified as an active civic priority challenge on the discovery feed.",
                )
            )
        else:
            timeline.append(
                TimelineStage(
                    stage="approved",
                    label="Pending Admin Verification",
                    status="pending",
                    timestamp=None,
                    description="Under initial evaluation by platform administrators.",
                )
            )

        # 3. Picked Up stage
        if pod:
            univ_name = pod.university.university_name if pod.university else "Partner University"
            timeline.append(
                TimelineStage(
                    stage="picked_up",
                    label=f"Picked up by {pod.team_name}",
                    status="completed",
                    timestamp=pod.created_at,
                    description=f"Student solution pod formed at {univ_name} with {len(pod.members)} innovators.",
                )
            )
        else:
            is_active_hunt = problem.is_verified or problem.status == ProblemStatus.VERIFIED
            timeline.append(
                TimelineStage(
                    stage="picked_up",
                    label="Matching with Student Innovation Pods",
                    status="in_progress" if is_active_hunt else "pending",
                    timestamp=None,
                    description="Open for campus engineering teams to adopt and start prototyping.",
                )
            )

        # 4. Faculty Approved stage
        if pod:
            approved_review = next((r for r in pod.reviews if r.decision == ReviewDecision.APPROVED), None)
            if approved_review or pod.status in [ProjectStatus.PILOT, ProjectStatus.COMPLETED]:
                desc = (
                    f'Faculty mentor approved solution: "{approved_review.feedback_text}"'
                    if (approved_review and approved_review.feedback_text)
                    else "Academic review approved by faculty mentor."
                )
                timeline.append(
                    TimelineStage(
                        stage="faculty_approved",
                        label="Solution Approved by Faculty Mentor",
                        status="completed",
                        timestamp=approved_review.created_at if approved_review else pod.updated_at,
                        description=desc,
                    )
                )
            elif pod.status == ProjectStatus.REVIEW:
                timeline.append(
                    TimelineStage(
                        stage="faculty_approved",
                        label="Under Faculty Academic Review",
                        status="in_progress",
                        timestamp=None,
                        description="Team has submitted solution milestones for faculty evaluation.",
                    )
                )
            else:
                timeline.append(
                    TimelineStage(
                        stage="faculty_approved",
                        label="Faculty Academic Review",
                        status="pending",
                        timestamp=None,
                        description="Solution will undergo faculty evaluation upon prototype completion.",
                    )
                )
        else:
            timeline.append(
                TimelineStage(
                    stage="faculty_approved",
                    label="Faculty Academic Review",
                    status="pending",
                    timestamp=None,
                    description="Awaits team formation and prototype submission.",
                )
            )

        # 5. Industry Funded stage (optional)
        if pod:
            approved_support = next((s for s in pod.supports if s.status == RequestStatus.APPROVED), None)
            if approved_support:
                timeline.append(
                    TimelineStage(
                        stage="industry_funded",
                        label=f"Supported by {approved_support.company_name}",
                        status="completed",
                        timestamp=approved_support.created_at,
                        description=f"Corporate backing granted: {approved_support.support_type.replace('_', ' ').title()}.",
                        optional=True,
                    )
                )
            else:
                timeline.append(
                    TimelineStage(
                        stage="industry_funded",
                        label="Industry Backing & Grants",
                        status="pending",
                        timestamp=None,
                        description="Eligible for CSR sponsorship and equipment grants post faculty vetting.",
                        optional=True,
                    )
                )
        else:
            timeline.append(
                TimelineStage(
                    stage="industry_funded",
                    label="Industry Backing & Grants",
                    status="pending",
                    timestamp=None,
                    description="Eligible for CSR sponsorships once solution is established.",
                    optional=True,
                )
            )

        # 6. Completed stage
        if pod and pod.impact_report:
            timeline.append(
                TimelineStage(
                    stage="completed",
                    label="Problem Solved & Impact Report Published",
                    status="completed",
                    timestamp=pod.impact_report.created_at,
                    description=f"Field resolution verified. {pod.impact_report.beneficiaries_reached:,} community members reached.",
                )
            )
        elif problem.status == ProblemStatus.SOLVED or (pod and pod.status == ProjectStatus.COMPLETED):
            timeline.append(
                TimelineStage(
                    stage="completed",
                    label="Problem Solved & Deployed",
                    status="completed",
                    timestamp=pod.updated_at if pod else problem.updated_at,
                    description="Field pilot successfully implemented and verified.",
                )
            )
        else:
            timeline.append(
                TimelineStage(
                    stage="completed",
                    label="Field Resolution & Deployment",
                    status="pending",
                    timestamp=None,
                    description="Final deployment, verification, and societal impact reporting.",
                )
            )

        current_pod_summary = None
        if pod:
            current_pod_summary = PodSummary(
                pod_id=pod.id,
                title=pod.title,
                team_name=pod.team_name,
                progress_percent=pod.progress,
                member_count=len(pod.members),
                university_name=pod.university.university_name if pod.university else None,
                status=pod.status.value,
                repository_url=pod.repository_url,
                created_at=pod.created_at,
            )

        impact_report_summary = None
        if pod and pod.impact_report:
            impact_report_summary = ImpactReportSummary(
                id=pod.impact_report.id,
                beneficiaries_reached=pod.impact_report.beneficiaries_reached,
                outcome_description=pod.impact_report.outcome_description,
                proof_image_urls=pod.impact_report.proof_image_urls or [],
                is_verified=pod.impact_report.is_verified,
                created_at=pod.impact_report.created_at,
            )

        return CitizenProblemTimelineResponse(
            problem_id=problem.id,
            problem_title=problem.title,
            problem_status=problem.status.value,
            is_verified=problem.is_verified,
            created_at=problem.created_at,
            timeline=timeline,
            current_pod=current_pod_summary,
            impact_report=impact_report_summary,
        )

