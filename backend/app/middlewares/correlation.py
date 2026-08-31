import time
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import correlation_id_ctx, logger


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Injects and propagates X-Request-ID on every incoming and outgoing HTTP request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract or generate correlation ID
        request_id = (
            request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:12]}"
        )

        # Set context variable for structured logging
        token = correlation_id_ctx.set(request_id)
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Attach correlation ID and processing duration headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time-MS"] = str(process_time_ms)

            if request.url.path not in ("/health/live", "/health/ready"):
                logger.info(
                    f"{request.method} {request.url.path} -> {response.status_code} ({process_time_ms}ms)"
                )
            return response
        finally:
            correlation_id_ctx.reset(token)
