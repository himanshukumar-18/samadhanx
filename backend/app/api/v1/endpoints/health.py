import asyncio
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.db.session import async_engine

router = APIRouter(tags=["Health Probes"])


@router.get(
    "/health",
    summary="High-level health check",
    response_model=dict[str, Any],
)
async def health_check() -> dict[str, Any]:
    """Returns high level application status, version, and environment."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get(
    "/health/live",
    summary="Liveness Probe",
    response_model=dict[str, str],
)
async def liveness_probe() -> dict[str, str]:
    """Kubernetes/Docker liveness probe: verifies process is alive."""
    return {
        "status": "live",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get(
    "/health/ready",
    summary="Readiness Probe",
    response_model=dict[str, Any],
)
async def readiness_probe(response: Response) -> dict[str, Any]:
    """Readiness probe: validates actual connectivity to PostgreSQL and Redis."""
    results: dict[str, str] = {
        "database": "disconnected",
        "redis": "disconnected",
    }
    is_ready = True

    # 1. Check PostgreSQL Database
    try:
        async with asyncio.timeout(2.0):
            async with async_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                results["database"] = "connected"
    except Exception as exc:
        results["database"] = f"error: {exc!s}"
        is_ready = False

    # 2. Check Redis
    try:
        async with asyncio.timeout(2.0):
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pong = await r.ping()
            await r.aclose()
            if pong:
                results["redis"] = "connected"
    except Exception as exc:
        results["redis"] = f"error: {exc!s}"
        is_ready = False

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "degraded",
            "checks": results,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    return {
        "status": "ready",
        "checks": results,
        "timestamp": datetime.now(UTC).isoformat(),
    }
