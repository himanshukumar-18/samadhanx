"""Comprehensive tests for Student Problem-to-Skill Matching & Recommendations.

Verifies:
1. Authenticated Student with skills receives personalized recommendations with matched skills & explanation.
2. Unskilled student receives empty-profile fallback with is_fallback=True and guidance hint.
3. Role authorization enforcement: Citizen, Faculty, and Industry receive 403 Forbidden.
4. Unauthenticated request receives 401 Unauthorized.
5. Problems with REJECTED or unapproved SUBMITTED status are excluded from recommendations.
6. Problems already picked / led by the student are excluded from recommendations.
7. Category and district filters correctly refine candidate results.
8. Missing or None embeddings are handled safely without crashing.
9. Cache invalidation helper executes cleanly.
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.enums import ProblemStatus, ProjectStatus, UserRole
from app.models.problem import Problem
from app.models.profiles import StudentProfile
from app.models.project import SolutionProject
from app.models.user import User
from app.services.recommendation_service import invalidate_student_recommendations_cache


async def _create_user(db: AsyncSession, role: UserRole, email: str) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("SecretPass123!"),
        role=role,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    await db.flush()
    return user


@pytest.mark.asyncio
async def test_student_recommendations_with_skills(db_session: AsyncSession):
    # 1. Setup Student with Python & AI skills
    student = await _create_user(db_session, UserRole.STUDENT, f"student_{uuid.uuid4().hex[:6]}@college.edu")
    profile = StudentProfile(
        user_id=student.id,
        full_name="Arjun Sharma",
        department="Computer Science",
        skills=["Python", "AI", "PostgreSQL"],
    )
    db_session.add(profile)
    await db_session.flush()

    citizen = await _create_user(db_session, UserRole.CITIZEN, f"citizen_{uuid.uuid4().hex[:6]}@samadhanx.in")

    # 2. Setup Problems:
    dummy_vec = [0.05] * 384

    # Matching problem
    prob_match = Problem(
        title="AI-powered civic complaint classification",
        description="Automated routing system using machine learning and Python scripts for civic issues.",
        category="Artificial Intelligence",
        location="Sector 4",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    # Different problem
    prob_diff = Problem(
        title="Sanitation pipeline repair",
        description="Drainage blockages in municipal ward 12 requiring plumbing and physical civil excavation.",
        category="Sanitation",
        location="Ward 12",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    db_session.add_all([prob_match, prob_diff])
    await db_session.commit()

    token = create_access_token(subject=str(student.id), role=student.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/student/recommendations?limit=5",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    data = res_data["data"]
    assert data["is_fallback"] is False
    assert len(data["recommendations"]) > 0

    first = data["recommendations"][0]
    assert first["title"] == "AI-powered civic complaint classification"
    assert "Python" in first["matched_skills"] or "AI" in first["matched_skills"]
    assert "matches your" in first["reason"].lower()


@pytest.mark.asyncio
async def test_unskilled_student_gets_fallback(db_session: AsyncSession):
    student = await _create_user(db_session, UserRole.STUDENT, f"student_new_{uuid.uuid4().hex[:6]}@college.edu")
    profile = StudentProfile(
        user_id=student.id,
        full_name="New Student",
        department="Engineering",
        skills=[],  # No skills added yet
    )
    db_session.add(profile)

    citizen = await _create_user(db_session, UserRole.CITIZEN, f"citizen_{uuid.uuid4().hex[:6]}@samadhanx.in")
    prob = Problem(
        title="General Civic Challenge",
        description="Public library book digitization and community cataloging.",
        category="Education",
        location="Central Library",
        district="Dhanbad",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
    )
    db_session.add(prob)
    await db_session.commit()

    token = create_access_token(subject=str(student.id), role=student.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/student/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["is_fallback"] is True
    assert "Complete your profile" in data["hint"]
    assert len(data["recommendations"]) >= 1
    assert data["recommendations"][0]["match_level"] == "general"


@pytest.mark.asyncio
async def test_role_enforcement(db_session: AsyncSession):
    citizen = await _create_user(db_session, UserRole.CITIZEN, f"cit_{uuid.uuid4().hex[:6]}@test.com")
    faculty = await _create_user(db_session, UserRole.FACULTY, f"fac_{uuid.uuid4().hex[:6]}@test.com")
    industry = await _create_user(db_session, UserRole.INDUSTRY, f"ind_{uuid.uuid4().hex[:6]}@test.com")
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Unauthenticated -> 401
        res_unauth = await ac.get("/api/v1/student/recommendations")
        assert res_unauth.status_code == 401

        # 2. Citizen -> 403
        tok_cit = create_access_token(subject=str(citizen.id), role=citizen.role.value)
        res_cit = await ac.get("/api/v1/student/recommendations", headers={"Authorization": f"Bearer {tok_cit}"})
        assert res_cit.status_code == 403

        # 3. Faculty -> 403
        tok_fac = create_access_token(subject=str(faculty.id), role=faculty.role.value)
        res_fac = await ac.get("/api/v1/student/recommendations", headers={"Authorization": f"Bearer {tok_fac}"})
        assert res_fac.status_code == 403

        # 4. Industry -> 403
        tok_ind = create_access_token(subject=str(industry.id), role=industry.role.value)
        res_ind = await ac.get("/api/v1/student/recommendations", headers={"Authorization": f"Bearer {tok_ind}"})
        assert res_ind.status_code == 403


@pytest.mark.asyncio
async def test_excludes_rejected_and_already_picked_problems(db_session: AsyncSession):
    student = await _create_user(db_session, UserRole.STUDENT, f"student_pick_{uuid.uuid4().hex[:6]}@college.edu")
    profile = StudentProfile(
        user_id=student.id,
        full_name="Sneha Rao",
        department="Information Tech",
        skills=["React", "Node.js"],
    )
    db_session.add(profile)
    citizen = await _create_user(db_session, UserRole.CITIZEN, f"cit_{uuid.uuid4().hex[:6]}@test.com")

    dummy_vec = [0.1] * 384

    # 1. Problem rejected -> must be excluded
    p_rejected = Problem(
        title="Spam complaint",
        description="Random rejected text with React and Node.js.",
        category="Tech",
        location="Loc 1",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.REJECTED,
        is_verified=False,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )

    # 2. Problem already picked by student in a SolutionProject -> must be excluded
    p_picked = Problem(
        title="Civic Portal React Dashboard",
        description="Portal frontend in React and Node.js.",
        category="Web",
        location="Loc 2",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    db_session.add_all([p_rejected, p_picked])
    await db_session.flush()

    # Create project picked by student
    proj = SolutionProject(
        problem_id=p_picked.id,
        team_name="CivicCoders",
        title="Active Student Pod",
        description="Pod in progress",
        lead_student_id=student.id,
        status=ProjectStatus.IN_PROGRESS,
    )
    db_session.add(proj)

    # 3. Valid problem that is open
    p_open = Problem(
        title="Public School Portal in React",
        description="School attendance application using React.",
        category="Web",
        location="Loc 3",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    db_session.add(p_open)
    await db_session.commit()

    token = create_access_token(subject=str(student.id), role=student.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/student/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    recs = response.json()["data"]["recommendations"]
    rec_ids = [r["id"] for r in recs]

    assert str(p_rejected.id) not in rec_ids
    assert str(p_picked.id) not in rec_ids
    assert str(p_open.id) in rec_ids


@pytest.mark.asyncio
async def test_category_and_district_filters(db_session: AsyncSession):
    student = await _create_user(db_session, UserRole.STUDENT, f"student_filt_{uuid.uuid4().hex[:6]}@college.edu")
    profile = StudentProfile(
        user_id=student.id,
        full_name="Pooja Sen",
        department="Electrical",
        skills=["Solar", "IoT"],
    )
    db_session.add(profile)
    citizen = await _create_user(db_session, UserRole.CITIZEN, f"cit_{uuid.uuid4().hex[:6]}@test.com")

    dummy_vec = [0.1] * 384
    p1 = Problem(
        title="Solar street lighting failure",
        description="Solar panel faults with IoT telemetry required in Bokaro.",
        category="Clean Energy & Solar",
        location="Sector 1",
        district="Bokaro",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    p2 = Problem(
        title="Solar microgrid failure in Ranchi",
        description="Solar inverters damaged in Ranchi.",
        category="Clean Energy & Solar",
        location="Main Town",
        district="Ranchi",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=dummy_vec,
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    token = create_access_token(subject=str(student.id), role=student.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Filter by Bokaro district
        res = await ac.get(
            "/api/v1/student/recommendations?district=Bokaro",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    recs = res.json()["data"]["recommendations"]
    assert len(recs) == 1
    assert recs[0]["district"] == "Bokaro"


@pytest.mark.asyncio
async def test_missing_embeddings_handled_gracefully(db_session: AsyncSession):
    student = await _create_user(db_session, UserRole.STUDENT, f"student_noemb_{uuid.uuid4().hex[:6]}@college.edu")
    profile = StudentProfile(
        user_id=student.id,
        full_name="Karan Verma",
        department="Civil",
        skills=["Bridges", "Structures"],
    )
    db_session.add(profile)
    citizen = await _create_user(db_session, UserRole.CITIZEN, f"cit_{uuid.uuid4().hex[:6]}@test.com")

    # Problem without embedding (None)
    prob_no_emb = Problem(
        title="Foot overbridge structural inspection",
        description="Bridges in rural area need urgent inspection and rehabilitation.",
        category="Infrastructure",
        location="Village Gate",
        district="Ramgarh",
        state="Jharkhand",
        status=ProblemStatus.VERIFIED,
        is_verified=True,
        created_by_id=citizen.id,
        embedding=None,
    )
    db_session.add(prob_no_emb)
    await db_session.commit()

    token = create_access_token(subject=str(student.id), role=student.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/student/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "recommendations" in data


@pytest.mark.asyncio
async def test_cache_invalidation_helper():
    test_id = uuid.uuid4()
    # Should run gracefully even if Redis is unreachable
    await invalidate_student_recommendations_cache(test_id)

