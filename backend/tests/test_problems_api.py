import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_problem_creation_and_listing(async_client: AsyncClient, db_session: AsyncSession):
    citizen = User(
        email="citizen_test@samadhanx.in",
        hashed_password=get_password_hash("CitizenPass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(citizen)
    await db_session.flush()

    token = create_access_token(citizen.id, citizen.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Problem
    payload = {
        "title": "Clean Drinking Water Initiative",
        "description": "Providing solar-powered water filtration units to rural schools in Varanasi district.",
        "category": "Water & Sanitation",
        "location": "Varanasi Block A",
        "district": "Varanasi",
        "state": "Uttar Pradesh",
        "impact_level": "high",
        "tags": ["water", "solar", "clean-tech"],
    }
    response = await async_client.post("/api/v1/problems", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["category"] == payload["category"]
    assert data["status"] == "submitted"
    problem_id = data["id"]

    # 2. List Problems
    list_res = await async_client.get("/api/v1/problems?category=Water%20%26%20Sanitation")
    assert list_res.status_code == 200
    problems = list_res.json()
    assert len(problems) >= 1
    assert problems[0]["id"] == problem_id

    # 3. Add Comment
    comment_res = await async_client.post(
        f"/api/v1/problems/{problem_id}/comments",
        json={"content": "Great initiative! Solar filtration works very well here."},
        headers=headers,
    )
    assert comment_res.status_code == 201
    comment_data = comment_res.json()
    assert comment_data["content"] == "Great initiative! Solar filtration works very well here."

    # 4. Toggle Endorsement
    endorse_res = await async_client.post(f"/api/v1/problems/{problem_id}/endorse", headers=headers)
    assert endorse_res.status_code == 200
    assert endorse_res.json()["endorsed"] is True
