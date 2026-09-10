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
    support_data = support_res.json()
    assert support_data["support_type"] == "sponsorship"
    support_id = support_data["id"]

    # 7. Industry Partner Queries Partnerships Overview
    ind_overview_res = await async_client.get(
        "/api/v1/industry/partnerships",
        headers={"Authorization": f"Bearer {industry_token}"},
    )
    assert ind_overview_res.status_code == 200
    overview_data = ind_overview_res.json()
    assert overview_data["total_partnerships_count"] >= 1
    assert len(overview_data["partnerships"]) >= 1
    assert overview_data["partnerships"][0]["project_title"] == "Computer Vision Waste Classifier"

    # 8. Student Lead Approves Support Intent
    approve_res = await async_client.patch(
        f"/api/v1/industry/support/{support_id}/status",
        json={"status": "approved"},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_faculty_mentorship_adoption_and_profile_chain(async_client: AsyncClient, db_session: AsyncSession):
    from app.models.profiles import FacultyProfile, UniversityProfile

    # 1. Create University & Faculty
    univ_user = User(
        email="jharkhand_univ@jru.edu.in",
        hashed_password=get_password_hash("UnivPass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(univ_user)
    await db_session.flush()

    univ_prof = UniversityProfile(
        user_id=univ_user.id,
        university_name="Jharkhand Rai University",
        aishe_code="U-0123",
        state="Jharkhand",
        district="Ranchi",
        nodal_officer_name="Registrar Office",
        official_email="contact@jru.edu.in",
        is_approved=True,
    )
    db_session.add(univ_prof)
    await db_session.flush()

    fac_user = User(
        email="dr.aditya.raj@jru.edu.in",
        hashed_password=get_password_hash("FacultyPass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(fac_user)
    await db_session.flush()

    fac_prof = FacultyProfile(
        user_id=fac_user.id,
        university_id=univ_prof.id,
        created_by=univ_user.id,
        full_name="Dr. Aditya Raj",
        department="CS/IT",
        designation="Professor",
        research_areas=["Artificial Intelligence", "IoT", "Smart Agriculture"],
    )
    db_session.add(fac_prof)

    # 2. Create Student Lead & Problem
    student_user = User(
        email="campus_innovator@jru.edu.in",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)
    await db_session.flush()

    fac_token = create_access_token(fac_user.id, fac_user.role.value)
    stu_token = create_access_token(student_user.id, student_user.role.value)

    prob_res = await async_client.post(
        "/api/v1/problems",
        json={
            "title": "Groundwater Arsenic Detection Sensor",
            "description": "Affordable IoT chemical sensor network for rural tap water arsenic testing.",
            "category": "Water & Sanitation",
            "location": "Ranchi Rural",
            "district": "Ranchi",
            "state": "Jharkhand",
        },
        headers={"Authorization": f"Bearer {stu_token}"},
    )
    problem_id = prob_res.json()["id"]

    # Student creates unmentored pod
    pod_res = await async_client.post(
        "/api/v1/student/pick-project",
        json={
            "problem_id": problem_id,
            "team_name": "AquaShield JRU",
            "title": "IoT Arsenic Fluoride Sensor Node",
            "description": "Electrochemical probe transmitting real-time water quality to dashboard.",
        },
        headers={"Authorization": f"Bearer {stu_token}"},
    )
    project_id = pod_res.json()["id"]

    # 3. Faculty views dashboard -> pod should be in available_projects
    dash_res = await async_client.get(
        "/api/v1/faculty/dashboard",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["faculty_name"] == "Dr. Aditya Raj"
    assert dash_data["university_name"] == "Jharkhand Rai University"
    assert dash_data["available_pods_count"] >= 1
    avail_ids = [p["id"] for p in dash_data["available_projects"]]
    assert project_id in avail_ids

    # 4. Faculty Adopts Pod for Mentorship
    adopt_res = await async_client.post(
        f"/api/v1/faculty/projects/{project_id}/adopt",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert adopt_res.status_code == 200
    assert adopt_res.json()["status"] == "success"

    # 5. Faculty views dashboard -> pod is now in assigned_projects
    dash_res2 = await async_client.get(
        "/api/v1/faculty/dashboard",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert dash_res2.status_code == 200
    dash_data2 = dash_res2.json()
    assert dash_data2["assigned_projects_count"] >= 1
    assigned_ids = [p["id"] for p in dash_data2["assigned_projects"]]
    assert project_id in assigned_ids

    # 6. Faculty Profile View & Update
    prof_res = await async_client.get(
        "/api/v1/faculty/profile",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert prof_data["full_name"] == "Dr. Aditya Raj"
    assert prof_data["department"] == "CS/IT"
    assert prof_data["supervised_pods_count"] >= 1

    patch_res = await async_client.patch(
        "/api/v1/faculty/profile",
        json={
            "department": "Computer Science & Engineering",
            "research_areas": ["Edge AI", "IoT Sensors", "Rural Tech"],
        },
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["department"] == "Computer Science & Engineering"
    assert "Edge AI" in patch_res.json()["research_areas"]

    # 7. Faculty Relinquishes Mentorship
    relinq_res = await async_client.delete(
        f"/api/v1/faculty/projects/{project_id}/relinquish",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert relinq_res.status_code == 200
    assert relinq_res.json()["status"] == "success"
