import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_citizen_cannot_access_admin_endpoints(
    async_client: AsyncClient, db_session: AsyncSession
):
    citizen = User(
        email="citizen_rbac@example.com",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(citizen)
    await db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "citizen_rbac@example.com", "password": "Pass123!"},
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to hit admin requests endpoint
    res = await async_client.get("/api/v1/admin/requests", headers=headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "ACCESS_DENIED"

@pytest.mark.asyncio
async def test_student_cannot_create_faculty(
    async_client: AsyncClient, db_session: AsyncSession
):
    student = User(
        email="student_rbac@example.com",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student)
    await db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "student_rbac@example.com", "password": "Pass123!"},
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    fac_payload = {
        "email": "fake.fac@example.com",
        "password": "Pass123!",
        "full_name": "Fake Faculty",
        "department": "CS",
        "designation": "Prof",
    }
    res = await async_client.post("/api/v1/university/faculty", json=fac_payload, headers=headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_A_UNIVERSITY"
