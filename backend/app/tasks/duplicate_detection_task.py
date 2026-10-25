"""Celery background tasks for duplicate problem detection and embedding backfills.

Tasks:
- run_duplicate_detection: runs duplicate detection pipeline for newly submitted or updated problems
- backfill_problem_embeddings: batch generates embeddings for existing problems missing them
- dispatch_duplicate_detection_task: safe dispatch helper with try/except
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger("samadhanx.tasks.duplicate_detection")


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="samadhanx.ai.detect_duplicates",
)
def run_duplicate_detection_task(self, problem_id_str: str) -> dict[str, Any]:
    """Execute duplicate detection graph in background worker."""
    if not getattr(settings, "DUPLICATE_DETECTION_ENABLED", True):
        logger.info(f"Duplicate detection disabled; skipping task for {problem_id_str}")
        return {"status": "skipped", "reason": "disabled"}

    async def _async_run() -> dict[str, Any]:
        from app.ai_engine.services.duplicate_service import DuplicateDetectionService
        from app.db.session import AsyncSessionLocal
        from app.models.problem import Problem

        problem_id = uuid.UUID(problem_id_str)
        async with AsyncSessionLocal() as db:
            problem = await db.get(Problem, problem_id)
            if not problem:
                logger.warning(f"Problem {problem_id} not found for duplicate detection")
                return {"status": "error", "reason": "problem_not_found"}

            service = DuplicateDetectionService(db)
            links, degraded = await service.run_moderation_detection(problem, save_links=True)
            return {
                "status": "completed",
                "problem_id": problem_id_str,
                "candidate_count": len(links),
                "degraded": degraded,
            }

    try:
        try:
            return asyncio.run(_async_run())
        except RuntimeError:
            # Celery may close the default event loop after the first task.
            # Fall back to creating a fresh event loop — same pattern as ai_moderation_task.py.
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(_async_run())
            finally:
                loop.close()
    except Exception as exc:
        logger.error(f"Error in duplicate detection task for {problem_id_str}: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc) from exc
        return {"status": "failed", "error": str(exc)}



@celery_app.task(
    bind=True,
    name="samadhanx.ai.backfill_embeddings",
)
def backfill_problem_embeddings_task(self, batch_size: int = 32) -> dict[str, Any]:
    """Batch compute and persist embeddings for problems missing them."""
    async def _async_run() -> dict[str, Any]:
        from sqlalchemy import select

        from app.ai_engine.services.embedder import EmbedderService
        from app.db.session import AsyncSessionLocal
        from app.models.problem import Problem

        processed = 0
        async with AsyncSessionLocal() as db:
            stmt = (
                select(Problem)
                .where(Problem.embedding.is_(None))
                .limit(batch_size)
            )
            result = await db.execute(stmt)
            problems = result.scalars().all()

            if not problems:
                return {"status": "completed", "processed": 0}

            texts = [
                EmbedderService.normalize_text(p.title, p.description)
                for p in problems
            ]
            vecs = EmbedderService.get_embeddings_batch(texts)
            now = datetime.now(UTC)
            model_name = getattr(settings, "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")

            for p, vec, norm_txt in zip(problems, vecs, texts, strict=False):
                p.embedding = vec

                p.embedding_model = model_name
                p.embedding_hash = EmbedderService.compute_hash(norm_txt)
                p.embedding_updated_at = now
                processed += 1

            await db.commit()
            return {"status": "completed", "processed": processed}

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
        logger.error(f"Error during embedding backfill: {exc}")
        return {"status": "failed", "error": str(exc)}


def dispatch_duplicate_detection_task(problem_id: uuid.UUID) -> None:
    """Safe dispatch helper to enqueue duplicate detection task after DB commit."""
    if not getattr(settings, "DUPLICATE_DETECTION_ENABLED", True):
        return

    try:
        run_duplicate_detection_task.delay(str(problem_id))
        logger.info(f"Dispatched duplicate detection task for problem {problem_id}")
    except Exception as exc:
        # Non-blocking fail open: Never let background queue failures impact user request
        logger.warning(f"Failed to enqueue duplicate detection task for {problem_id}: {exc}")
