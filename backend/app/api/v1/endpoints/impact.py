import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db
from app.models.enums import ProblemStatus, ProjectStatus, UserRole
from app.models.industry_support import IndustrySupport
from app.models.patent import PatentIP
from app.models.profiles import FacultyProfile, StudentProfile, UniversityProfile
from app.models.project import SolutionProject
from app.models.user import User
from app.schemas.impact import (
    ImpactAccreditationScore,
    ImpactDepartmentMetric,
    ImpactSDGMetric,
    ImpactTopProject,
    InstitutionalImpactResponse,
)

router = APIRouter(prefix="/impact", tags=["Institutional Impact"])


SDG_MAPPING = [
    {
        "keywords": ["water", "sanitation", "jal", "sewage", "purification", "river", "drain"],
        "code": "SDG-6",
        "title": "Clean Water & Sanitation",
        "color": "#00AED9",
    },
    {
        "keywords": ["energy", "solar", "renewable", "power", "grid", "electricity", "biomass", "ev"],
        "code": "SDG-7",
        "title": "Affordable & Clean Energy",
        "color": "#FDB713",
    },
    {
        "keywords": ["climate", "environment", "pollution", "air quality", "smog", "carbon", "waste", "plastic"],
        "code": "SDG-13",
        "title": "Climate Action & Environment",
        "color": "#3F7E44",
    },
    {
        "keywords": ["urban", "city", "smart", "traffic", "roads", "potholes", "transit", "infrastructure", "municipal"],
        "code": "SDG-11",
        "title": "Sustainable Cities & Communities",
        "color": "#FD9D24",
    },
    {
        "keywords": ["health", "medtech", "medical", "hospital", "patient", "disease", "wellness", "mental"],
        "code": "SDG-3",
        "title": "Good Health & Well-Being",
        "color": "#4C9F38",
    },
    {
        "keywords": ["agri", "farm", "crop", "agriculture", "fertilizer", "soil", "food", "harvest"],
        "code": "SDG-2",
        "title": "Zero Hunger & AgriTech",
        "color": "#DDA63A",
    },
    {
        "keywords": ["education", "skilling", "school", "learning", "literacy", "stem"],
        "code": "SDG-4",
        "title": "Quality Education & Skilling",
        "color": "#C5192D",
    },
]


@router.get("/institutional", response_model=InstitutionalImpactResponse)
async def get_institutional_impact(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Computes institutional impact, societal footprint, SDG distribution, departmental metrics,
    and NIRF/NAAC accreditation readiness based on live platform data.
    """
    univ_id = None
    univ_name = "National Innovation & Institutional Governance Network"
    aishe_code = "NAT-HEI-INNOVATION"
    state = "National"
    district = "All Jurisdictions"

    if current_user.role == UserRole.UNIVERSITY and current_user.university_profile:
        u = current_user.university_profile
        univ_id = u.id
        univ_name = u.university_name
        aishe_code = u.aishe_code
        state = u.state
        district = u.district
    elif current_user.role == UserRole.FACULTY and current_user.faculty_profile:
        f = current_user.faculty_profile
        univ_id = f.university_id
        if f.university:
            univ_name = f.university.university_name
            aishe_code = f.university.aishe_code
            state = f.university.state
            district = f.university.district
        else:
            univ_name = "Campus Academic Mentor"
    elif current_user.role == UserRole.STUDENT and current_user.student_profile:
        s = current_user.student_profile
        univ_id = s.university_id
        if s.university:
            univ_name = s.university.university_name
            aishe_code = s.university.aishe_code
            state = s.university.state
            district = s.university.district
        else:
            univ_name = "Campus Innovators Pod"
    elif current_user.role == UserRole.ADMIN:
        # Admin can view aggregate national statistics or fallback to first approved university if exists
        first_univ = (
            await db.execute(select(UniversityProfile).where(UniversityProfile.is_approved.is_(True)).limit(1))
        ).scalar_one_or_none()
        if first_univ:
            univ_name = f"National Benchmark ({first_univ.university_name} Sample)"
            aishe_code = first_univ.aishe_code
            state = first_univ.state
            district = first_univ.district

    from app.models.problem import Problem

    # 1. Fetch Solution Projects with eager relationships
    project_stmt = (
        select(SolutionProject)
        .options(
            selectinload(SolutionProject.problem).selectinload(Problem.endorsements),
            selectinload(SolutionProject.faculty_mentor),
            selectinload(SolutionProject.lead_student),
            selectinload(SolutionProject.members),
        )
        .order_by(SolutionProject.created_at.desc())
    )
    if univ_id:
        project_stmt = project_stmt.where(SolutionProject.university_id == univ_id)
    elif current_user.role == UserRole.FACULTY:
        project_stmt = project_stmt.where(SolutionProject.faculty_mentor_id == current_user.id)

    proj_res = await db.execute(project_stmt)
    projects = proj_res.scalars().all()
    project_ids = [p.id for p in projects]

    # 2. Fetch Patents
    patent_stmt = select(PatentIP).order_by(PatentIP.created_at.desc())
    if univ_id:
        patent_stmt = patent_stmt.where(PatentIP.university_id == univ_id)
    elif current_user.role == UserRole.FACULTY:
        patent_stmt = patent_stmt.where(PatentIP.inventor_id == current_user.id)

    pat_res = await db.execute(patent_stmt)
    patents = pat_res.scalars().all()

    # 3. Fetch Faculty Profiles
    faculty_stmt = select(FacultyProfile)
    if univ_id:
        faculty_stmt = faculty_stmt.where(FacultyProfile.university_id == univ_id)
    fac_res = await db.execute(faculty_stmt)
    faculty_list = fac_res.scalars().all()

    # 4. Fetch Student Profiles
    student_stmt = select(StudentProfile)
    if univ_id:
        student_stmt = student_stmt.where(StudentProfile.university_id == univ_id)
    stu_res = await db.execute(student_stmt)
    student_list = stu_res.scalars().all()

    # 5. Fetch Industry Supports
    supports: list[IndustrySupport] = []
    if project_ids:
        sup_stmt = select(IndustrySupport).where(IndustrySupport.project_id.in_(project_ids))
        sup_res = await db.execute(sup_stmt)
        supports = sup_res.scalars().all()

    # ---------------------------------------------------------------------------
    # KPI Computations
    # ---------------------------------------------------------------------------
    total_solutions_count = len(projects)

    # Active student innovators: unique IDs across student profiles and pod members
    student_ids = {s.user_id for s in student_list}
    for p in projects:
        student_ids.add(p.lead_student_id)
        for m in p.members:
            student_ids.add(m.user_id)
    active_innovator_students_count = len(student_ids)

    # Faculty mentors
    faculty_ids = {f.user_id for f in faculty_list}
    for p in projects:
        if p.faculty_mentor_id:
            faculty_ids.add(p.faculty_mentor_id)
    faculty_mentors_count = len(faculty_ids)

    # Solved civic challenges
    solved_problems_count = sum(
        1
        for p in projects
        if p.status in (ProjectStatus.COMPLETED, ProjectStatus.PILOT)
        or (p.problem and p.problem.status in (ProblemStatus.SOLVED, ProblemStatus.PILOT, ProblemStatus.SOLUTION_SUBMITTED))
    )

    patents_filed_count = len(patents)
    patents_granted_count = sum(1 for p in patents if p.status == "GRANTED")
    industry_partnerships_count = len(supports)

    # CSR Funds mobilized
    approved_supports = [s for s in supports if s.status.value == "approved"]
    csr_count = len(approved_supports) if approved_supports else len(supports)
    if csr_count > 0:
        csr_funds_mobilized = f"₹ {csr_count * 3.5:,.1f} Lakhs"
    else:
        csr_funds_mobilized = "₹ 0"

    # Estimated Citizens Impacted
    total_impacted = 0
    for p in projects:
        if p.problem:
            endorsements = p.problem.__dict__.get("endorsements")
            upvotes = len(endorsements) if endorsements else 0
            is_solved = p.status in (ProjectStatus.COMPLETED, ProjectStatus.PILOT)
            multiplier = 120 if is_solved else 50
            total_impacted += max(upvotes * multiplier, 350)
        else:
            total_impacted += 350
    estimated_citizens_impacted = total_impacted if total_impacted > 0 else (total_solutions_count * 350)

    # ---------------------------------------------------------------------------
    # SDG Categorization Breakdown
    # ---------------------------------------------------------------------------
    sdg_counter: dict[str, dict] = {
        item["code"]: {"title": item["title"], "color": item["color"], "count": 0}
        for item in SDG_MAPPING
    }
    # Add fallback SDG-9
    sdg_counter["SDG-9"] = {
        "title": "Industry, Innovation & Infrastructure",
        "color": "#F36D25",
        "count": 0,
    }

    for p in projects:
        searchable_text = ""
        if p.problem:
            searchable_text += f"{p.problem.title} {p.problem.description} {p.problem.category} "
        searchable_text += f"{p.title} {p.description}"
        searchable_lower = searchable_text.lower()

        matched = False
        for item in SDG_MAPPING:
            if any(k in searchable_lower for k in item["keywords"]):
                sdg_counter[item["code"]]["count"] += 1
                matched = True
                break
        if not matched:
            sdg_counter["SDG-9"]["count"] += 1

    total_sdg_tagged = max(sum(s["count"] for s in sdg_counter.values()), 1)
    sdg_breakdown = [
        ImpactSDGMetric(
            code=code,
            title=data["title"],
            count=data["count"],
            percentage=round((data["count"] / total_sdg_tagged) * 100, 1),
            color=data["color"],
        )
        for code, data in sdg_counter.items()
        if data["count"] > 0
    ]
    if not sdg_breakdown:
        # Default distribution for visual completeness
        sdg_breakdown = [
            ImpactSDGMetric(code="SDG-6", title="Clean Water & Sanitation", count=0, percentage=0.0, color="#00AED9"),
            ImpactSDGMetric(code="SDG-7", title="Affordable & Clean Energy", count=0, percentage=0.0, color="#FDB713"),
            ImpactSDGMetric(code="SDG-11", title="Sustainable Cities & Communities", count=0, percentage=0.0, color="#FD9D24"),
            ImpactSDGMetric(code="SDG-3", title="Good Health & Well-Being", count=0, percentage=0.0, color="#4C9F38"),
            ImpactSDGMetric(code="SDG-9", title="Industry, Innovation & Infrastructure", count=0, percentage=0.0, color="#F36D25"),
        ]

    # ---------------------------------------------------------------------------
    # Departmental Impact Breakdown
    # ---------------------------------------------------------------------------
    dept_map: dict[str, dict[str, int]] = {}

    for f in faculty_list:
        dept = f.department or "Interdisciplinary Sciences"
        if dept not in dept_map:
            dept_map[dept] = {"faculty": 0, "students": 0, "projects": 0, "patents": 0}
        dept_map[dept]["faculty"] += 1

    for s in student_list:
        dept = s.department or "Engineering & Technology"
        if dept not in dept_map:
            dept_map[dept] = {"faculty": 0, "students": 0, "projects": 0, "patents": 0}
        dept_map[dept]["students"] += 1

    faculty_dept_lookup = {f.user_id: (f.department or "Interdisciplinary Sciences") for f in faculty_list}
    student_dept_lookup = {s.user_id: (s.department or "Engineering & Technology") for s in student_list}

    for p in projects:
        dept = None
        if p.faculty_mentor_id and p.faculty_mentor_id in faculty_dept_lookup:
            dept = faculty_dept_lookup[p.faculty_mentor_id]
        elif p.lead_student_id and p.lead_student_id in student_dept_lookup:
            dept = student_dept_lookup[p.lead_student_id]
        elif dept_map:
            dept = next(iter(dept_map.keys()))
        else:
            dept = "Innovation & Technology Pods"

        if dept not in dept_map:
            dept_map[dept] = {"faculty": 0, "students": 0, "projects": 0, "patents": 0}
        dept_map[dept]["projects"] += 1

    for pat in patents:
        dept = "IPR & Technology Transfer Cell"
        if dept_map:
            dept = next(iter(dept_map.keys()))
        if dept not in dept_map:
            dept_map[dept] = {"faculty": 0, "students": 0, "projects": 0, "patents": 0}
        dept_map[dept]["patents"] += 1

    departmental_breakdown = [
        ImpactDepartmentMetric(
            department=dept_name,
            faculty_count=counts["faculty"],
            students_count=counts["students"],
            projects_count=counts["projects"],
            patents_count=counts["patents"],
        )
        for dept_name, counts in dept_map.items()
    ]
    if not departmental_breakdown:
        departmental_breakdown = [
            ImpactDepartmentMetric(
                department="Computer Science & Engineering",
                faculty_count=len(faculty_list),
                students_count=len(student_list),
                projects_count=total_solutions_count,
                patents_count=patents_filed_count,
            )
        ]

    # ---------------------------------------------------------------------------
    # Top Deployed Projects Showcase
    # ---------------------------------------------------------------------------
    top_projects: list[ImpactTopProject] = []
    for p in projects[:6]:
        endorsements = p.problem.__dict__.get("endorsements") if p.problem else None
        top_projects.append(
            ImpactTopProject(
                id=p.id,
                title=p.title,
                team_name=p.team_name,
                problem_title=p.problem.title if p.problem else None,
                category=p.problem.category if p.problem else "Civic Tech",
                status=p.status.value,
                impact_level=p.problem.impact_level.value if p.problem and hasattr(p.problem, "impact_level") else "medium",
                upvotes=len(endorsements) if endorsements else 0,
                faculty_mentor_name=p.faculty_mentor.full_name if p.faculty_mentor else None,
                lead_student_name=p.lead_student.full_name if p.lead_student else None,
                created_at=p.created_at,
            )
        )

    # ---------------------------------------------------------------------------
    # Accreditation Readiness (NIRF / NAAC / KAPILA)
    # ---------------------------------------------------------------------------
    nirf_score = min(98.5, round(25.0 + total_solutions_count * 6.5 + patents_filed_count * 10.0 + len(supports) * 8.0, 1))
    naac_c3 = min(98.0, round(30.0 + patents_filed_count * 12.0 + faculty_mentors_count * 4.0 + total_solutions_count * 4.0, 1))
    naac_c7 = min(98.0, round(35.0 + solved_problems_count * 12.0 + total_solutions_count * 3.5, 1))
    kapila_rate = min(100.0, round((patents_filed_count / max(total_solutions_count, 1)) * 100.0, 1))
    overall_index = round((nirf_score * 0.35 + naac_c3 * 0.35 + naac_c7 * 0.30), 1)

    accreditation_readiness = ImpactAccreditationScore(
        nirf_innovation_score=nirf_score,
        naac_criterion_3_score=naac_c3,
        naac_criterion_7_score=naac_c7,
        kapila_utilization_rate=kapila_rate,
        overall_readiness_index=overall_index,
    )

    return InstitutionalImpactResponse(
        university_name=univ_name,
        aishe_code=aishe_code,
        state=state,
        district=district,
        user_role=current_user.role.value,
        total_solutions_count=total_solutions_count,
        active_innovator_students_count=active_innovator_students_count,
        faculty_mentors_count=faculty_mentors_count,
        solved_problems_count=solved_problems_count,
        patents_filed_count=patents_filed_count,
        patents_granted_count=patents_granted_count,
        industry_partnerships_count=industry_partnerships_count,
        csr_funds_mobilized=csr_funds_mobilized,
        estimated_citizens_impacted=estimated_citizens_impacted,
        sdg_breakdown=sdg_breakdown,
        departmental_breakdown=departmental_breakdown,
        top_projects=top_projects,
        accreditation_readiness=accreditation_readiness,
        generated_at=datetime.now(UTC),
    )
