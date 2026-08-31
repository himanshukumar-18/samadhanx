import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RequestStatus
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User


@pytest.mark.asyncio
async def test_register_citizen_success(async_client: AsyncClient, db_session: AsyncSession):
    payload = {
        "email": "citizen1@example.com",
        "password": "Password123!",
        "full_name": "Ramesh Kumar",
        "phone_number": "9876543210",
        "location": "Ward 12, Ranchi",
        "district": "Ranchi",
        "state": "Jharkhand",
    }
    response = await async_client.post("/api/v1/auth/register/citizen", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["email"] == "citizen1@example.com"
    assert res_data["data"]["role"] == "citizen"

    # Verify user in database
    user = (await db_session.execute(select(User).where(User.email == "citizen1@example.com"))).scalar_one_or_none()
    assert user is not None
    assert user.is_verified is False
    assert user.is_approved is True

@pytest.mark.asyncio
async def test_register_student_with_approved_university(
    async_client: AsyncClient, seed_approved_university
):
    _, univ_prof = seed_approved_university
    payload = {
        "email": "student1@iitd.ac.in",
        "password": "Password123!",
        "full_name": "Aman Verma",
        "university_id": str(univ_prof.id),
        "department": "Computer Science",
        "graduation_year": 2026,
        "skills": ["Python", "FastAPI", "React"],
    }
    response = await async_client.post("/api/v1/auth/register/student", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["role"] == "student"

@pytest.mark.asyncio
async def test_register_student_invalid_university_fails(async_client: AsyncClient):
    import uuid
    payload = {
        "email": "student_invalid@example.com",
        "password": "Password123!",
        "full_name": "Invalid Student",
        "university_id": str(uuid.uuid4()),
        "department": "IT",
    }
    response = await async_client.post("/api/v1/auth/register/student", json=payload)
    assert response.status_code == 400
    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "INVALID_UNIVERSITY"

@pytest.mark.asyncio
async def test_register_university_request_creates_pending(
    async_client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "email": "vc@bitmesra.ac.in",
        "password": "Password123!",
        "university_name": "Birla Institute of Technology Mesra",
        "aishe_code": "U-0210",
        "state": "Jharkhand",
        "district": "Ranchi",
        "nodal_officer_name": "Dr. Dean Academic",
        "official_email": "dean@bitmesra.ac.in",
    }
    response = await async_client.post("/api/v1/auth/register/university-request", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["status"] == "pending_approval"

    req = (await db_session.execute(select(RestrictedAccountRequest).where(RestrictedAccountRequest.org_name == "Birla Institute of Technology Mesra"))).scalar_one_or_none()
    assert req is not None
    assert req.status == RequestStatus.PENDING
