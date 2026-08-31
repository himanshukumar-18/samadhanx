import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_correlation_id_generation(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0

@pytest.mark.asyncio
async def test_correlation_id_propagation(async_client: AsyncClient):
    custom_id = "test-correlation-uuid-12345"
    response = await async_client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.headers["X-Request-ID"] == custom_id

@pytest.mark.asyncio
async def test_security_headers_present(async_client: AsyncClient):
    response = await async_client.get("/health")
    headers = response.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
