import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_faculty_review_and_industry_support(async_client: AsyncClient, db_session: AsyncSession):
    # 1. Create Citizen User (Problem Creator)
    citizen_user = User(
        email="citizen_reporter@samadhanx.in",
        hashed_password=get_password_hash("CitizenPass123!"),
        role=UserRole.CITIZEN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(citizen_user)

    # 2. Create Student User (Project Lead)
    student_user = User(
        email="student_lead@university.edu",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)

    # 3. Create Faculty User
    faculty_user = User(
        email="prof.sharma@iit.edu",
        hashed_password=get_password_hash("FacultyPass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(faculty_user)

    # 4. Create Industry User
    industry_user = User(
        email="csr@tata.com",
        hashed_password=get_password_hash("IndustryPass123!"),
        role=UserRole.INDUSTRY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(industry_user)
    await db_session.flush()

    citizen_token = create_access_token(citizen_user.id, citizen_user.role.value)
    student_token = create_access_token(student_user.id, student_user.role.value)
    faculty_token = create_access_token(faculty_user.id, faculty_user.role.value)
    industry_token = create_access_token(industry_user.id, industry_user.role.value)

    # Create Problem & Solution Project
    prob_res = await async_client.post(
        "/api/v1/problems",
        json={
            "title": "Waste Segregation AI Robot",
            "description": "Automated waste sorting system for municipal sorting stations.",
            "category": "Waste Management",
            "location": "Mumbai Suburbs",
            "district": "Mumbai",
            "state": "Maharashtra",
        },
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    problem_id = prob_res.json()["id"]

    proj_res = await async_client.post(
        "/api/v1/student/pick-project",
        json={
            "problem_id": problem_id,
            "team_name": "RoboClean Team",
            "title": "Computer Vision Waste Classifier",
            "description": "YOLOv8 vision model integrated with conveyor belt robotics.",
        },
        headers={"Authorization": f"Bearer {student_token}"},
    )
    project_id = proj_res.json()["id"]

    # 5. Faculty Submits Project Review
    review_res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/reviews",
        json={
            "decision": "approved",
            "feedback_text": "Excellent prototype methodology and clean code architecture. Approved for pilot phase.",
        },
        headers={"Authorization": f"Bearer {faculty_token}"},
    )
    assert review_res.status_code == 201
    assert review_res.json()["decision"] == "approved"

    # 6. Industry Partner Submits Support Intent
    support_res = await async_client.post(
        "/api/v1/industry/support",
        json={
            "project_id": project_id,
            "company_name": "Tata CSR Innovation Foundation",
            "support_type": "sponsorship",
            "amount_or_terms": "Grant of ₹5,00,000 for field deployment and pilot hardware.",
        },
        headers={"Authorization": f"Bearer {industry_token}"},
    )
    assert support_res.status_code == 201
    assert support_res.json()["support_type"] == "sponsorship"
