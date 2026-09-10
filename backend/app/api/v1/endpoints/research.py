import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db
from app.models.audit_log import AuditLog
from app.models.enums import UserRole
from app.models.patent import PatentIP
from app.models.project import SolutionProject
from app.models.user import User
from app.schemas.patent import (
    PatentCreate,
    PatentResponse,
    PatentsOverviewResponse,
    PatentUpdateStatus,
)

router = APIRouter(prefix="/research", tags=["Research & Patents IP"])


@router.get("/patents", response_model=PatentsOverviewResponse)
async def get_patents_overview(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns role-aware Patents & IP portfolio overview along with eligible student innovation pods.
    """
    # 1. Determine University ID context
    univ_id = None
    univ_name = None
    if current_user.role == UserRole.UNIVERSITY and current_user.university_profile:
        univ_id = current_user.university_profile.id
        univ_name = current_user.university_profile.university_name
    elif current_user.role == UserRole.FACULTY and current_user.faculty_profile:
        univ_id = current_user.faculty_profile.university_id
        if current_user.faculty_profile.university:
            univ_name = current_user.faculty_profile.university.university_name
    elif current_user.role == UserRole.STUDENT and current_user.student_profile:
        univ_id = current_user.student_profile.university_id
        if current_user.student_profile.university:
            univ_name = current_user.student_profile.university.university_name

    # 2. Query Patents
    patent_query = (
        select(PatentIP)
        .options(
            selectinload(PatentIP.project),
            selectinload(PatentIP.university),
            selectinload(PatentIP.inventor),
        )
        .order_by(PatentIP.filing_date.desc(), PatentIP.created_at.desc())
    )

    if current_user.role == UserRole.UNIVERSITY and univ_id:
        patent_query = patent_query.where(PatentIP.university_id == univ_id)
    elif current_user.role == UserRole.FACULTY:
        if univ_id:
            patent_query = patent_query.where(
                (PatentIP.inventor_id == current_user.id) | (PatentIP.university_id == univ_id)
            )
        else:
            patent_query = patent_query.where(PatentIP.inventor_id == current_user.id)
    elif current_user.role == UserRole.STUDENT:
        patent_query = patent_query.where(PatentIP.inventor_id == current_user.id)

    res = await db.execute(patent_query)
    patents = res.scalars().all()

    # 3. Query Eligible Student Projects
    proj_query = (
        select(SolutionProject)
        .options(
            selectinload(SolutionProject.problem),
            selectinload(SolutionProject.university),
        )
        .order_by(SolutionProject.created_at.desc())
        .limit(20)
    )
    if univ_id:
        proj_query = proj_query.where(SolutionProject.university_id == univ_id)

    proj_res = await db.execute(proj_query)
    projects = proj_res.scalars().all()

    # 4. Aggregate metrics
    total_count = len(patents)
    granted_count = sum(1 for p in patents if p.status == "GRANTED")
    provisional_count = sum(1 for p in patents if p.status == "PROVISIONAL_FILED")
    under_exam_count = sum(1 for p in patents if p.status in ("EXAMINATION", "PUBLISHED"))
    commercial_count = sum(
        1 for p in patents if any(k in (p.commercial_readiness or "") for k in ("TRL-6", "TRL-7", "TRL-8", "TRL-9"))
    )

    return PatentsOverviewResponse(
        patents=[PatentResponse.model_validate(p) for p in patents],
        eligible_projects=[
            {
                "id": p.id,
                "title": p.title,
                "team_name": p.team_name,
                "description": p.description,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                "university_name": p.university.university_name if p.university else None,
                "problem_title": p.problem.title if p.problem else None,
                "created_at": p.created_at,
            }
            for p in projects
        ],
        total_patents_count=total_count,
        granted_patents_count=granted_count,
        provisional_filed_count=provisional_count,
        under_examination_count=under_exam_count,
        commercial_ready_count=commercial_count,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        university_name=univ_name,
    )


@router.post("/patents", response_model=PatentResponse, status_code=status.HTTP_201_CREATED)
async def file_patent_disclosure(
    data: PatentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    File a new institutional patent application or IP disclosure.
    """
    # Check duplicate application number
    dup = (
        await db.execute(select(PatentIP).where(PatentIP.application_number == data.application_number.strip()))
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "APPLICATION_EXISTS", "message": "A patent filing with this application number already exists."},
        )

    # Determine university association
    univ_id = None
    if current_user.role == UserRole.UNIVERSITY and current_user.university_profile:
        univ_id = current_user.university_profile.id
    elif current_user.role == UserRole.FACULTY and current_user.faculty_profile:
        univ_id = current_user.faculty_profile.university_id
    elif data.project_id:
        proj = (await db.execute(select(SolutionProject).where(SolutionProject.id == data.project_id))).scalar_one_or_none()
        if proj:
            univ_id = proj.university_id

    patent = PatentIP(
        project_id=data.project_id,
        university_id=univ_id,
        inventor_id=current_user.id,
        title=data.title.strip(),
        application_number=data.application_number.strip(),
        filing_date=data.filing_date,
        status=data.status,
        patent_office=data.patent_office,
        abstract=data.abstract.strip(),
        field_of_invention=data.field_of_invention,
        commercial_readiness=data.commercial_readiness,
    )
    db.add(patent)
    await db.flush()

    audit = AuditLog(
        actor_id=current_user.id,
        action="CREATE_PATENT_FILING",
        target_type="patent_ip",
        target_id=str(patent.id),
        metadata_json={
            "application_number": patent.application_number,
            "title": patent.title,
            "field": patent.field_of_invention,
        },
    )
    db.add(audit)
    await db.commit()

    # Re-fetch with relationships
    query = (
        select(PatentIP)
        .options(
            selectinload(PatentIP.project),
            selectinload(PatentIP.university),
            selectinload(PatentIP.inventor),
        )
        .where(PatentIP.id == patent.id)
    )
    saved_patent = (await db.execute(query)).scalar_one()
    return PatentResponse.model_validate(saved_patent)


@router.patch("/patents/{patent_id}/status", response_model=PatentResponse)
async def update_patent_status(
    patent_id: uuid.UUID,
    data: PatentUpdateStatus,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Advance patent lifecycle status (e.g. to PUBLISHED, EXAMINATION, GRANTED).
    BOLA check: Inventor, university officer from same university, or admin.
    """
    query = (
        select(PatentIP)
        .options(
            selectinload(PatentIP.project),
            selectinload(PatentIP.university),
            selectinload(PatentIP.inventor),
        )
        .where(PatentIP.id == patent_id)
    )
    patent = (await db.execute(query)).scalar_one_or_none()
    if not patent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATENT_NOT_FOUND", "message": "Patent record not found."},
        )

    # BOLA check
    is_authorized = False
    if current_user.role == UserRole.ADMIN:
        is_authorized = True
    elif current_user.id == patent.inventor_id:
        is_authorized = True
    elif (
        current_user.role == UserRole.UNIVERSITY
        and current_user.university_profile
        and current_user.university_profile.id == patent.university_id
    ):
        is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You are not authorized to update this patent status."},
        )

    patent.status = data.status
    if data.grant_number:
        patent.grant_number = data.grant_number
    if data.grant_date:
        patent.grant_date = data.grant_date

    audit = AuditLog(
        actor_id=current_user.id,
        action="UPDATE_PATENT_STATUS",
        target_type="patent_ip",
        target_id=str(patent.id),
        metadata_json={
            "status": data.status,
            "grant_number": data.grant_number,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(patent)
    return PatentResponse.model_validate(patent)
