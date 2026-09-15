"""
Citizen Problem Timeline & End-to-End Tracking Tests
Covers:
- Citizen timeline BOLA: Only the problem submitter or Admin can access
- Real-time progression through all 6 stages:
  1. submitted
  2. approved
  3. picked_up (with team name, progress %, member count)
  4. faculty_approved (with feedback)
  5. industry_funded (with company name, support type)
  6. completed (with impact report summary)
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import (
    ImpactLevel,
    NotificationType,
    ProblemStatus,
    ProjectStatus,
    RequestStatus,
    ReviewDecision,
    SupportType,
    UserRole,
)
from app.models.impact_report import ImpactReport
from app.models.industry_support import IndustrySupport
from app.models.problem import Problem
from app.models.profiles import CitizenProfile, FacultyProfile, IndustryProfile, StudentProfile, UniversityProfile
from app.models.project import ProjectMember, SolutionProject
from app.models.project_review import ProjectReview
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


async def _create_citizen(db: AsyncSession, email: str) -> User:
    u = User(
        email=email,
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(u)
    await db.flush()
    p = CitizenProfile(user_id=u.id, full_name="Citizen " + email.split("@")[0], location="Pune", district="Pune", state="Maharashtra")
    db.add(p)
    await db.flush()
    return u


async def _create_student(db: AsyncSession, email: str) -> User:
    u = User(
        email=email,
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(u)
    await db.flush()
    p = StudentProfile(user_id=u.id, full_name="Student " + email.split("@")[0], department="Computer Science", skills=["AI", "Python"])
    db.add(p)
    await db.flush()
    return u


async def _create_faculty(db: AsyncSession, email: str, university_id: uuid.UUID) -> User:
    u = User(
        email=email,
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(u)
    await db.flush()
    p = FacultyProfile(
        user_id=u.id,
        university_id=university_id,
        created_by=u.id,
        full_name="Dr. " + email.split("@")[0],
        department="Computer Science",
        designation="Professor",
    )
    db.add(p)
    await db.flush()
    return u


async def _create_industry(db: AsyncSession, email: str) -> User:
    u = User(
        email=email,
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.INDUSTRY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(u)
    await db.flush()
    p = IndustryProfile(
        user_id=u.id,
        company_name="Green Energy Ltd",
        point_of_contact_name="Ramesh Gupta",
        official_email=email,
        is_approved=True,
    )
    db.add(p)
    await db.flush()
    return u


@pytest.mark.asyncio
async def test_citizen_timeline_bola_unauthorized_fails(async_client: AsyncClient, db_session: AsyncSession):
    """A citizen cannot view the timeline of a problem submitted by another citizen."""
    citizen1 = await _create_citizen(db_session, "cit_author@example.com")
    citizen2 = await _create_citizen(db_session, "cit_intruder@example.com")

    problem = Problem(
        title="Water Contamination in Ward 5",
        description="Heavy metal detected in tap water supply affecting 500 households.",
        category="Water & Sanitation",
        location="Ward 5",
        district="Pune",
        state="Maharashtra",
        created_by_id=citizen1.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    # Citizen 2 tries to access Citizen 1's problem timeline
    res = await async_client.get(
        f"/api/v1/citizen/my-problems/{problem.id}/timeline",
        headers={"Authorization": _token(citizen2)},
    )
    assert res.status_code == 403
    assert _get_error_code(res) == "FORBIDDEN"


@pytest.mark.asyncio
async def test_citizen_timeline_initial_submitted_state(async_client: AsyncClient, db_session: AsyncSession):
    """Citizen can see their initial submitted problem timeline with stage 1 completed."""
    citizen = await _create_citizen(db_session, "cit_timeline1@example.com")

    problem = Problem(
        title="Solar Microgrid Failure in Rural Block",
        description="Community solar plant battery inverter stopped working 2 weeks ago.",
        category="Clean Energy & Solar",
        location="Block 3",
        district="Pune",
        state="Maharashtra",
        created_by_id=citizen.id,
        status=ProblemStatus.SUBMITTED,
        is_verified=False,
    )
    db_session.add(problem)
    await db_session.commit()

    res = await async_client.get(
        f"/api/v1/citizen/my-problems/{problem.id}/timeline",
        headers={"Authorization": _token(citizen)},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["problem_id"] == str(problem.id)
    assert data["problem_title"] == problem.title
    assert data["is_verified"] is False
    assert len(data["timeline"]) >= 6

    stages = {s["stage"]: s for s in data["timeline"]}
    assert stages["submitted"]["status"] == "completed"
    assert stages["approved"]["status"] == "pending"
    assert stages["picked_up"]["status"] == "pending"
    assert data["current_pod"] is None


@pytest.mark.asyncio
async def test_citizen_timeline_full_lifecycle_progression(
    async_client: AsyncClient, db_session: AsyncSession, seed_approved_university
):
    """Tests the full 6-stage lifecycle on the citizen timeline as pod progresses."""
    _, univ_prof = seed_approved_university
    citizen = await _create_citizen(db_session, "cit_full@example.com")
    student = await _create_student(db_session, "lead_full@univ.ac.in")
    faculty = await _create_faculty(db_session, "prof_full@univ.ac.in", univ_prof.id)
    industry = await _create_industry(db_session, "csr_full@greencorp.com")

    # 1. Citizen submits problem, Admin verifies
    problem = Problem(
        title="Smart Crop Irrigation IoT Network",
        description="Drought-prone village needs automated soil moisture sensors.",
        category="Agriculture & Rural Tech",
        location="Baramati",
        district="Pune",
        state="Maharashtra",
        created_by_id=citizen.id,
        status=ProblemStatus.VERIFIED,
        is_verified=True,
    )
    db_session.add(problem)
    await db_session.flush()

    # 2. Student forms Pod
    pod = SolutionProject(
        problem_id=problem.id,
        team_name="AgriTech Innovators",
        title="IoT Soil Moisture Network",
        description="Wireless sensor deployment with solar-powered nodes.",
        status=ProjectStatus.PILOT,
        lead_student_id=student.id,
        faculty_mentor_id=faculty.id,
        university_id=univ_prof.id,
    )
    db_session.add(pod)
    await db_session.flush()

    member = ProjectMember(project_id=pod.id, user_id=student.id, role_in_team="lead")
    db_session.add(member)

    # 3. Faculty review approval
    review = ProjectReview(
        project_id=pod.id,
        reviewer_id=faculty.id,
        decision=ReviewDecision.APPROVED,
        feedback_text="Outstanding prototype design and robust wireless architecture.",
    )
    db_session.add(review)

    # 4. Industry Support
    support = IndustrySupport(
        project_id=pod.id,
        industry_user_id=industry.id,
        company_name="Green Energy Ltd",
        support_type=SupportType.CSR_GRANT,
        amount_or_terms="₹3,00,000 for field deployment",
        status=RequestStatus.APPROVED,
    )
    db_session.add(support)

    # 5. Impact Report
    report = ImpactReport(
        pod_id=pod.id,
        submitted_by=student.id,
        beneficiaries_reached=1500,
        outcome_description="Installed 20 sensor nodes saving 40% water across 100 acres.",
        proof_image_urls=["https://res.cloudinary.com/test/image1.jpg"],
        is_verified=True,
    )
    db_session.add(report)
    await db_session.commit()

    # Citizen fetches timeline
    res = await async_client.get(
        f"/api/v1/citizen/my-problems/{problem.id}/timeline",
        headers={"Authorization": _token(citizen)},
    )
    assert res.status_code == 200
    data = res.json()

    # Verify Current Pod Summary
    assert data["current_pod"] is not None
    assert data["current_pod"]["team_name"] == "AgriTech Innovators"
    assert data["current_pod"]["member_count"] == 1

    # Verify Impact Report Summary
    assert data["impact_report"] is not None
    assert data["impact_report"]["beneficiaries_reached"] == 1500
    assert len(data["impact_report"]["proof_image_urls"]) == 1

    # Verify All Stages Completed
    stages = {s["stage"]: s for s in data["timeline"]}
    assert stages["submitted"]["status"] == "completed"
    assert stages["approved"]["status"] == "completed"
    assert stages["picked_up"]["status"] == "completed"
    assert "AgriTech Innovators" in stages["picked_up"]["label"]
    assert stages["faculty_approved"]["status"] == "completed"
    assert stages["industry_funded"]["status"] == "completed"
    assert "Green Energy Ltd" in stages["industry_funded"]["label"]
    assert stages["completed"]["status"] == "completed"


@pytest.mark.asyncio
async def test_admin_can_view_citizen_timeline(async_client: AsyncClient, db_session: AsyncSession, seed_admin):
    """Admin role can view any citizen problem timeline."""
    citizen = await _create_citizen(db_session, "cit_for_admin@example.com")
    problem = Problem(
        title="Pothole Hazard on State Highway 4",
        description="Deep potholes causing daily accidents near toll plaza.",
        category="Urban Mobility",
        location="Highway 4",
        district="Pune",
        state="Maharashtra",
        created_by_id=citizen.id,
        status=ProblemStatus.SUBMITTED,
    )
    db_session.add(problem)
    await db_session.commit()

    res = await async_client.get(
        f"/api/v1/citizen/my-problems/{problem.id}/timeline",
        headers={"Authorization": _token(seed_admin)},
    )
    assert res.status_code == 200
    assert res.json()["problem_id"] == str(problem.id)
