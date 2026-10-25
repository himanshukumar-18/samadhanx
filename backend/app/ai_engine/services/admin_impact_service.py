"""Service for Admin AI Impact Report Generator.

Gathers database aggregate metrics without N+1 queries, constructs normalized statistics,
runs the LangGraph review pipeline, and persists report history.
"""

from datetime import UTC, datetime, timedelta
import logging
import uuid
from typing import Any
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.graphs.impact_report import AdminImpactReportGraphBuilder
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.schemas.impact_report import (
    AdminImpactActivityItem,
    AdminImpactCategoryItem,
    AdminImpactLocationItem,
    AdminImpactParticipationStats,
    AdminImpactProblemStats,
    AdminImpactProjectStats,
    AdminImpactReportOutput,
    AdminImpactStatistics,
    AdminImpactUserStats,
)
from app.models.admin_impact_report import AdminAIImpactReport
from app.models.audit_log import AuditLog
from app.models.enums import ProblemStatus, ProjectStatus, UserRole
from app.models.problem import Problem
from app.models.project import ProjectMember, SolutionProject
from app.models.project_update import ProjectUpdate
from app.models.user import User

logger = logging.getLogger("samadhanx.ai.admin_impact_service")


class AdminAIImpactService:
    """Service handling platform statistics collection, AI generation, and persistence."""

    def __init__(self, db: AsyncSession, provider: ModelProvider | None = None):
        self.db = db
        self.provider = provider

    async def collect_statistics(
        self,
        period: str = "30d",
        district: str | None = None,
    ) -> AdminImpactStatistics:
        """Collect platform aggregate metrics using optimized SQL queries."""
        # 1. Determine time cutoff
        period_days = {"7d": 7, "30d": 30, "all": None}.get(period)
        cutoff = (datetime.now(UTC) - timedelta(days=period_days)) if period_days else None

        # 2. Build filters
        prob_filter = []
        proj_filter = []
        user_filter = []

        if cutoff:
            prob_filter.append(Problem.created_at >= cutoff)
            proj_filter.append(SolutionProject.created_at >= cutoff)
            user_filter.append(User.created_at >= cutoff)

        if district and district.strip():
            d_clean = district.strip()
            prob_filter.append(Problem.district.ilike(d_clean))

        # 3. User Aggregations (Single group-by query + overall counts)
        user_role_q = select(User.role, func.count(User.id)).group_by(User.role)
        if user_filter:
            user_role_q = user_role_q.where(*user_filter)
        user_role_rows = (await self.db.execute(user_role_q)).all()
        role_map = {row[0]: row[1] for row in user_role_rows}

        total_users_q = select(
            func.count(User.id),
            func.count(User.id).filter(User.is_active.is_(True)),
            func.count(User.id).filter(User.is_verified.is_(True)),
        )
        if user_filter:
            total_users_q = total_users_q.where(*user_filter)
        total_users_row = (await self.db.execute(total_users_q)).one()

        user_stats = AdminImpactUserStats(
            total=total_users_row[0] or 0,
            active_users=total_users_row[1] or 0,
            verified_users=total_users_row[2] or 0,
            citizens=role_map.get(UserRole.CITIZEN, 0),
            students=role_map.get(UserRole.STUDENT, 0),
            faculty=role_map.get(UserRole.FACULTY, 0),
            universities=role_map.get(UserRole.UNIVERSITY, 0),
            industry=role_map.get(UserRole.INDUSTRY, 0),
            admins=role_map.get(UserRole.ADMIN, 0),
        )

        # 4. Problem Aggregations (Single group-by query)
        prob_status_q = select(Problem.status, func.count(Problem.id)).group_by(Problem.status)
        if prob_filter:
            prob_status_q = prob_status_q.where(*prob_filter)
        prob_status_rows = (await self.db.execute(prob_status_q)).all()

        prob_status_map = {
            (row[0].value if hasattr(row[0], "value") else str(row[0])): row[1]
            for row in prob_status_rows
        }

        total_problems = sum(prob_status_map.values())
        approved_problems = sum(
            prob_status_map.get(s, 0)
            for s in ["verified", "in_progress", "solution_submitted", "pilot", "solved"]
        )
        pending_problems = sum(
            prob_status_map.get(s, 0) for s in ["submitted", "under_review"]
        )
        rejected_problems = prob_status_map.get("rejected", 0)
        in_progress_problems = prob_status_map.get("in_progress", 0)
        resolved_problems = prob_status_map.get("solved", 0)

        prob_stats = AdminImpactProblemStats(
            total=total_problems,
            approved=approved_problems,
            pending=pending_problems,
            rejected=rejected_problems,
            in_progress=in_progress_problems,
            resolved=resolved_problems,
            status_breakdown=prob_status_map,
        )

        # 5. Project Aggregations (Single group-by query)
        proj_status_q = select(SolutionProject.status, func.count(SolutionProject.id)).group_by(SolutionProject.status)
        if proj_filter:
            proj_status_q = proj_status_q.where(*proj_filter)
        proj_status_rows = (await self.db.execute(proj_status_q)).all()

        proj_status_map = {
            (row[0].value if hasattr(row[0], "value") else str(row[0])): row[1]
            for row in proj_status_rows
        }

        total_projects = sum(proj_status_map.values())
        active_projects = sum(
            proj_status_map.get(s, 0)
            for s in ["planning", "in_progress", "prototype", "review", "pilot"]
        )
        completed_projects = proj_status_map.get("completed", 0)

        proj_stats = AdminImpactProjectStats(
            total=total_projects,
            active=active_projects,
            completed=completed_projects,
            status_breakdown=proj_status_map,
        )

        # 6. Participation metrics
        # Unique students engaged across projects (lead students + members)
        leads_q = select(SolutionProject.lead_student_id).distinct()
        members_q = select(ProjectMember.user_id).distinct()
        if proj_filter:
            leads_q = leads_q.where(*proj_filter)
            # Members of filtered projects
            proj_ids_subq = select(SolutionProject.id).where(*proj_filter)
            members_q = members_q.where(ProjectMember.project_id.in_(proj_ids_subq))


        leads_res = await self.db.execute(leads_q)
        members_res = await self.db.execute(members_q)
        engaged_student_ids = set(leads_res.scalars().all()) | set(members_res.scalars().all())

        # Updates posted
        updates_q = select(func.count(ProjectUpdate.id))
        if cutoff:
            updates_q = updates_q.where(ProjectUpdate.created_at >= cutoff)
        updates_count = (await self.db.execute(updates_q)).scalar() or 0

        participation_stats = AdminImpactParticipationStats(
            students_engaged=len(engaged_student_ids),
            solutions_submitted=total_projects,
            updates_posted=updates_count,
        )

        # 7. Top Categories (top 8)
        cat_q = select(Problem.category, func.count(Problem.id)).group_by(Problem.category).order_by(func.count(Problem.id).desc()).limit(8)
        if prob_filter:
            cat_q = cat_q.where(*prob_filter)
        cat_rows = (await self.db.execute(cat_q)).all()
        top_categories = [AdminImpactCategoryItem(category=r[0], count=r[1]) for r in cat_rows]

        # 8. Top Locations / Districts (top 8)
        loc_q = select(Problem.district, func.count(Problem.id)).group_by(Problem.district).order_by(func.count(Problem.id).desc()).limit(8)
        if prob_filter:
            loc_q = loc_q.where(*prob_filter)
        loc_rows = (await self.db.execute(loc_q)).all()
        top_locations = [AdminImpactLocationItem(location=r[0], count=r[1]) for r in loc_rows if r[0]]

        # 9. Recent Activity (Audit Log)
        act_q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(8)
        act_res = await self.db.execute(act_q)
        recent_activity_rows = act_res.scalars().all()
        recent_activity = [
            AdminImpactActivityItem(
                action=a.action,
                target_type=a.target_type or "system",
                timestamp=a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
            )
            for a in recent_activity_rows
        ]

        return AdminImpactStatistics(
            users=user_stats,
            problems=prob_stats,
            projects=proj_stats,
            participation=participation_stats,
            top_categories=top_categories,
            top_locations=top_locations,
            recent_activity=recent_activity,
            period=period,
            district=district,
            generated_at=datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
        )

    async def generate_impact_report(
        self,
        current_admin: User,
        period: str = "30d",
        district: str | None = None,
    ) -> tuple[AdminImpactReportOutput, AdminImpactStatistics]:
        """Collect platform statistics, execute AI review graph, and persist the report snapshot."""
        # 1. Collect live verified statistics
        statistics = await self.collect_statistics(period=period, district=district)

        # 2. Run LangGraph pipeline
        builder = AdminImpactReportGraphBuilder(provider=self.provider)
        report = await builder.run(statistics)

        # 3. Persist report record for administrative history
        try:
            db_report = AdminAIImpactReport(
                id=uuid.uuid4(),
                generated_by_id=current_admin.id,
                period=period,
                district=district,
                statistics_snapshot=statistics.model_dump(),
                report_data=report.model_dump(),
            )
            self.db.add(db_report)
            await self.db.commit()
        except Exception as exc:
            logger.warning("Failed to persist AdminAIImpactReport history: %s", exc)
            # Persistence failure should never block returning the generated report to the admin
            await self.db.rollback()

        return report, statistics

    async def get_latest_report(self) -> dict[str, Any] | None:
        """Fetch the most recent persisted impact report."""
        stmt = (
            select(AdminAIImpactReport)
            .order_by(AdminAIImpactReport.created_at.desc())
            .limit(1)
        )
        res = await self.db.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return None

        return {
            "report": record.report_data,
            "statistics": record.statistics_snapshot,
            "generated_at": record.created_at.strftime("%Y-%m-%d %H:%M UTC"),
            "period": record.period,
            "district": record.district,
        }
