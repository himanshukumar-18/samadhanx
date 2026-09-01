import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_profile_and_account_settings(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="profile_user@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(user.id, user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update Account Settings
    settings_res = await async_client.patch(
        "/api/v1/settings/me",
        json={"email_notifications": False, "show_contact": True},
        headers=headers,
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["email_notifications"] is False
    assert settings_res.json()["show_contact"] is True

    # 2. Update Full Profile (LinkedIn / Insta style)
    profile_update = {
        "headline": "AI & Robotics Innovator | SIH 26043",
        "bio": "Passionate about applying deep learning to solve rural water and waste management challenges.",
        "website": "https://samadhanx.in",
        "github_url": "https://github.com/samadhanx",
        "linkedin_url": "https://linkedin.com/in/samadhanx",
        "skills": ["Python", "FastAPI", "React", "PyTorch", "OpenCV"],
        "education": [{"degree": "B.Tech Computer Science", "institution": "IIT Delhi", "year": "2026"}],
    }
    update_res = await async_client.patch("/api/v1/profile/me", json=profile_update, headers=headers)
    assert update_res.status_code == 200
    prof_data = update_res.json()
    assert prof_data["headline"] == profile_update["headline"]
    assert "Python" in prof_data["skills"]

    # 3. View Public Profile
    public_res = await async_client.get(f"/api/v1/profile/user/{user.id}", headers=headers)
    assert public_res.status_code == 200
    assert public_res.json()["bio"] == profile_update["bio"]
