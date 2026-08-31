import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import OTPVerification
from app.models.user import User


@pytest.mark.asyncio
async def test_full_admin_university_faculty_approval_chain(
    async_client: AsyncClient, seed_admin: User, db_session: AsyncSession
):
    # 1. University registers request
    univ_payload = {
        "email": "vc@iitb.ac.in",
        "password": "Password123!",
        "university_name": "IIT Bombay",
        "aishe_code": "U-0012",
        "state": "Maharashtra",
        "district": "Mumbai",
        "nodal_officer_name": "Prof. Dean R&D",
        "official_email": "dean.rd@iitb.ac.in",
    }
    reg_res = await async_client.post("/api/v1/auth/register/university-request", json=univ_payload)
    assert reg_res.status_code == 200

    # 2. Verify OTP for University
    otp_record = (
        await db_session.execute(
            select(OTPVerification).where(OTPVerification.email == "vc@iitb.ac.in")
        )
    ).scalars().first()
    assert otp_record is not None

    otp_res = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "vc@iitb.ac.in", "otp_code": otp_record.otp_code, "purpose": "registration"},
    )
    assert otp_res.status_code == 200

    # 3. University attempts to login -> Fails (Pending Approval)
    login_attempt = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "vc@iitb.ac.in", "password": "Password123!"},
    )
    assert login_attempt.status_code == 403
    assert login_attempt.json()["error"]["code"] == "ACCOUNT_PENDING_APPROVAL"

    # 4. Admin logs in
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@samadhanx.gov.in", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 5. Admin lists pending requests
    requests_res = await async_client.get("/api/v1/admin/requests?status_filter=pending", headers=admin_headers)
    assert requests_res.status_code == 200
    requests_list = requests_res.json()["data"]
    assert len(requests_list) >= 1
    target_req_id = requests_list[0]["id"]

    # 6. Admin approves University request
    approve_res = await async_client.patch(f"/api/v1/admin/requests/{target_req_id}/approve", headers=admin_headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["data"]["status"] == "approved"

    # 7. University logs in successfully
    univ_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "vc@iitb.ac.in", "password": "Password123!"},
    )
    assert univ_login.status_code == 200
    univ_token = univ_login.json()["data"]["access_token"]
    univ_headers = {"Authorization": f"Bearer {univ_token}"}

    # 8. Approved University creates a Faculty account
    faculty_payload = {
        "email": "faculty.water@iitb.ac.in",
        "password": "FacultyPass123!",
        "full_name": "Dr. Aniruddh Roy",
        "department": "Civil & Environmental Engineering",
        "designation": "Associate Professor",
        "research_areas": ["Membrane Desalination", "Fluoride Sensors"],
    }
    fac_res = await async_client.post("/api/v1/university/faculty", json=faculty_payload, headers=univ_headers)
    assert fac_res.status_code == 200
    assert fac_res.json()["data"]["role"] == "faculty"

    # 9. Faculty logs in successfully
    fac_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "faculty.water@iitb.ac.in", "password": "FacultyPass123!"},
    )
    assert fac_login.status_code == 200
    assert fac_login.json()["data"]["role"] == "faculty"
