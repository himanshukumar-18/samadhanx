import pytest
from httpx import AsyncClient

from app.core.exceptions import (
    DatabaseError,
    NotFoundError,
    ServiceUnavailableError,
    ValidationError,
)


@pytest.mark.asyncio
async def test_custom_app_exceptions() -> None:
    not_found = NotFoundError("Problem not found")
    assert not_found.status_code == 404
    assert not_found.code == "NOT_FOUND"

    val_err = ValidationError("Field missing")
    assert val_err.status_code == 422
    assert val_err.code == "VALIDATION_ERROR"

    db_err = DatabaseError("Connection timeout")
    assert db_err.status_code == 500
    assert db_err.code == "DATABASE_ERROR"

    svc_err = ServiceUnavailableError("Redis down")
    assert svc_err.status_code == 503
    assert svc_err.code == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_404_routing_error(client: AsyncClient) -> None:
    response = await client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_validation_error_response(client: AsyncClient) -> None:
    # Trigger validation error on POST /api/v1/system/celery-test with invalid body type
    response = await client.post("/api/v1/system/celery-test", json={"message": 12345})
    # Pydantic may coerce int to str or validate: let's test invalid json payload
    response = await client.post(
        "/api/v1/system/celery-test",
        content="invalid json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "request_id" in data["error"]
