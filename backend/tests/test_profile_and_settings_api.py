import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import ProblemStatus, UserRole
from app.models.problem import Problem
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

    # 2. Update Full Profile
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


@pytest.mark.asyncio
async def test_citizen_profile_validation_and_stats(async_client: AsyncClient, db_session: AsyncSession):
    citizen = User(
        email="citizen_test@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(citizen)
    await db_session.flush()

    # Seed problems for stats assert
    p1 = Problem(
        title="Pothole in Ward 12",
        description="Dangerous pothole near school zone",
        category="Infrastructure",
        state="Delhi",
        district="Central",
        location="Ward 12 Main St",
        latitude=28.6139,
        longitude=77.2090,
        status=ProblemStatus.SUBMITTED,
        created_by_id=citizen.id,
    )
    p2 = Problem(
        title="Streetlight Failure",
        description="Broken lamp post",
        category="Electricity",
        state="Delhi",
        district="Central",
        location="Sector 4",
        latitude=28.6140,
        longitude=77.2091,
        status=ProblemStatus.VERIFIED,
        created_by_id=citizen.id,
    )
    db_session.add_all([p1, p2])
    await db_session.flush()

    token = create_access_token(citizen.id, citizen.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Test 1: Valid Citizen Update
    valid_update = {
        "headline": "Civic Rights Activist",
        "bio": "Working to improve civic infrastructure.",
        "website_url": "https://mycivicblog.org",
        "github_url": "https://github.com/mycivic",
        "linkedin_url": "https://linkedin.com/in/mycivic",
    }
    res = await async_client.patch("/api/v1/profile/me", json=valid_update, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["headline"] == "Civic Rights Activist"
    assert data["bio"] == "Working to improve civic infrastructure."
    assert data["stats"]["problems_submitted"] == 2
    assert data["stats"]["problems_pending"] == 1
    assert data["stats"]["problems_approved"] == 1

    # Test 2: Invalid URL validation
    invalid_url_res = await async_client.patch(
        "/api/v1/profile/me",
        json={"website_url": "not-a-valid-url"},
        headers=headers,
    )
    assert invalid_url_res.status_code == 422
    err_body = invalid_url_res.json()
    err_code = err_body.get("error", {}).get("code") or err_body.get("detail", {}).get("code")
    assert err_code == "INVALID_PROFILE_URL"

    # Test 3: Privilege escalation injection (role: "admin")
    privilege_res = await async_client.patch(
        "/api/v1/profile/me",
        json={"role": "admin", "headline": "Hacker"},
        headers=headers,
    )
    assert privilege_res.status_code == 422
    # Confirm role unchanged in DB
    get_res = await async_client.get("/api/v1/profile/me", headers=headers)
    assert get_res.json()["role"] == "citizen"

    # Test 4: Partial Update (only headline)
    partial_res = await async_client.patch(
        "/api/v1/profile/me",
        json={"headline": "Updated Headline Only"},
        headers=headers,
    )
    assert partial_res.status_code == 200
    partial_data = partial_res.json()
    assert partial_data["headline"] == "Updated Headline Only"
    assert partial_data["bio"] == "Working to improve civic infrastructure."
