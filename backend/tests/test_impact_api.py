import uuid
from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import ImpactLevel, ProblemStatus, ProjectStatus, UserRole
from app.models.patent import PatentIP
from app.models.problem import Problem
from app.models.profiles import FacultyProfile, StudentProfile, UniversityProfile
from app.models.project import ProjectMember, SolutionProject
from app.models.user import User


@pytest.mark.asyncio
async def test_institutional_impact_overview(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Unauthenticated request -> 401
    unauth_res = await async_client.get("/api/v1/impact/institutional")
    assert unauth_res.status_code == 401

    # 2. Setup University User & Profile
    univ_user = User(
        email="impact.dean@annauniv.edu",
        hashed_password=get_password_hash("AnnaUniv123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(univ_user)
    await db_session.flush()

    univ_prof = UniversityProfile(
        user_id=univ_user.id,
        university_name="Anna University Chennai",
        aishe_code="U-0436",
        state="Tamil Nadu",
        district="Chennai",
        nodal_officer_name="Dr. Research Dean",
        official_email="impact.dean@annauniv.edu",
        is_approved=True,
    )
    db_session.add(univ_prof)
    await db_session.flush()

    # 3. Setup Faculty User & Profile
    fac_user = User(
        email="mentor.prof@annauniv.edu",
        hashed_password=get_password_hash("Pass123!"),
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
        full_name="Dr. Sundar Mentor",
        department="Environmental Engineering",
        designation="Associate Professor",
        research_areas=["Water Treatment", "Desalination"],
    )
    db_session.add(fac_prof)
    await db_session.flush()

    # 4. Setup Student User & Profile
    stu_user = User(
        email="student.lead@annauniv.edu",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(stu_user)
    await db_session.flush()

    stu_prof = StudentProfile(
        user_id=stu_user.id,
        university_id=univ_prof.id,
        full_name="Kavitha Innovator",
        department="Environmental Engineering",
        graduation_year=2027,
    )
    db_session.add(stu_prof)
    await db_session.flush()

    # 5. Setup Problem & Solution Project
    problem = Problem(
        created_by_id=stu_user.id,
        title="Urban Brackish Groundwater Desalination",
        description="Low-cost capacitive deionization system for community drinking water purification.",
        category="Water Management",
        impact_level=ImpactLevel.CRITICAL,
        location="Chennai",
        district="Chennai",
        state="Tamil Nadu",
        status=ProblemStatus.PILOT,
    )
    db_session.add(problem)
    await db_session.flush()

    project = SolutionProject(
        problem_id=problem.id,
        team_name="HydroPure Pod",
        title="Solar Capacitive Deionization Water Unit",
        description="Field pilot deployable water purification skid running on solar power.",
        lead_student_id=stu_user.id,
        faculty_mentor_id=fac_user.id,
        university_id=univ_prof.id,
        status=ProjectStatus.PILOT,
    )
    db_session.add(project)
    await db_session.flush()

    member = ProjectMember(
        project_id=project.id,
        user_id=stu_user.id,
        role_in_team="Team Lead",
    )
    db_session.add(member)

    # 6. Setup Patent
    patent = PatentIP(
        project_id=project.id,
        university_id=univ_prof.id,
        inventor_id=fac_user.id,
        title="Capacitive Deionization Matrix using Graphene Oxide Carbon Electrodes",
        application_number="202641011223",
        filing_date=date(2026, 9, 10),
        status="GRANTED",
        grant_number="IN-PAT-998811",
        grant_date=date(2026, 9, 10),
        patent_office="Indian Patent Office (IPO)",
        abstract="Novel high-durability electrode configuration for rapid ion adsorption in saline groundwaters.",
        field_of_invention="Water Treatment",
        commercial_readiness="TRL-7 (Operational Prototype)",
    )
    db_session.add(patent)
    await db_session.commit()

    univ_token = create_access_token(univ_user.id, univ_user.role.value)
    fac_token = create_access_token(fac_user.id, fac_user.role.value)

    # 7. Query Impact as University Nodal Officer
    univ_res = await async_client.get(
        "/api/v1/impact/institutional",
        headers={"Authorization": f"Bearer {univ_token}"},
    )
    assert univ_res.status_code == 200
    data = univ_res.json()

    assert data["university_name"] == "Anna University Chennai"
    assert data["aishe_code"] == "U-0436"
    assert data["total_solutions_count"] >= 1
    assert data["patents_filed_count"] >= 1
    assert data["patents_granted_count"] >= 1
    assert data["active_innovator_students_count"] >= 1
    assert data["faculty_mentors_count"] >= 1
    assert data["solved_problems_count"] >= 1
    assert data["estimated_citizens_impacted"] >= 350
    assert len(data["sdg_breakdown"]) >= 1
    assert any(s["code"] == "SDG-6" for s in data["sdg_breakdown"])
    assert len(data["departmental_breakdown"]) >= 1
    assert len(data["top_projects"]) >= 1
    assert data["top_projects"][0]["title"] == "Solar Capacitive Deionization Water Unit"
    assert data["accreditation_readiness"]["overall_readiness_index"] > 20.0

    # 8. Query Impact as Faculty Mentor
    fac_res = await async_client.get(
        "/api/v1/impact/institutional",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert fac_res.status_code == 200
    fac_data = fac_res.json()
    assert fac_data["university_name"] == "Anna University Chennai"
    assert fac_data["total_solutions_count"] >= 1
