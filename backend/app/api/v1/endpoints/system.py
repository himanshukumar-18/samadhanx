from typing import Any

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.db.session import get_db
from app.tasks.health import ping_task

router = APIRouter(prefix="/system", tags=["System Foundation Verification"])


class CeleryTestRequest(BaseModel):
    message: str = Field(
        default="SamadhanX Foundation Test", description="Test message payload"
    )


class CeleryTestResponse(BaseModel):
    task_id: str
    status: str
    message: str


@router.post(
    "/celery-test",
    response_model=CeleryTestResponse,
    summary="Dispatch a test Celery task",
)
async def trigger_celery_test(request: CeleryTestRequest) -> CeleryTestResponse:
    """Dispatches ping_task to Redis queue and verifies Celery worker pipeline."""
    task = ping_task.delay(message=request.message)
    return CeleryTestResponse(
        task_id=task.id,
        status="DISPATCHED",
        message="Task dispatched to Redis broker",
    )


@router.get(
    "/celery-test/{task_id}",
    summary="Query status of a Celery task",
)
async def get_celery_task_status(task_id: str) -> dict[str, Any]:
    """Queries the Celery result backend for task status and result payload."""
    res = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "state": res.state,
        "ready": res.ready(),
        "successful": res.successful() if res.ready() else None,
        "result": res.result if res.ready() else None,
    }


@router.get(
    "/pgvector-test",
    summary="Verify PostgreSQL pgvector extension and math operations",
)
async def verify_pgvector(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Executes Euclidean (<->) and Cosine (<=>) distance calculations via pgvector."""
    try:
        query = text("""
            SELECT
                ('[1,2,3]'::vector <-> '[4,5,6]'::vector) AS l2_distance,
                ('[1,2,3]'::vector <=> '[4,5,6]'::vector) AS cosine_distance;
        """)
        result = await db.execute(query)
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="pgvector query returned no results",
            )
        return {
            "status": "operational",
            "extension": "pgvector",
            "l2_distance": float(row["l2_distance"]),
            "cosine_distance": float(row["cosine_distance"]),
            "vector_math": "verified",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"pgvector verification failed: {exc!s}",
        ) from exc
