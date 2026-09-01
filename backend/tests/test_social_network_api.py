import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_follow_unfollow_and_shares(async_client: AsyncClient, db_session: AsyncSession):
    # 1. Create User A and User B
    user_a = User(
        email="user_a@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    user_b = User(
        email="user_b@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(user_a)
    db_session.add(user_b)
    await db_session.flush()

    token_a = create_access_token(user_a.id, user_a.role.value)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. User A Follows User B
    follow_res = await async_client.post(f"/api/v1/social/users/{user_b.id}/follow", headers=headers_a)
    assert follow_res.status_code == 200
    assert follow_res.json()["following"] is True

    # 3. Check Connection Stats
    stats_res = await async_client.get(f"/api/v1/social/users/{user_b.id}/stats", headers=headers_a)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["followers_count"] == 1
    assert stats["is_following"] is True

    # 4. Create Problem & Share
    prob_res = await async_client.post(
        "/api/v1/problems",
        json={
            "title": "Solar Powered Water Pump",
            "description": "Solar irrigation system for small farmers in dry regions.",
            "category": "Clean Energy",
            "location": "Jodhpur",
            "district": "Jodhpur",
            "state": "Rajasthan",
        },
        headers=headers_a,
    )
    problem_id = prob_res.json()["id"]

    share_res = await async_client.post(
        f"/api/v1/social/problems/{problem_id}/share",
        json={"platform": "linkedin"},
        headers=headers_a,
    )
    assert share_res.status_code == 200
    assert share_res.json()["shares_count"] == 1

    # 5. Unfollow
    unfollow_res = await async_client.delete(f"/api/v1/social/users/{user_b.id}/unfollow", headers=headers_a)
    assert unfollow_res.status_code == 200
    assert unfollow_res.json()["unfollowed"] is True
