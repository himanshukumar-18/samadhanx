import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.public import invalidate_public_universities_cache
from app.models.enums import OrgType, RequestStatus, UserRole
from app.models.profiles import UniversityProfile
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User


@pytest.mark.asyncio
async def test_public_universities_endpoint_no_auth(async_client: AsyncClient, db_session: AsyncSession):
    """Test that GET /api/v1/public/universities is public and returns only approved universities."""
    # 1. Create approved university
    u1 = User(email="approved_univ@test.com", hashed_password="pw", role=UserRole.UNIVERSITY, is_approved=True, is_active=True)
    db_session.add(u1)
    await db_session.flush()

    p1 = UniversityProfile(
        user_id=u1.id,
        university_name="Alpha Approved University",
        state="Delhi",
        district="New Delhi",
        nodal_officer_name="Dr. Alpha",
        official_email="approved_univ@test.com",
        is_approved=True,
    )
    r1 = RestrictedAccountRequest(
        user_id=u1.id,
        org_type=OrgType.UNIVERSITY,
        org_name="Alpha Approved University",
        nodal_officer_name="Dr. Alpha",
        official_email="approved_univ@test.com",
        status=RequestStatus.APPROVED,
    )
    db_session.add_all([p1, r1])

    # 2. Create pending university
    u2 = User(email="pending_univ@test.com", hashed_password="pw", role=UserRole.UNIVERSITY, is_approved=False, is_active=True)
    db_session.add(u2)
    await db_session.flush()

    p2 = UniversityProfile(
        user_id=u2.id,
        university_name="Beta Pending Institute",
        state="Maharashtra",
        district="Mumbai",
        nodal_officer_name="Dr. Beta",
        official_email="pending_univ@test.com",
        is_approved=False,
    )
    r2 = RestrictedAccountRequest(
        user_id=u2.id,
        org_type=OrgType.UNIVERSITY,
        org_name="Beta Pending Institute",
        nodal_officer_name="Dr. Beta",
        official_email="pending_univ@test.com",
        status=RequestStatus.PENDING,
    )
    db_session.add_all([p2, r2])

    # 3. Create rejected university
    u3 = User(email="rejected_univ@test.com", hashed_password="pw", role=UserRole.UNIVERSITY, is_approved=False, is_active=True)
    db_session.add(u3)
    await db_session.flush()

    p3 = UniversityProfile(
        user_id=u3.id,
        university_name="Gamma Rejected College",
        state="Karnataka",
        district="Bengaluru",
        nodal_officer_name="Dr. Gamma",
        official_email="rejected_univ@test.com",
        is_approved=False,
    )
    r3 = RestrictedAccountRequest(
        user_id=u3.id,
        org_type=OrgType.UNIVERSITY,
        org_name="Gamma Rejected College",
        nodal_officer_name="Dr. Gamma",
        official_email="rejected_univ@test.com",
        status=RequestStatus.REJECTED,
        rejection_reason="Invalid credentials",
    )
    db_session.add_all([p3, r3])

    await db_session.commit()

    # Clear cache before test
    invalidate_public_universities_cache()

    # Make unauthenticated API call
    response = await async_client.get("/api/v1/public/universities")

    assert response.status_code == 200
    res_json = response.json()

    assert res_json["success"] is True
    data = res_json["data"]

    # Verify only approved university appears
    names = [item["name"] for item in data]
    assert "Alpha Approved University" in names
    assert "Beta Pending Institute" not in names
    assert "Gamma Rejected College" not in names

    # Verify exact response shape (minimal public fields only, no email or internal status)
    item = next(i for i in data if i["name"] == "Alpha Approved University")
    assert "id" in item
    assert item["city"] == "New Delhi"
    assert item["state"] == "Delhi"
    assert "official_email" not in item
    assert "status" not in item
    assert "rejection_reason" not in item
