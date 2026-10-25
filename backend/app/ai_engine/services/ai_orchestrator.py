"""Decoupled AI Engine Orchestrator and service facade for the SamadhanX platform."""

import datetime
import uuid
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import AIAnalysisStatus, AIModerationRecommendation, UserRole
from app.models.problem import Problem
from app.models.problem_ai_analysis import ProblemAIAnalysis
from app.models.user import User
from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.exceptions import AIError
from app.ai_engine.observability.logging import log_ai_event
from app.ai_engine.prompts.moderation import MODERATION_PROMPT_VERSION
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.common import ProblemAnalysisInput
from app.ai_engine.services.moderation_service import AIModerationService
from app.ai_engine.services.embedder import EmbedderService


class AIOrchestrator:
    """Public facade managing AI analysis lifecycle, persistence, and audit logging."""

    @staticmethod
    async def get_latest_analysis(db: AsyncSession, problem_id: uuid.UUID) -> ProblemAIAnalysis | None:
        """Fetch the most recent AI analysis record for a given problem."""
        stmt = (
            select(ProblemAIAnalysis)
            .where(ProblemAIAnalysis.problem_id == problem_id)
            .order_by(desc(ProblemAIAnalysis.analysis_version))
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_analysis_history(db: AsyncSession, problem_id: uuid.UUID) -> list[ProblemAIAnalysis]:
        """Fetch all historical AI analysis versions for a problem."""
        stmt = (
            select(ProblemAIAnalysis)
            .where(ProblemAIAnalysis.problem_id == problem_id)
            .order_by(desc(ProblemAIAnalysis.analysis_version))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def analyze_problem_moderation(
        db: AsyncSession,
        problem_id: uuid.UUID,
        triggered_by_id: uuid.UUID | None = None,
        provider: ModelProvider | None = None,
        trigger: str = "auto_submission",
    ) -> ProblemAIAnalysis:
        """Execute AI moderation analysis pipeline on a problem and persist the result."""
        settings = get_ai_settings()

        # 1. Fetch target problem
        prob_stmt = select(Problem).where(Problem.id == problem_id)
        prob_res = await db.execute(prob_stmt)
        problem = prob_res.scalar_one_or_none()

        if not problem:
            raise ValueError(f"Problem with ID {problem_id} does not exist.")

        # 2. Determine next analysis version
        latest = await AIOrchestrator.get_latest_analysis(db, problem_id)
        next_version = (latest.analysis_version + 1) if latest else 1

        active_provider = provider or get_model_provider(settings)

        # 3. Create initial RUNNING record with started_at and trigger
        analysis = ProblemAIAnalysis(
            id=uuid.uuid4(),
            problem_id=problem.id,
            analysis_version=next_version,
            status=AIAnalysisStatus.RUNNING,
            provider=active_provider.provider_name,
            model_name=active_provider.model_name,
            prompt_version=MODERATION_PROMPT_VERSION,
            triggered_by_id=triggered_by_id,
            trigger=trigger,
            started_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)

        # 4. Prepare input container
        input_data = ProblemAnalysisInput(
            problem_id=problem.id,
            title=problem.title,
            description=problem.description,
            original_category=problem.category,
            district=problem.district,
            state=problem.state,
            author_id=problem.created_by_id,
        )
        content_hash = EmbedderService.compute_hash(
            EmbedderService.normalize_text(problem.title, problem.description)
        )
        analysis.content_hash = content_hash

        # 5. Run moderation pipeline
        moderation_service = AIModerationService(provider=active_provider)

        try:
            output, telemetry, raw_sanitized = await moderation_service.run_moderation(input_data)

            # 6. Update analysis record with completed results
            analysis.status = AIAnalysisStatus.COMPLETED
            analysis.category = output.category
            analysis.subcategory = output.subcategory
            analysis.summary = output.summary
            analysis.keywords = output.keywords
            analysis.spam_probability = output.spam_probability
            analysis.spam_reasons = output.spam_reasons
            analysis.quality_score = output.quality_score
            analysis.confidence = output.confidence
            analysis.risk_flags = [f.model_dump() for f in output.risk_flags]
            analysis.recommendation = output.recommendation
            analysis.reason = output.reason
            analysis.raw_sanitized_input = raw_sanitized
            analysis.duration_ms = telemetry.get("duration_ms")
            analysis.completed_at = datetime.datetime.now(datetime.timezone.utc)

            # 7. Update Problem ai_insight field for backward compatibility
            problem.ai_insight = {
                "summary": output.summary,
                "category": output.category,
                "subcategory": output.subcategory,
                "confidenceScore": output.confidence,
                "spamProbability": output.spam_probability,
                "qualityScore": output.quality_score,
                "recommendation": output.recommendation.value,
                "requiredSkills": output.keywords[:4] if output.keywords else [output.category],
                "analysisId": str(analysis.id),
                "analyzedAt": analysis.completed_at.isoformat(),
            }

            await db.commit()
            await db.refresh(analysis)
            return analysis

        except AIError as e:
            analysis.status = AIAnalysisStatus.FAILED
            analysis.error_code = e.code
            analysis.error_message = e.message
            analysis.completed_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            await db.refresh(analysis)
            return analysis

        except Exception as e:
            analysis.status = AIAnalysisStatus.FAILED
            analysis.error_code = "UNEXPECTED_FAILURE"
            analysis.error_message = str(e)
            analysis.completed_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            await db.refresh(analysis)
            return analysis

    @staticmethod
    async def generate_or_return_cached(
        db: AsyncSession,
        problem_id: uuid.UUID,
        triggered_by_id: uuid.UUID | None = None,
        cooldown_secs: int = 60,
        force: bool = False,
        provider: ModelProvider | None = None,
    ) -> tuple["ProblemAIAnalysis", bool]:
        """Generate AI analysis or return cached result if valid and within cooldown.

        Honors AI_CACHE_MODE:
        - 'disabled': Always invokes live provider
        - 'read_through': Returns valid non-fake completed result if fresh
        - 'refresh': Bypasses cache and generates fresh analysis

        Returns:
            (analysis, was_cached): was_cached=True means cached result was returned.
        """
        settings = get_ai_settings()
        bypass_cache = force or settings.cache_mode in ("disabled", "refresh")

        if not bypass_cache:
            latest = await AIOrchestrator.get_latest_analysis(db, problem_id)
            problem_result = await db.execute(select(Problem).where(Problem.id == problem_id))
            current_problem = problem_result.scalar_one_or_none()
            current_hash = (
                EmbedderService.compute_hash(
                    EmbedderService.normalize_text(current_problem.title, current_problem.description)
                )
                if current_problem
                else None
            )
            # In production, never return an obsolete fake analysis as a cached result
            allow_cached = (
                latest is not None
                and latest.status == AIAnalysisStatus.COMPLETED
                and latest.completed_at is not None
                and latest.content_hash == current_hash
                and (
                    (settings.provider == "fake" and latest.provider in ("fake", "fake-model"))
                    or (settings.provider == "groq" and latest.provider not in ("fake", "fake-model", ""))
                )
            )
            if allow_cached:
                completed_at = latest.completed_at
                if completed_at.tzinfo is None:
                    completed_at = completed_at.replace(tzinfo=datetime.timezone.utc)
                elapsed = (
                    datetime.datetime.now(datetime.timezone.utc) - completed_at
                ).total_seconds()
                if elapsed < cooldown_secs:
                    if settings.debug:
                        log_ai_event("AI_CACHE_HIT", problem_id=str(problem_id), model=latest.model_name, extra={"version": latest.analysis_version})
                    return latest, True

        if settings.debug:
            log_ai_event("AI_CACHE_MISS", problem_id=str(problem_id), extra={"force": bypass_cache})

        analysis = await AIOrchestrator.analyze_problem_moderation(
            db=db,
            problem_id=problem_id,
            triggered_by_id=triggered_by_id,
            provider=provider,
            trigger="manual_reanalysis" if force else "manual_generate",
        )
        return analysis, False

    @staticmethod
    async def reanalyze_problem(
        db: AsyncSession,
        problem_id: uuid.UUID,
        admin_user: User,
        force: bool = False,
        reason: str | None = None,
        provider: ModelProvider | None = None,
    ) -> "ProblemAIAnalysis":
        """Admin-triggered force re-analysis of an existing problem (ignores cache)."""
        if admin_user.role != UserRole.ADMIN:
            raise PermissionError("Only platform administrators can trigger AI re-analysis.")

        # Always forces a fresh run
        analysis = await AIOrchestrator.analyze_problem_moderation(
            db=db,
            problem_id=problem_id,
            triggered_by_id=admin_user.id,
            provider=provider,
            trigger="manual_reanalysis",
        )

        # Audit log
        audit = AuditLog(
            actor_id=admin_user.id,
            action="AI_REANALYSIS_TRIGGERED",
            target_type="problem_ai_analysis",
            target_id=str(problem_id),
            metadata_json={
                "admin_email": admin_user.email,
                "analysis_id": str(analysis.id),
                "analysis_version": analysis.analysis_version,
                "reason": reason or "Admin manual re-evaluation",
                "status": analysis.status.value,
                "recommendation": analysis.recommendation.value if analysis.recommendation else None,
            },
        )
        db.add(audit)
        await db.commit()

        return analysis
