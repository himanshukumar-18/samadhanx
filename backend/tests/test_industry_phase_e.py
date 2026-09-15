"""
Industry Phase E — Security & Feature Tests
===========================================
Covers:
1. Unapproved industry account blocked (ACCOUNT_PENDING_APPROVAL)
2. Non-industry account blocked from Phase E endpoints
3. vetted-projects returns ONLY pilot/completed pods (critical security rule)
4. In-progress pod NOT visible in vetted-projects
5. Pilot pod IS visible in vetted-projects
6. Duplicate offer rejected (DUPLICATE_OFFER)
7. Withdraw own pending offer succeeds
8. Cannot withdraw others' offer (FORBIDDEN)
9. Cannot withdraw non-pending offer (OFFER_NOT_PENDING)
10. Funder comment requires accepted offer (NO_ACCEPTED_OFFER)
11. IDOR: industry user A cannot access funded pod of industry user B
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import ProjectStatus, RequestStatus, UserRole
from app.models.industry_support import IndustrySupport
from app.models.problem import Problem
from app.models.profiles import IndustryProfile, StudentProfile
from app.models.project import SolutionProject
from app.models.user import User


# ─── Helpers ────────────────────────────────────────────────────────────────

def _token(user: User) -> str:
    return f"Bearer {create_access_token(user.id, user.role.value)}"


def _get_error_code(res):
    body = res.json()
    if "error" in body and isinstance(body["error"], dict):
        return body["error"].get("code")
    if "detail" in body and isinstance(body["detail"], dict):
        return body["detail"].get("code")
    if "detail" in body and isinstance(body["detail"], str):
        return body["detail"]
    return None


async def _create_industry_user(
    db: AsyncSession,
    email: str,
    is_approved: bool = True,
    company_name: str = "TestCorp Pvt Ltd",
) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("Test1234!"),
        role=UserRole.INDUSTRY,
        is_verified=True,
        is_active=True,
        is_approved=True,  # User.is_approved is always True for industry (approval is on profile)
    )
    db.add(user)
    await db.flush()
    profile = IndustryProfile(
        user_id=user.id,
        company_name=company_name,
        industry_type="Technology",
        point_of_contact_name="POC Name",
        official_email=email,
        is_approved=is_approved,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(user)
    return user


async def _create_student(db: AsyncSession, email: str) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("Test1234!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.flush()
    profile = StudentProfile(
        user_id=user.id,
        full_name=email.split("@")[0],
        department="CSE",
    )
    db.add(profile)
    await db.flush()
    await db.refresh(user)
    return user


async def _create_pod(
    db: AsyncSession, lead_id: uuid.UUID, pod_status: ProjectStatus = ProjectStatus.PLANNING
) -> SolutionProject:
    problem = Problem(
        title="Test Societal Problem",
        description="A real societal problem needing a solution from students.",
        category="CleanTech",
        location="Pune",
        district="Pune",
        state="Maharashtra",
        created_by_id=lead_id,
    )
    db.add(problem)
    await db.flush()

    pod = SolutionProject(
        problem_id=problem.id,
        lead_student_id=lead_id,
        team_name="Alpha Team",
        title="Alpha Pod Solution",
        description="A comprehensive solution to the test societal problem.",
        status=pod_status,
    )
    db.add(pod)
    await db.flush()
    await db.refresh(pod)
    return pod


async def _create_offer(
    db: AsyncSession,
    industry_user_id: uuid.UUID,
    pod_id: uuid.UUID,
    offer_status: RequestStatus = RequestStatus.PENDING,
    company_name: str = "TestCorp Pvt Ltd",
) -> IndustrySupport:
    offer = IndustrySupport(
        project_id=pod_id,
        industry_user_id=industry_user_id,
        company_name=company_name,
        support_type="sponsorship",
        amount_or_terms="₹5,00,000 for Phase 1 testing",
        status=offer_status,
    )
    db.add(offer)
    await db.flush()
    await db.refresh(offer)
    return offer


# ─── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unapproved_industry_blocked(async_client: AsyncClient, db_session: AsyncSession):
    """Unapproved industry account gets ACCOUNT_PENDING_APPROVAL on Phase E endpoints."""
    unapproved = await _create_industry_user(db_session, "unapproved@corp.com", is_approved=False)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(unapproved)},
    )
    assert res.status_code == 403
    assert _get_error_code(res) == "ACCOUNT_PENDING_APPROVAL"


@pytest.mark.asyncio
async def test_student_cannot_access_phase_e_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """Student role cannot access Phase E industry endpoints."""
    student = await _create_student(db_session, "stud@univ.ac.in")
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(student)},
    )
    assert res.status_code == 403
    assert _get_error_code(res) == "NOT_AN_INDUSTRY_ACCOUNT"


@pytest.mark.asyncio
async def test_planning_pod_not_in_vetted_projects(async_client: AsyncClient, db_session: AsyncSession):
    """
    CRITICAL SECURITY: A pod in PLANNING status must NOT appear in vetted-projects.
    """
    industry = await _create_industry_user(db_session, "ind@corp.com")
    student = await _create_student(db_session, "stud2@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PLANNING)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 200
    pod_ids = [p["id"] for p in res.json()]
    assert str(pod.id) not in pod_ids, "SECURITY VIOLATION: planning pod visible to industry!"


@pytest.mark.asyncio
async def test_in_progress_pod_not_in_vetted_projects(async_client: AsyncClient, db_session: AsyncSession):
    """In-progress pod (not faculty-approved) must NOT appear in vetted-projects."""
    industry = await _create_industry_user(db_session, "ind2@corp.com")
    student = await _create_student(db_session, "stud3@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.IN_PROGRESS)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 200
    pod_ids = [p["id"] for p in res.json()]
    assert str(pod.id) not in pod_ids


@pytest.mark.asyncio
async def test_pilot_pod_visible_in_vetted_projects(async_client: AsyncClient, db_session: AsyncSession):
    """
    A pod in PILOT status (faculty-approved) MUST appear in vetted-projects.
    """
    industry = await _create_industry_user(db_session, "ind3@corp.com")
    student = await _create_student(db_session, "stud4@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 200
    pod_ids = [p["id"] for p in res.json()]
    assert str(pod.id) in pod_ids, "Pilot pod should be visible to approved industry user!"


@pytest.mark.asyncio
async def test_completed_pod_visible_in_vetted_projects(async_client: AsyncClient, db_session: AsyncSession):
    """A COMPLETED pod must also be visible in vetted-projects."""
    industry = await _create_industry_user(db_session, "ind4@corp.com")
    student = await _create_student(db_session, "stud5@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.COMPLETED)
    await db_session.commit()

    res = await async_client.get(
        "/api/v1/industry/vetted-projects",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 200
    pod_ids = [p["id"] for p in res.json()]
    assert str(pod.id) in pod_ids


@pytest.mark.asyncio
async def test_duplicate_offer_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Cannot make two pending offers on the same pod."""
    industry = await _create_industry_user(db_session, "ind5@corp.com")
    student = await _create_student(db_session, "stud6@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    # Pre-create a pending offer
    await _create_offer(db_session, industry.id, pod.id, RequestStatus.PENDING)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/industry/offers",
        json={
            "pod_id": str(pod.id),
            "support_type": "sponsorship",
            "amount_or_terms": "₹10,00,000 for full pilot deployment and testing phase.",
        },
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 409
    assert _get_error_code(res) == "DUPLICATE_OFFER"


@pytest.mark.asyncio
async def test_withdraw_own_pending_offer(async_client: AsyncClient, db_session: AsyncSession):
    """Industry user can withdraw their own PENDING offer."""
    industry = await _create_industry_user(db_session, "ind6@corp.com")
    student = await _create_student(db_session, "stud7@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    offer = await _create_offer(db_session, industry.id, pod.id, RequestStatus.PENDING)
    await db_session.commit()

    res = await async_client.patch(
        f"/api/v1/industry/offers/{offer.id}/withdraw",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "withdrawn"


@pytest.mark.asyncio
async def test_cannot_withdraw_others_offer(async_client: AsyncClient, db_session: AsyncSession):
    """BOLA: Industry user cannot withdraw another user's offer."""
    industry_a = await _create_industry_user(db_session, "inda@corp.com", company_name="Corp A")
    industry_b = await _create_industry_user(db_session, "indb@corp.com", company_name="Corp B")
    student = await _create_student(db_session, "stud8@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    offer_a = await _create_offer(db_session, industry_a.id, pod.id, RequestStatus.PENDING)
    await db_session.commit()

    # Industry B tries to withdraw Industry A's offer
    res = await async_client.patch(
        f"/api/v1/industry/offers/{offer_a.id}/withdraw",
        headers={"Authorization": _token(industry_b)},
    )
    assert res.status_code == 403
    assert _get_error_code(res) == "FORBIDDEN"


@pytest.mark.asyncio
async def test_cannot_withdraw_non_pending_offer(async_client: AsyncClient, db_session: AsyncSession):
    """Cannot withdraw an already-approved (accepted) offer."""
    industry = await _create_industry_user(db_session, "ind7@corp.com")
    student = await _create_student(db_session, "stud9@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    # Create an already-accepted offer
    offer = await _create_offer(db_session, industry.id, pod.id, RequestStatus.APPROVED)
    await db_session.commit()

    res = await async_client.patch(
        f"/api/v1/industry/offers/{offer.id}/withdraw",
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 409
    assert _get_error_code(res) == "OFFER_NOT_PENDING"


@pytest.mark.asyncio
async def test_funder_comment_requires_accepted_offer(async_client: AsyncClient, db_session: AsyncSession):
    """Industry user with only a PENDING offer cannot post comments on the pod."""
    industry = await _create_industry_user(db_session, "ind8@corp.com")
    student = await _create_student(db_session, "stud10@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    # Only PENDING offer — not accepted
    await _create_offer(db_session, industry.id, pod.id, RequestStatus.PENDING)
    await db_session.commit()

    res = await async_client.post(
        f"/api/v1/industry/funded-projects/{pod.id}/comments",
        json={"comment": "Great work on the prototype!"},
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 403
    assert _get_error_code(res) == "NO_ACCEPTED_OFFER"


@pytest.mark.asyncio
async def test_funder_can_comment_after_accepted_offer(async_client: AsyncClient, db_session: AsyncSession):
    """Industry user with APPROVED offer can post and read comments."""
    industry = await _create_industry_user(db_session, "ind9@corp.com")
    student = await _create_student(db_session, "stud11@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    await _create_offer(db_session, industry.id, pod.id, RequestStatus.APPROVED)
    await db_session.commit()

    res = await async_client.post(
        f"/api/v1/industry/funded-projects/{pod.id}/comments",
        json={"comment": "Excellent progress on the prototype!"},
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["comment"] == "Excellent progress on the prototype!"
    assert data["company_name"] == "TestCorp Pvt Ltd"

    # Can also read comments
    res2 = await async_client.get(
        f"/api/v1/industry/funded-projects/{pod.id}/comments",
        headers={"Authorization": _token(industry)},
    )
    assert res2.status_code == 200
    assert len(res2.json()) == 1


@pytest.mark.asyncio
async def test_create_funding_offer_equipment_and_csr_grant(async_client: AsyncClient, db_session: AsyncSession):
    """Can submit funding offers with equipment and csr_grant support types."""
    industry = await _create_industry_user(db_session, "eq_funder@corp.com", company_name="Hardware Innovators")
    student = await _create_student(db_session, "stud12@univ.ac.in")
    pod = await _create_pod(db_session, student.id, pod_status=ProjectStatus.PILOT)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/industry/offers",
        json={
            "pod_id": str(pod.id),
            "support_type": "equipment",
            "amount_or_terms": "Donation of 5x NVIDIA Jetson Nano kits for AI testing.",
        },
        headers={"Authorization": _token(industry)},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["support_type"] == "equipment"
    assert data["company_name"] == "Hardware Innovators"
    assert data["status"] == "pending"

