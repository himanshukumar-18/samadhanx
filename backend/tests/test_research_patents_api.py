import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.profiles import FacultyProfile, UniversityProfile
from app.models.project import SolutionProject
from app.models.problem import Problem
from app.models.user import User


@pytest.mark.asyncio
async def test_research_patents_lifecycle_and_security(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Create University User & Profile
    univ_user = User(
        email="ipr.nodal@iitd.ac.in",
        hashed_password=get_password_hash("IprPass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(univ_user)
    await db_session.flush()

    univ_prof = UniversityProfile(
        user_id=univ_user.id,
        university_name="IIT Delhi IP Cell",
        aishe_code="U-0100",
        state="Delhi",
        district="South Delhi",
        nodal_officer_name="Dr. TTO Director",
        official_email="ipr.nodal@iitd.ac.in",
        is_approved=True,
    )
    db_session.add(univ_prof)

    # 2. Create Faculty User
    faculty_user = User(
        email="prof.inventor@iitd.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(faculty_user)
    await db_session.flush()

    faculty_prof = FacultyProfile(
        user_id=faculty_user.id,
        university_id=univ_prof.id,
        created_by=univ_user.id,
        full_name="Prof. Inventor",
        department="Biochemical Engineering",
        designation="Professor",
        research_areas=["Nanotechnology", "CleanTech"],
    )
    db_session.add(faculty_prof)

    # 3. Create Student User & Solution Project
    student_user = User(
        email="student.researcher@iitd.ac.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(student_user)
    await db_session.flush()

    problem = Problem(
        created_by_id=student_user.id,
        title="Air Quality Nanofilter",
        description="Nanofiber matrix for smog PM2.5 filtration in urban centers.",
        category="Environment",
        location="Delhi",
        district="South Delhi",
        state="Delhi",
    )
    db_session.add(problem)
    await db_session.flush()

    project = SolutionProject(
        problem_id=problem.id,
        team_name="AeroPure Pod",
        title="Electrostatically Charged Nanofiber Mask Filter",
        description="High-capture efficiency biodegradable nanofiber filter.",
        lead_student_id=student_user.id,
        faculty_mentor_id=faculty_user.id,
        university_id=univ_prof.id,
    )
    db_session.add(project)
    await db_session.commit()

    univ_token = create_access_token(univ_user.id, univ_user.role.value)
    faculty_token = create_access_token(faculty_user.id, faculty_user.role.value)

    # 4. University TTO Files a Patent Application
    patent_payload = {
        "project_id": str(project.id),
        "title": "Biodegradable Electrostatic Nanofiber Filter Matrix",
        "application_number": "202611099881",
        "filing_date": "2026-09-10",
        "status": "PROVISIONAL_FILED",
        "patent_office": "Indian Patent Office (IPO)",
        "abstract": "A novel electrostatically charged biodegradable cellulose nanofiber matrix with sub-micron particulate filtration efficiency exceeding 99.4%.",
        "field_of_invention": "CleanTech / Materials Science",
        "commercial_readiness": "TRL-6 (Prototype Demo)",
    }
    file_res = await async_client.post(
        "/api/v1/research/patents",
        json=patent_payload,
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    assert file_res.status_code == 201
    patent_data = file_res.json()
    assert patent_data["application_number"] == "202611099881"
    assert patent_data["project_title"] == "Electrostatically Charged Nanofiber Mask Filter"
    assert patent_data["status"] == "PROVISIONAL_FILED"
    patent_id = patent_data["id"]

    # 5. Duplicate Application Number check -> 409 Conflict
    dup_res = await async_client.post(
        "/api/v1/research/patents",
        json=patent_payload,
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    assert dup_res.status_code == 409

    # 6. Faculty and University Query Patents Overview
    overview_res = await async_client.get(
        "/api/v1/research/patents",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert overview_data["total_patents_count"] >= 1
    assert len(overview_data["patents"]) >= 1
    assert overview_data["provisional_filed_count"] >= 1
    assert len(overview_data["eligible_projects"]) >= 1

    # 7. Advance Status to GRANTED
    update_res = await async_client.patch(
        f"/api/v1/research/patents/{patent_id}/status",
        json={"status": "GRANTED", "grant_number": "IN-PAT-445892", "grant_date": "2026-09-10"},
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "GRANTED"
    assert update_res.json()["grant_number"] == "IN-PAT-445892"
