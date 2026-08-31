import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_404_routing_error(async_client: AsyncClient):
    response = await async_client.get("/api/v1/non-existent-endpoint-xyz")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert "error" in data
    assert data["error"]["code"] == "HTTP_ERROR"

@pytest.mark.asyncio
async def test_validation_error_response(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/register/citizen",
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
