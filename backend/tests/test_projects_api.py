import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_student_pick_project_flow(async_client: AsyncClient, db_session: AsyncSession):
    # 1. Create a Student User
    student_user = User(
        email="student_test@university.edu",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)
    await db_session.flush()

    token = create_access_token(student_user.id, student_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Create a problem first
    prob_payload = {
        "title": "Smart Agricultural Weather Monitoring Sensor",
        "description": "Low cost IoT weather sensor network for smallholder farmers in drought-prone areas.",
        "category": "Agriculture Tech",
        "location": "Pune Rural",
        "district": "Pune",
        "state": "Maharashtra",
    }
    prob_res = await async_client.post("/api/v1/problems", json=prob_payload, headers=headers)
    assert prob_res.status_code == 201
    problem_id = prob_res.json()["id"]

    # 2. Student Picks Project
    pick_payload = {
        "problem_id": problem_id,
        "team_name": "AgriInnovators Pod 1",
        "title": "Solar IoT Weather Pod Prototype",
        "description": "Building hardware prototype using ESP32 and LoRaWAN gateway.",
        "repository_url": "https://github.com/samadhanx/agri-weather-pod",
    }
    pick_res = await async_client.post("/api/v1/student/pick-project", json=pick_payload, headers=headers)
    assert pick_res.status_code == 201
    project_data = pick_res.json()
    assert project_data["team_name"] == pick_payload["team_name"]
    project_id = project_data["id"]

    # 3. Post Progress Update
    update_res = await async_client.post(
        f"/api/v1/projects/{project_id}/updates",
        json={
            "title": "Sprint 1 Prototype Demo",
            "content": "Completed circuit board soldering and sensor calibration tests.",
            "prototype_url": "https://agri-pod-demo.samadhanx.in",
        },
        headers=headers,
    )
    assert update_res.status_code == 201
    assert update_res.json()["title"] == "Sprint 1 Prototype Demo"


@pytest.mark.asyncio
async def test_student_submit_for_review_and_profile(async_client: AsyncClient, db_session: AsyncSession):
    # 1. Create a Student User with StudentProfile
    from app.models.profiles import StudentProfile

    student_user = User(
        email="innovator_test@university.edu",
        hashed_password=get_password_hash("InnovatorPass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)
    await db_session.flush()

    student_prof = StudentProfile(
        user_id=student_user.id,
        full_name="Innovator Test",
        department="Computer Science & Engineering",
        graduation_year=2026,
        skills=["Python", "React", "Embedded Systems"],
    )
    db_session.add(student_prof)
    await db_session.flush()

    token = create_access_token(student_user.id, student_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test GET /api/v1/student/profile
    prof_get = await async_client.get("/api/v1/student/profile", headers=headers)
    assert prof_get.status_code == 200
    pdata = prof_get.json()
    assert pdata["full_name"] == "Innovator Test"
    assert pdata["department"] == "Computer Science & Engineering"
    assert "Python" in pdata["skills"]

    # 3. Test PATCH /api/v1/student/profile
    patch_payload = {
        "headline": "Lead AI & Robotics Researcher",
        "bio": "Building autonomous sensors for smart village electrification.",
        "skills": ["Python", "Rust", "TensorFlow", "FastAPI"],
        "github_url": "https://github.com/innovator",
        "linkedin_url": "https://linkedin.com/in/innovator",
        "portfolio_url": "https://innovator.io",
    }
    prof_patch = await async_client.patch("/api/v1/student/profile", json=patch_payload, headers=headers)
    assert prof_patch.status_code == 200
    patched_data = prof_patch.json()
    assert patched_data["headline"] == patch_payload["headline"]
    assert patched_data["bio"] == patch_payload["bio"]
    assert "Rust" in patched_data["skills"]
    assert patched_data["github_url"] == patch_payload["github_url"]
    assert patched_data["linkedin_url"] == patch_payload["linkedin_url"]
    assert patched_data["portfolio_url"] == patch_payload["portfolio_url"]

    # 4. Create problem and pick project
    prob_res = await async_client.post(
        "/api/v1/problems",
        json={
            "title": "Autonomous Village Water Purification System",
            "description": "Solar-driven UV filtration units for fluoride-affected rural groundwater supplies.",
            "category": "Clean Water",
            "location": "Dhanbad",
            "district": "Dhanbad",
            "state": "Jharkhand",
        },
        headers=headers,
    )
    assert prob_res.status_code == 201
    prob_id = prob_res.json()["id"]

    pick_res = await async_client.post(
        "/api/v1/student/pick-project",
        json={
            "problem_id": prob_id,
            "team_name": "JalShakti Pod",
            "title": "UV-Solar Water Purifier Prototype",
            "description": "Pilot engineering pod building hardware filtration prototypes.",
        },
        headers=headers,
    )
    assert pick_res.status_code == 201
    proj_id = pick_res.json()["id"]

    # 5. Submit for review
    submit_res = await async_client.post(f"/api/v1/projects/{proj_id}/submit", headers=headers)
    assert submit_res.status_code == 200
    submit_data = submit_res.json()
    assert submit_data["status"] == "review"

    # 6. Verify profile now reflects pod in review
    prof_after = await async_client.get("/api/v1/student/profile", headers=headers)
    assert prof_after.status_code == 200
    assert prof_after.json()["in_review_pods_count"] >= 1
