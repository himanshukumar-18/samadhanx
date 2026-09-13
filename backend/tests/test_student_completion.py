"""
Student Module Completion — Security & Feature Tests
Uses async_client + db_session fixtures (SQLite in-memory, same as existing tests).
Covers:
- Find Teammates: no email leak, skill filter, pagination
- Faculty mentor NOT settable by student via pick-project  
- Impact Report: full lifecycle, pod lead only, completed only, duplicate reject
- Funding Offer: pod membership BOLA check
- IDOR cross-pod access denied
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import ProjectStatus, UserRole
from app.models.profiles import StudentProfile
from app.models.user import User


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


async def _create_student(db: AsyncSession, email: str) -> User:
    u = User(
        email=email,
        hashed_password=get_password_hash("Test1234!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(u)
    await db.flush()
    p = StudentProfile(user_id=u.id, full_name=email.split("@")[0], department="CSE", skills=["Python", "React"])
    db.add(p)
    await db.flush()
    return u


async def _create_problem(client: AsyncClient, token: str) -> str:
    r = await client.post(
        "/api/v1/problems",
        json={
            "title": "Test Problem for Student Module",
            "description": "Test description that is long enough to be valid.",
            "category": "Agriculture Tech",
            "location": "Pune Rural",
            "district": "Pune",
            "state": "Maharashtra",
        },
        headers={"Authorization": token},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _create_pod(client: AsyncClient, token: str, problem_id: str) -> dict:
    r = await client.post(
        "/api/v1/student/pick-project",
        json={
            "problem_id": problem_id,
            "team_name": "Test Team Alpha",
            "title": "Test Pod Alpha",
            "description": "Building a test solution for the pod.",
        },
        headers={"Authorization": token},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── Find Teammates Tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_find_teammates_no_email_leaked(async_client: AsyncClient, db_session: AsyncSession):
    """GET /student/people must never return email fields — privacy protection."""
    student = await _create_student(db_session, "student_privacy_test@uni.edu")
    token = _token(student)

    r = await async_client.get("/api/v1/student/people", headers={"Authorization": token})
    assert r.status_code == 200
    people = r.json()
    for person in people:
        assert "email" not in person, f"Email leaked in response: {person}"


@pytest.mark.asyncio
async def test_find_teammates_pagination(async_client: AsyncClient, db_session: AsyncSession):
    """GET /student/people supports limit/offset pagination."""
    student = await _create_student(db_session, "student_paginate_test@uni.edu")
    token = _token(student)

    r1 = await async_client.get("/api/v1/student/people?limit=1&offset=0", headers={"Authorization": token})
    r2 = await async_client.get("/api/v1/student/people?limit=1&offset=100", headers={"Authorization": token})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert isinstance(r1.json(), list)
    assert isinstance(r2.json(), list)


@pytest.mark.asyncio
async def test_find_teammates_limit_capped(async_client: AsyncClient, db_session: AsyncSession):
    """GET /student/people rejects limit > 50 (FastAPI query validation)."""
    student = await _create_student(db_session, "student_limitcap@uni.edu")
    token = _token(student)

    r = await async_client.get("/api/v1/student/people?limit=200", headers={"Authorization": token})
    assert r.status_code == 422  # FastAPI validation error


@pytest.mark.asyncio
async def test_find_teammates_skill_filter(async_client: AsyncClient, db_session: AsyncSession):
    """GET /student/people?skill=Python only returns students with Python skill."""
    student = await _create_student(db_session, "student_skillfilter@uni.edu")
    token = _token(student)

    r = await async_client.get("/api/v1/student/people?skill=Python", headers={"Authorization": token})
    assert r.status_code == 200
    people = r.json()
    # All returned people should have Python in their skills
    for person in people:
        skills = [s.lower() for s in (person.get("skills") or [])]
        assert "python" in skills, f"Student without Python skill returned: {person}"


# ── Faculty Mentor Security Test ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_faculty_mentor_not_settable_by_student(async_client: AsyncClient, db_session: AsyncSession):
    """
    Security: student cannot self-assign a faculty mentor via pick-project.
    The faculty_mentor_id field is silently ignored and set to null.
    """
    from app.models.profiles import FacultyProfile

    student = await _create_student(db_session, "student_mentor_security@uni.edu")
    faculty = User(
        email="faculty_for_security_test@uni.edu",
        hashed_password=get_password_hash("FacultyPass1!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(faculty)
    await db_session.flush()

    student_token = _token(student)
    problem_id = await _create_problem(async_client, student_token)

    r = await async_client.post(
        "/api/v1/student/pick-project",
        json={
            "problem_id": problem_id,
            "team_name": "Mentor Security Test Team",
            "title": "Mentor Security Pod",
            "description": "Testing that faculty_mentor_id is ignored from student input",
            "faculty_mentor_id": str(faculty.id),  # This should be silently ignored
        },
        headers={"Authorization": student_token},
    )

    assert r.status_code == 201, r.text
    created = r.json()
    # faculty_mentor_id MUST be null — student cannot set it
    assert created.get("faculty_mentor_id") is None, (
        f"SECURITY VIOLATION: student was able to set faculty_mentor_id! Response: {created}"
    )


# ── Impact Report Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_impact_report_requires_completed_pod(async_client: AsyncClient, db_session: AsyncSession):
    """POST /student/pods/{id}/impact-report must reject if pod is not completed."""
    from app.models.project import SolutionProject

    student = await _create_student(db_session, "student_impact_notcomplete@uni.edu")
    token = _token(student)
    problem_id = await _create_problem(async_client, token)
    pod = await _create_pod(async_client, token, problem_id)

    # Pod is in PLANNING status — impact report must be rejected
    r = await async_client.post(
        f"/api/v1/student/pods/{pod['id']}/impact-report",
        json={
            "outcome_description": "Test outcome description that exceeds twenty characters",
            "beneficiaries_reached": 100,
        },
        headers={"Authorization": token},
    )

    assert r.status_code == 409, r.text
    assert _get_error_code(r) == "POD_NOT_COMPLETED"


@pytest.mark.asyncio
async def test_impact_report_only_pod_lead_can_submit(async_client: AsyncClient, db_session: AsyncSession):
    """Only the pod lead can submit impact report; pod members get NOT_POD_LEAD."""
    from app.models.project import ProjectMember, SolutionProject

    lead = await _create_student(db_session, "student_impact_lead@uni.edu")
    member_user = await _create_student(db_session, "student_impact_member@uni.edu")

    lead_token = _token(lead)
    problem_id = await _create_problem(async_client, lead_token)
    pod = await _create_pod(async_client, lead_token, problem_id)
    pod_id = pod["id"]

    # Add member_user to pod
    from sqlalchemy import select
    proj = (await db_session.execute(select(SolutionProject).where(SolutionProject.id == uuid.UUID(pod_id)))).scalar_one()
    db_session.add(ProjectMember(project_id=proj.id, user_id=member_user.id, role_in_team="Member"))
    # Set pod to completed
    proj.status = ProjectStatus.COMPLETED
    await db_session.flush()

    member_token = _token(member_user)
    r = await async_client.post(
        f"/api/v1/student/pods/{pod_id}/impact-report",
        json={
            "outcome_description": "Test outcome description that exceeds twenty characters easily",
            "beneficiaries_reached": 50,
        },
        headers={"Authorization": member_token},
    )

    assert r.status_code == 403, r.text
    assert _get_error_code(r) == "NOT_POD_LEAD"


@pytest.mark.asyncio
async def test_full_impact_report_lifecycle(async_client: AsyncClient, db_session: AsyncSession):
    """
    E2E: Create pod → set to completed → submit report → retrieve → duplicate rejected → update.
    """
    from app.models.project import SolutionProject
    from sqlalchemy import select

    student = await _create_student(db_session, "student_impact_lifecycle@uni.edu")
    token = _token(student)
    problem_id = await _create_problem(async_client, token)
    pod = await _create_pod(async_client, token, problem_id)
    pod_id = pod["id"]

    # Set to completed
    proj = (await db_session.execute(select(SolutionProject).where(SolutionProject.id == uuid.UUID(pod_id)))).scalar_one()
    proj.status = ProjectStatus.COMPLETED
    await db_session.flush()

    # 1. Submit report
    r1 = await async_client.post(
        f"/api/v1/student/pods/{pod_id}/impact-report",
        json={
            "outcome_description": "We deployed solar pumps across 12 villages in Jharkhand, impacting 2,500 farmers.",
            "beneficiaries_reached": 2500,
            "proof_image_urls": ["https://res.cloudinary.com/test/image/upload/sample.jpg"],
        },
        headers={"Authorization": token},
    )
    assert r1.status_code == 201, r1.text
    report = r1.json()
    assert report["beneficiaries_reached"] == 2500
    assert report["is_verified"] is False
    assert report["outcome_description"].startswith("We deployed")

    # 2. Retrieve it
    r2 = await async_client.get(
        f"/api/v1/student/pods/{pod_id}/impact-report",
        headers={"Authorization": token},
    )
    assert r2.status_code == 200
    assert r2.json()["pod_id"] == pod_id

    # 3. Duplicate POST must fail
    r3 = await async_client.post(
        f"/api/v1/student/pods/{pod_id}/impact-report",
        json={
            "outcome_description": "This should be rejected because a report already exists.",
            "beneficiaries_reached": 100,
        },
        headers={"Authorization": token},
    )
    assert r3.status_code == 409, r3.text
    assert _get_error_code(r3) == "IMPACT_REPORT_ALREADY_EXISTS"

    # 4. Update via PATCH should work
    r4 = await async_client.patch(
        f"/api/v1/student/pods/{pod_id}/impact-report",
        json={
            "outcome_description": "Updated: We expanded to 20 villages with 4,000 beneficiaries.",
            "beneficiaries_reached": 4000,
        },
        headers={"Authorization": token},
    )
    assert r4.status_code == 200, r4.text
    assert r4.json()["beneficiaries_reached"] == 4000


# ── Funding Offer BOLA Tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_funding_offers_pod_membership_required(async_client: AsyncClient, db_session: AsyncSession):
    """
    BOLA: Student A cannot view funding offers for Pod B (owned by Student B).
    """
    student_a = await _create_student(db_session, "student_idor_a@uni.edu")
    student_b = await _create_student(db_session, "student_idor_b@uni.edu")

    token_b = _token(student_b)
    problem_id = await _create_problem(async_client, token_b)
    pod_b = await _create_pod(async_client, token_b, problem_id)

    # Student A tries to access Student B's pod offers — must be rejected
    token_a = _token(student_a)
    r = await async_client.get(
        f"/api/v1/student/pods/{pod_b['id']}/funding-offers",
        headers={"Authorization": token_a},
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert _get_error_code(r) == "POD_ACCESS_DENIED"


@pytest.mark.asyncio
async def test_impact_report_pod_lead_can_access_own_pod(async_client: AsyncClient, db_session: AsyncSession):
    """Pod lead can read their pod's funding offers (empty list)."""
    student = await _create_student(db_session, "student_funding_lead@uni.edu")
    token = _token(student)
    problem_id = await _create_problem(async_client, token)
    pod = await _create_pod(async_client, token, problem_id)

    r = await async_client.get(
        f"/api/v1/student/pods/{pod['id']}/funding-offers",
        headers={"Authorization": token},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)  # Empty list — no offers yet


@pytest.mark.asyncio
async def test_impact_report_idor_cross_pod(async_client: AsyncClient, db_session: AsyncSession):
    """
    IDOR: Student A cannot submit an impact report for Pod B (owned by Student B).
    """
    from app.models.project import SolutionProject
    from sqlalchemy import select

    student_a = await _create_student(db_session, "student_impact_idor_a@uni.edu")
    student_b = await _create_student(db_session, "student_impact_idor_b@uni.edu")

    token_b = _token(student_b)
    problem_id = await _create_problem(async_client, token_b)
    pod_b = await _create_pod(async_client, token_b, problem_id)

    # Set pod B to completed
    proj = (await db_session.execute(select(SolutionProject).where(SolutionProject.id == uuid.UUID(pod_b["id"])))).scalar_one()
    proj.status = ProjectStatus.COMPLETED
    await db_session.flush()

    # Student A tries to submit impact report for Student B's pod
    token_a = _token(student_a)
    r = await async_client.post(
        f"/api/v1/student/pods/{pod_b['id']}/impact-report",
        json={
            "outcome_description": "Attempted IDOR attack to submit fake impact data for someone else's pod.",
            "beneficiaries_reached": 9999,
        },
        headers={"Authorization": token_a},
    )
    assert r.status_code == 403, f"IDOR VULNERABILITY: Student A accessed Pod B! Status: {r.status_code}"
    error_code = _get_error_code(r)
    assert error_code in ("POD_ACCESS_DENIED", "NOT_POD_LEAD"), f"Unexpected error code: {error_code}"
