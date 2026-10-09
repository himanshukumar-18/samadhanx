"""Safe structured logging for the AI Engine."""

import logging
import json
from typing import Any

logger = logging.getLogger("samadhanx.ai_engine")


def log_ai_event(
    event_type: str,
    problem_id: str | None = None,
    status: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    duration_ms: int | None = None,
    recommendation: str | None = None,
    error: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Safely log an AI engine lifecycle event with structured JSON metadata."""
    payload: dict[str, Any] = {
        "event": event_type,
        "problem_id": problem_id,
        "status": status,
        "provider": provider,
        "model": model,
        "duration_ms": duration_ms,
        "recommendation": recommendation,
        "error": error,
    }
    if extra:
        payload["extra"] = extra

    # Filter None keys
    clean_payload = {k: v for k, v in payload.items() if v is not None}

    if error:
        logger.error(f"[AI_ENGINE] {json.dumps(clean_payload)}")
    else:
        logger.info(f"[AI_ENGINE] {json.dumps(clean_payload)}")
