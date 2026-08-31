import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_root(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "healthy"]
    assert "version" in data

@pytest.mark.asyncio
async def test_liveness_probe(async_client: AsyncClient):
    response = await async_client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "live"

@pytest.mark.asyncio
async def test_readiness_probe_structure(async_client: AsyncClient):
    response = await async_client.get("/health/ready")
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "checks" in data
