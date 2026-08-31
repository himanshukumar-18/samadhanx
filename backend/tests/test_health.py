import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_root(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SamadhanX"
    assert "version" in data


@pytest.mark.asyncio
async def test_liveness_probe(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "live"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_probe_structure(client: AsyncClient) -> None:
    response = await client.get("/health/ready")
    # In test environment without external live services, it returns 200 or 503 with structured checks
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert "database" in data["checks"]
    assert "redis" in data["checks"]
