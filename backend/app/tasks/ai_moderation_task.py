"""Celery background tasks and dispatch helpers for AI Problem Moderation.

Features:
- Duplicate job protection (checks for active RUNNING analysis before dispatch)
- AI_ENABLED guard (skip gracefully when AI is disabled or unconfigured)
- Bounded retries with exponential backoff for transient provider errors
- Rate-limit (429) aware retry: Celery retries with longer delay
- Safe failure: never breaks Problem creation or citizen submission flow
"""

import asyncio
import logging
import uuid
from typing import Any

from app.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger("samadhanx.tasks.ai_moderation")


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=20,
    name="samadhanx.ai.analyze_problem",
)
def analyze_problem_ai_task(
    self,
    problem_id_str: str,
    triggered_by_id_str: str | None = None,
    trigger: str = "auto_submission",
) -> dict[str, Any]:
    """Execute AI moderation analysis for a problem submission in a Celery worker."""

    # Fast guard: skip if AI is globally disabled
    if not getattr(settings, "AI_ENABLED", True) or not getattr(settings, "AI_MODERATION_ENABLED", True):
        logger.info(f"[AI TASK SKIP] AI is disabled; skipping analysis for problem {problem_id_str}")
        return {"problem_id": problem_id_str, "status": "skipped", "reason": "AI disabled"}

    provider_name = getattr(settings, "AI_PROVIDER", "groq").lower()
    api_key = getattr(settings, "effective_ai_api_key", None)
    if provider_name != "fake" and not api_key:
        logger.warning(
            f"[AI TASK SKIP] No AI API key configured (provider={provider_name}). "
            f"Skipping analysis for problem {problem_id_str}."
        )
        return {"problem_id": problem_id_str, "status": "skipped", "reason": "No API key configured"}

    async def _async_run() -> dict[str, Any]:
        from sqlalchemy import select
        from app.db.session import AsyncSessionLocal
        from app.models.enums import AIAnalysisStatus
        from app.models.problem_ai_analysis import ProblemAIAnalysis
        from app.ai_engine.services.ai_orchestrator import AIOrchestrator

        problem_id = uuid.UUID(problem_id_str)
        triggered_by_id = uuid.UUID(triggered_by_id_str) if triggered_by_id_str else None

        async with AsyncSessionLocal() as db:
            # Duplicate active-job guard: skip if another RUNNING analysis exists
            running_stmt = (
                select(ProblemAIAnalysis)
                .where(
                    ProblemAIAnalysis.problem_id == problem_id,
                    ProblemAIAnalysis.status == AIAnalysisStatus.RUNNING,
                )
                .limit(1)
            )
            existing_running = (await db.execute(running_stmt)).scalar_one_or_none()
            if existing_running:
                logger.info(
                    f"[AI TASK DEDUP] Active analysis already running for problem {problem_id_str} "
                    f"(analysis_id={existing_running.id}). Skipping duplicate dispatch."
                )
                return {
                    "problem_id": problem_id_str,
                    "status": "skipped",
                    "reason": "Duplicate active job",
                    "analysis_id": str(existing_running.id),
                }

            analysis = await AIOrchestrator.analyze_problem_moderation(
                db=db,
                problem_id=problem_id,
                triggered_by_id=triggered_by_id,
                trigger=trigger,
            )
            return {
                "analysis_id": str(analysis.id),
                "problem_id": str(analysis.problem_id),
                "status": analysis.status.value,
                "recommendation": analysis.recommendation.value if analysis.recommendation else None,
                "duration_ms": analysis.duration_ms,
            }

    try:
        try:
            return asyncio.run(_async_run())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(_async_run())
            finally:
                loop.close()

    except Exception as exc:
        exc_str = str(exc).lower()
        is_rate_limit = "429" in exc_str or "rate limit" in exc_str or "tpm" in exc_str or "rpm" in exc_str
        is_timeout = "timeout" in exc_str or "timed out" in exc_str

        if is_rate_limit:
            logger.warning(
                f"[AI TASK RATE LIMIT] Groq 429 for problem {problem_id_str}. "
                f"Retrying (attempt {self.request.retries + 1}/{self.max_retries + 1}) with backoff..."
            )
            try:
                raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1)) from exc
            except self.MaxRetriesExceededError:
                pass

        elif is_timeout:
            logger.warning(f"[AI TASK TIMEOUT] Inference timed out for problem {problem_id_str}.")
            try:
                raise self.retry(exc=exc, countdown=10) from exc
            except self.MaxRetriesExceededError:
                pass

        else:
            logger.error(
                f"[AI TASK ERROR] Failed to analyze problem {problem_id_str} "
                f"(attempt {self.request.retries + 1}/{self.max_retries + 1}): {exc}"
            )
            try:
                raise self.retry(exc=exc) from exc
            except self.MaxRetriesExceededError:
                pass

        return {
            "problem_id": problem_id_str,
            "status": "failed",
            "error": "AI analysis failed after retries. Admin can manually moderate.",
        }


def dispatch_ai_moderation_task(
    problem_id: uuid.UUID,
    triggered_by_id: uuid.UUID | None = None,
    trigger: str = "auto_submission",
) -> None:
    """Safely dispatch AI moderation Celery task without blocking or raising on broker errors."""
    try:
        analyze_problem_ai_task.delay(
            problem_id_str=str(problem_id),
            triggered_by_id_str=str(triggered_by_id) if triggered_by_id else None,
            trigger=trigger,
        )
        logger.info(f"[AI TASK DISPATCH] Queued AI analysis for problem {problem_id} (trigger={trigger})")
    except Exception as e:
        logger.warning(
            f"[AI TASK DISPATCH] Could not enqueue to Celery broker (admin can manually trigger): {e}"
        )
