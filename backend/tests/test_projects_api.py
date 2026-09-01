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
