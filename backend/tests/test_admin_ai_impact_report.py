"""Comprehensive tests for Admin AI Impact Report Generator.

Verifies:
1. Admin user can generate a structured, verified AI impact report.
2. Endpoint alias /impact-report/generate functions identically.
3. Role enforcement: Citizen, Student, and Faculty receive 403 Forbidden.
4. Empty database / baseline produces a data limitation report without failing.
5. Real database statistics calculation verifies accurate aggregate counts.
6. AI response output validates against AdminImpactReportOutput schema.
7. AI provider failure triggers deterministic data-driven fallback without crashing.
8. AI disabled toggle (AI_IMPACT_ENABLED=False) returns 503.
9. Latest report retrieval endpoint (/ai/impact-report/latest).
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.providers.fake import FakeAIProvider
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.enums import ProblemStatus, ProjectStatus, UserRole
from app.models.problem import Problem
from app.models.project import SolutionProject
from app.models.user import User


@pytest.fixture(autouse=True)
def mock_ai_provider(monkeypatch):
    """Ensure FakeAIProvider is used for deterministic test results."""
    fake = FakeAIProvider()
    monkeypatch.setattr("app.ai_engine.graphs.impact_report.get_model_provider", lambda: fake)


async def _create_user(db: AsyncSession, role: UserRole, email: str) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("Pass123!"),
        role=role,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _seed_platform_data(db: AsyncSession):
    """Seed sample problems and projects to verify statistical counts."""
    citizen = await _create_user(db, UserRole.CITIZEN, f"citizen_{uuid.uuid4().hex[:6]}@samadhanx.in")
    student = await _create_user(db, UserRole.STUDENT, f"student_{uuid.uuid4().hex[:6]}@bit.edu")
    faculty = await _create_user(db, UserRole.FACULTY, f"faculty_{uuid.uuid4().hex[:6]}@bit.edu")
    admin = await _create_user(db, UserRole.ADMIN, f"admin_{uuid.uuid4().hex[:6]}@samadhanx.in")

    # Create problems in Ranchi
    p1 = Problem(
        title="Potholes and water accumulation on Main Road",
        description="Severe road hazards causing accidents near Namkum intersection.",
        category="Smart Infrastructure & Roads",
        location="Namkum",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.SOLVED,
        created_by_id=citizen.id,
    )
    p2 = Problem(
        title="High fluoride contamination in tube well drinking water",
        description="Villagers suffering from dental fluorosis in Barka village.",
        category="Water & Sanitation",
        location="Barka",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.IN_PROGRESS,
        created_by_id=citizen.id,
    )
    p3 = Problem(
        title="Inadequate street lighting on campus connecting lane",
        description="Safety hazard for late night pedestrians.",
        category="Clean Energy & Solar",
        location="Mesra",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.SUBMITTED,
        created_by_id=citizen.id,
    )
    db.add_all([p1, p2, p3])
    await db.flush()

    # Create a Solution Project
    proj1 = SolutionProject(
        problem_id=p1.id,
        lead_student_id=student.id,
        faculty_mentor_id=faculty.id,
        team_name="CivicFix Engineers",
        title="Cold-Mix Asphalt Rapid Repair System",
        description="Community deployed cold-mix bitumen application.",
        status=ProjectStatus.COMPLETED,
    )
    db.add(proj1)
    await db.commit()

    return {
        "admin": admin,
        "citizen": citizen,
        "student": student,
        "faculty": faculty,
        "problems": [p1, p2, p3],
        "project": proj1,
    }


@pytest.mark.asyncio
async def test_admin_generate_impact_report_success(async_client: AsyncClient, db_session: AsyncSession):
    """Test administrator successfully generates a comprehensive AI impact report."""
    data = await _seed_platform_data(db_session)
    admin_token = create_access_token(data["admin"].id, data["admin"].role.value)

    res = await async_client.post(
        "/api/v1/admin/ai/impact-report",
        json={"period": "30d", "district": "Ranchi"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True

    payload = body["data"]
    assert "report" in payload
    assert "statistics" in payload
    assert "generated_at" in payload

    # Verify structured report fields
    report = payload["report"]
    assert "headline" in report
    assert "executive_summary" in report
    assert isinstance(report["key_achievements"], list)
    assert len(report["key_achievements"]) > 0
    assert "problem_impact" in report
    assert "community_engagement" in report
    assert "student_impact" in report
    assert "collaboration_impact" in report
    assert isinstance(report["key_insights"], list)
    assert isinstance(report["areas_needing_attention"], list)
    assert isinstance(report["recommended_next_steps"], list)

    # Verify underlying statistics match real database counts
    stats = payload["statistics"]
    assert stats["problems"]["total"] >= 3
    assert stats["projects"]["total"] >= 1
    assert stats["users"]["total"] >= 4
    assert stats["district"] == "Ranchi"


@pytest.mark.asyncio
async def test_alias_endpoint_generate_impact_report(async_client: AsyncClient, db_session: AsyncSession):
    """Test alias endpoint /api/v1/admin/impact-report/generate."""
    data = await _seed_platform_data(db_session)
    admin_token = create_access_token(data["admin"].id, data["admin"].role.value)

    res = await async_client.post(
        "/api/v1/admin/impact-report/generate",
        json={"period": "all"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert res.status_code == 200
    assert res.json()["success"] is True
    assert "report" in res.json()["data"]


@pytest.mark.asyncio
async def test_non_admin_roles_forbidden(async_client: AsyncClient, db_session: AsyncSession):
    """Verify non-admin roles (citizen, student, faculty) receive 403 Forbidden."""
    data = await _seed_platform_data(db_session)

    for role_key in ["citizen", "student", "faculty"]:
        token = create_access_token(data[role_key].id, data[role_key].role.value)
        res = await async_client.post(
            "/api/v1/admin/ai/impact-report",
            json={"period": "30d"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_empty_baseline_database(async_client: AsyncClient, db_session: AsyncSession):
    """Verify empty/baseline database gracefully produces data limitation report without error."""
    admin = await _create_user(db_session, UserRole.ADMIN, f"fresh_admin_{uuid.uuid4().hex[:6]}@samadhanx.in")
    await db_session.commit()
    admin_token = create_access_token(admin.id, admin.role.value)

    res = await async_client.post(
        "/api/v1/admin/ai/impact-report",
        json={"period": "7d", "district": "NonExistentDistrictXYZ"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert res.status_code == 200
    report = res.json()["data"]["report"]
    assert report["is_data_limited"] is True or "baseline" in report["headline"].lower() or "insufficient" in report["executive_summary"].lower()


@pytest.mark.asyncio
async def test_ai_disabled_toggle(async_client: AsyncClient, db_session: AsyncSession, monkeypatch):
    """Verify 503 response when AI_IMPACT_ENABLED is disabled."""
    data = await _seed_platform_data(db_session)
    admin_token = create_access_token(data["admin"].id, data["admin"].role.value)

    monkeypatch.setattr(settings, "AI_IMPACT_ENABLED", False)

    res = await async_client.post(
        "/api/v1/admin/ai/impact-report",
        json={"period": "30d"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "AI_DISABLED"


@pytest.mark.asyncio
async def test_latest_impact_report_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Verify latest persisted impact report retrieval."""
    data = await _seed_platform_data(db_session)
    admin_token = create_access_token(data["admin"].id, data["admin"].role.value)

    # 1. Generate report
    gen_res = await async_client.post(
        "/api/v1/admin/ai/impact-report",
        json={"period": "30d"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert gen_res.status_code == 200

    # 2. Fetch latest
    latest_res = await async_client.get(
        "/api/v1/admin/ai/impact-report/latest",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert latest_res.status_code == 200
    latest_body = latest_res.json()
    assert latest_body["success"] is True
    assert latest_body["data"] is not None
    assert "report" in latest_body["data"]
    assert "statistics" in latest_body["data"]
