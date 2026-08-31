import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_correlation_id_generation(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert "X-Process-Time-MS" in response.headers


@pytest.mark.asyncio
async def test_correlation_id_propagation(client: AsyncClient) -> None:
    custom_id = "custom-test-req-12345"
    response = await client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in response.headers
