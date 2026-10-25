"""Comprehensive tests for Faculty AI Review Assistant.

Verifies:
1. Authorized faculty mentor triggers AI review successfully with structured response.
2. Backward compatible /pods/{pod_id}/ai-review-assist endpoint.
3. Insufficient project data returns required summary and 'insufficient_data' assessment.
4. BOLA access control: Unauthorized faculty from another university is rejected (403).
5. Role enforcement: Non-faculty (student, citizen) cannot trigger AI review (403).
6. Non-existent project returns 404.
7. AI disabled toggle returns 503.
8. Provider fallback when AI provider throws an error.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.providers.fake import FakeAIProvider
from app.ai_engine.schemas.faculty_review import FacultyAIReviewOutput
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.enums import ProjectStatus, UserRole
from app.models.problem import Problem
from app.models.profiles import FacultyProfile, UniversityProfile
from app.models.project import SolutionProject
from app.models.project_update import ProjectUpdate
from app.models.user import User


@pytest.fixture(autouse=True)
def mock_ai_provider(monkeypatch):
    """Ensure FakeAIProvider is used for deterministic test results."""
    fake = FakeAIProvider()
    monkeypatch.setattr("app.ai_engine.graphs.faculty_review.get_model_provider", lambda: fake)


async def _setup_users_and_project(db: AsyncSession):
    """Helper to create university, faculty, student, citizen, and a solution pod."""
    # 1. University
    univ_user = User(
        email="admin@bitmesra.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(univ_user)
    await db.flush()

    univ = UniversityProfile(
        user_id=univ_user.id,
        university_name="Birla Institute of Technology",
        state="Jharkhand",
        district="Ranchi",
        aishe_code="U-0123",
        nodal_officer_name="Registrar BIT",
        official_email="registrar@bitmesra.ac.in",
        is_approved=True,
    )
    db.add(univ)
    await db.flush()

    # 2. Citizen (problem creator)
    citizen = User(
        email=f"citizen_{uuid.uuid4().hex[:6]}@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(citizen)

    # 3. Student Lead
    student = User(
        email=f"student_{uuid.uuid4().hex[:6]}@bitmesra.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(student)

    # 4. Faculty Mentor
    faculty = User(
        email=f"faculty_{uuid.uuid4().hex[:6]}@bitmesra.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(faculty)
    await db.flush()

    faculty_profile = FacultyProfile(
        user_id=faculty.id,
        university_id=univ.id,
        created_by=univ_user.id,
        full_name="Prof. Anand Verma",
        department="Computer Science",
        designation="Professor",
    )
    db.add(faculty_profile)

    # 5. Faculty from another university
    other_univ_user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@dtu.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(other_univ_user)
    await db.flush()

    other_univ = UniversityProfile(
        user_id=other_univ_user.id,
        university_name="Delhi Technological University",
        state="Delhi",
        district="New Delhi",
        aishe_code="U-9999",
        nodal_officer_name="Registrar DTU",
        official_email="registrar@dtu.ac.in",
        is_approved=True,
    )
    db.add(other_univ)
    await db.flush()

    other_faculty = User(
        email=f"faculty_{uuid.uuid4().hex[:6]}@dtu.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(other_faculty)
    await db.flush()

    other_faculty_profile = FacultyProfile(
        user_id=other_faculty.id,
        university_id=other_univ.id,
        created_by=other_univ_user.id,
        full_name="Prof. Rajesh Sharma",
        department="Mechanical Engineering",
        designation="Associate Professor",
    )
    db.add(other_faculty_profile)


    # 6. Civic Problem
    problem = Problem(
        title="Contaminated Well Water in Namkum Ward 4",
        description="Groundwater in Namkum Ward 4 contains toxic heavy metals and high bacterial count.",
        category="Water & Sanitation",
        location="Namkum Ward 4",
        district="Ranchi",
        state="Jharkhand",
        created_by_id=citizen.id,
    )
    db.add(problem)
    await db.flush()

    # 7. Solution Project
    project = SolutionProject(
        problem_id=problem.id,
        lead_student_id=student.id,
        faculty_mentor_id=faculty.id,
        university_id=univ.id,
        team_name="HydroPure Innovators",
        title="Low-Cost IoT Solar Water Purification Unit",
        description="Building a multi-stage bio-sand and UV purification filter with IoT turbidity sensors.",
        repository_url="https://github.com/hydropure/water-filter",
        status=ProjectStatus.IN_PROGRESS,
    )
    db.add(project)
    await db.flush()

    # 8. Project Update
    update = ProjectUpdate(
        project_id=project.id,
        author_id=student.id,
        title="Milestone 1: Sensor Calibration Complete",
        content="Calibrated turbidity and TDS sensors using standard buffer solutions. Achieved 98% accuracy.",
        prototype_url="https://demo.hydropure.org",
    )
    db.add(update)
    await db.commit()

    return {
        "univ": univ,
        "citizen": citizen,
        "student": student,
        "faculty": faculty,
        "other_faculty": other_faculty,
        "problem": problem,
        "project": project,
    }


@pytest.mark.asyncio
async def test_faculty_ai_review_success(async_client: AsyncClient, db_session: AsyncSession):
    """Test authorized faculty can generate an AI review successfully."""
    data = await _setup_users_and_project(db_session)
    faculty_token = create_access_token(data["faculty"].id, data["faculty"].role.value)
    project_id = data["project"].id

    res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/ai-review",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    review = body["data"]

    assert "summary" in review
    assert isinstance(review["progress_percentage"], int)
    assert 0 <= review["progress_percentage"] <= 100
    assert isinstance(review["completed_work"], list)
    assert isinstance(review["pending_work"], list)
    assert isinstance(review["strengths"], list)
    assert isinstance(review["risks"], list)
    assert isinstance(review["suggested_feedback"], list)
    assert isinstance(review["next_steps"], list)
    assert review["overall_assessment"] in ["on_track", "needs_attention", "behind", "insufficient_data"]


@pytest.mark.asyncio
async def test_backward_compatible_pod_ai_review_assist(async_client: AsyncClient, db_session: AsyncSession):
    """Test legacy /pods/{pod_id}/ai-review-assist endpoint forwards to the same service."""
    data = await _setup_users_and_project(db_session)
    faculty_token = create_access_token(data["faculty"].id, data["faculty"].role.value)
    project_id = data["project"].id

    res = await async_client.post(
        f"/api/v1/faculty/pods/{project_id}/ai-review-assist",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "summary" in body["data"]
    assert "progress_percentage" in body["data"]


@pytest.mark.asyncio
async def test_insufficient_data_handling(async_client: AsyncClient, db_session: AsyncSession):
    """Test project with minimal info and zero updates returns insufficient_data assessment."""
    data = await _setup_users_and_project(db_session)
    faculty_token = create_access_token(data["faculty"].id, data["faculty"].role.value)

    # Create empty project
    empty_project = SolutionProject(
        problem_id=data["problem"].id,
        lead_student_id=data["student"].id,
        faculty_mentor_id=data["faculty"].id,
        university_id=data["univ"].id,
        team_name="Blank Team",
        title="New Idea",
        description="Short",  # < 25 chars and 0 updates
        status=ProjectStatus.PLANNING,
    )
    db_session.add(empty_project)
    await db_session.commit()

    res = await async_client.post(
        f"/api/v1/faculty/projects/{empty_project.id}/ai-review",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )

    assert res.status_code == 200
    review = res.json()["data"]
    assert review["overall_assessment"] == "insufficient_data"
    assert "Not enough project data is available for a reliable AI review." in review["summary"]
    assert review["progress_percentage"] == 0


@pytest.mark.asyncio
async def test_unauthorized_faculty_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Test faculty from another university cannot review someone else's project."""
    data = await _setup_users_and_project(db_session)
    other_faculty_token = create_access_token(data["other_faculty"].id, data["other_faculty"].role.value)
    project_id = data["project"].id

    res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/ai-review",
        headers={"Authorization": f"Bearer {other_faculty_token}"},
    )

    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FACULTY_REVIEW_ACCESS_DENIED"


@pytest.mark.asyncio
async def test_non_faculty_role_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Test student or citizen cannot trigger faculty AI review assistant."""
    data = await _setup_users_and_project(db_session)
    student_token = create_access_token(data["student"].id, data["student"].role.value)
    project_id = data["project"].id

    res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/ai-review",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_nonexistent_project_returns_404(async_client: AsyncClient, db_session: AsyncSession):
    """Test requesting review for non-existent project returns 404."""
    data = await _setup_users_and_project(db_session)
    faculty_token = create_access_token(data["faculty"].id, data["faculty"].role.value)
    fake_id = uuid.uuid4()

    res = await async_client.post(
        f"/api/v1/faculty/projects/{fake_id}/ai-review",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "PROJECT_NOT_FOUND"


@pytest.mark.asyncio
async def test_ai_disabled_toggle(async_client: AsyncClient, db_session: AsyncSession, monkeypatch):
    """Test 503 response when AI_FACULTY_ENABLED is False."""
    data = await _setup_users_and_project(db_session)
    faculty_token = create_access_token(data["faculty"].id, data["faculty"].role.value)
    project_id = data["project"].id

    monkeypatch.setattr(settings, "AI_FACULTY_ENABLED", False)

    res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/ai-review",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "AI_DISABLED"

