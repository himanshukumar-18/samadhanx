from datetime import UTC, datetime
from typing import Any

from app.celery_app import celery_app
from app.core.logging import logger


@celery_app.task(name="samadhanx.health.ping_task", bind=True)
def ping_task(self: Any, message: str = "ping") -> dict[str, Any]:
    """Simple Celery health check task to verify Redis broker and worker execution."""
    logger.info(f"Celery task [{self.request.id}] executing with message: {message}")
    return {
        "task_id": self.request.id,
        "status": "SUCCESS",
        "message": f"pong: {message}",
        "processed_at": datetime.now(UTC).isoformat(),
        "worker": "celery",
    }
