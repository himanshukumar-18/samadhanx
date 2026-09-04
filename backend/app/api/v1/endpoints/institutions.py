import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.core.rate_limit import rate_limiter
from app.models.enums import UserRole
from app.models.institution_master import InstitutionMaster, normalize_institution_name
from app.models.institution_sync import InstitutionSyncLog
from app.models.user import User
from app.schemas.common import StandardApiResponse
from app.schemas.institution import (
    InstitutionDetailResponse,
    InstitutionMasterAdminItem,
    InstitutionRequestReviewAction,
    InstitutionSearchItem,
    InstitutionSyncRunResponse,
    InstitutionVerificationRequestCreate,
    InstitutionVerificationRequestResponse,
)
from app.services.institution_provider import (
    InstitutionRequestService,
    InstitutionSyncService,
    UGCFileDatasetProvider,
)

router = APIRouter(tags=["Institution Verification & Dataset Operations"])


# ===========================================================================
# 1. Public Institution Search & Discovery APIs
# ===========================================================================

@router.get("/public/institutions", response_model=StandardApiResponse[list[InstitutionSearchItem]])
async def search_public_institutions(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str | None = Query(None, description="Search term for name, short name, AISHE, or UGC code"),
    state: str | None = Query(None, description="Optional state filter"),
    institution_type: str | None = Query(None, description="Optional institution type filter"),
    limit: int = Query(20, ge=1, le=50, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Page offset"),
):
    query = select(InstitutionMaster).where(
        InstitutionMaster.verification_status == "verified",
        InstitutionMaster.is_active.is_(True),
    )

    if q and len(q.strip()) >= 2:
        clean_q = q.strip()
        norm_q = normalize_institution_name(clean_q)
        raw_q = f"%{clean_q}%"
        norm_like = f"%{norm_q}%"

        query = query.where(
            (InstitutionMaster.normalized_name.ilike(norm_like))
            | (InstitutionMaster.name.ilike(raw_q))
            | (InstitutionMaster.official_name.ilike(raw_q))
            | (InstitutionMaster.short_name.ilike(raw_q))
            | (InstitutionMaster.aishe_code.ilike(raw_q))
            | (InstitutionMaster.ugc_code.ilike(raw_q))
            | (InstitutionMaster.district.ilike(raw_q))
            | (InstitutionMaster.city.ilike(raw_q))
        )

    if state and state.strip():
        query = query.where(InstitutionMaster.state.ilike(f"%{state.strip()}%"))

    if institution_type and institution_type.strip():
        query = query.where(InstitutionMaster.institution_type.ilike(f"%{institution_type.strip()}%"))

    # Count total matching records
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(InstitutionMaster.name.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    institutions = result.scalars().all()

    items = [
        InstitutionSearchItem(
            id=inst.id,
            name=inst.name,
            official_name=inst.official_name,
            short_name=inst.short_name,
            institution_type=inst.institution_type or "University",
            ownership_type=inst.ownership_type or "Government",
            aishe_code=inst.aishe_code,
            ugc_code=inst.ugc_code,
            city=inst.city or inst.district,
            district=inst.district,
            state=inst.state,
            website=inst.website,
            verification_status=inst.verification_status,
            is_active=inst.is_active,
        )
        for inst in institutions
    ]

    return StandardApiResponse(success=True, data=items, message=f"Found {total} institutions.")


@router.get("/public/institutions/{institution_id}", response_model=StandardApiResponse[InstitutionDetailResponse])
async def get_public_institution_detail(
    institution_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(InstitutionMaster).where(InstitutionMaster.id == institution_id)
    res = await db.execute(stmt)
    inst = res.scalar_one_or_none()

    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "INSTITUTION_NOT_FOUND", "message": "Institution does not exist."},
        )

    item = InstitutionDetailResponse(
        id=inst.id,
        name=inst.name,
        official_name=inst.official_name,
        short_name=inst.short_name,
        institution_type=inst.institution_type or "University",
        ownership_type=inst.ownership_type or "Government",
        aishe_code=inst.aishe_code,
        ugc_code=inst.ugc_code,
        city=inst.city,
        district=inst.district,
        state=inst.state,
        pincode=inst.pincode,
        address=inst.address,
        website=inst.website,
        verification_status=inst.verification_status,
        source=inst.source,
        last_verified_at=inst.last_verified_at,
    )
    return StandardApiResponse(success=True, data=item)


# ===========================================================================
# 2. Public "Institution Not Listed" Fallback Verification Request
# ===========================================================================

@router.post(
    "/public/institutions/request-verification",
    response_model=StandardApiResponse[InstitutionVerificationRequestResponse],
    dependencies=[Depends(rate_limiter(15, "rl_inst_req"))],
)
async def submit_institution_verification_request(
    data: InstitutionVerificationRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Public fallback for students whose college/university is missing or newly recognized.
    Submits a pending verification request for admin review without blocking the student.
    """
    service = InstitutionRequestService(db=db)
    req = await service.create_verification_request(data=data)

    item = InstitutionVerificationRequestResponse.model_validate(req)
    return StandardApiResponse(
        success=True,
        data=item,
        message="Institution verification request submitted successfully. An administrator will review your institution.",
    )


# ===========================================================================
# 3. Admin Institution Verification Requests Governance
# ===========================================================================

@router.get(
    "/admin/institutions/requests",
    response_model=StandardApiResponse[list[InstitutionVerificationRequestResponse]],
)
async def list_institution_requests(
    status_filter: str | None = Query(None, description="PENDING, APPROVED, REJECTED, or ALL"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    service = InstitutionRequestService(db=db)
    requests, total = await service.list_requests(status_filter=status_filter, offset=offset, limit=limit)
    items = [InstitutionVerificationRequestResponse.model_validate(r) for r in requests]
    return StandardApiResponse(success=True, data=items, message=f"Total {total} requests found.")


@router.patch(
    "/admin/institutions/requests/{request_id}/approve",
    response_model=StandardApiResponse[InstitutionVerificationRequestResponse],
)
async def approve_institution_request(
    request_id: uuid.UUID,
    overrides: InstitutionRequestReviewAction | None = None,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    service = InstitutionRequestService(db=db)
    req, master_inst = await service.approve_request(
        request_id=request_id, admin_id=current_admin.id, overrides=overrides
    )
    item = InstitutionVerificationRequestResponse.model_validate(req)
    return StandardApiResponse(
        success=True,
        data=item,
        message=f"Approved institution '{master_inst.name}' into Verified Institution Master.",
    )


@router.patch(
    "/admin/institutions/requests/{request_id}/reject",
    response_model=StandardApiResponse[InstitutionVerificationRequestResponse],
)
async def reject_institution_request(
    request_id: uuid.UUID,
    payload: InstitutionRequestReviewAction,
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    service = InstitutionRequestService(db=db)
    req = await service.reject_request(
        request_id=request_id,
        admin_id=current_admin.id,
        rejection_reason=payload.rejection_reason or "Institution credentials could not be verified.",
    )
    item = InstitutionVerificationRequestResponse.model_validate(req)
    return StandardApiResponse(success=True, data=item, message="Institution verification request rejected.")


# ===========================================================================
# 4. Admin Institution Master Management & Dataset Import
# ===========================================================================

@router.get("/admin/institutions", response_model=StandardApiResponse[list[InstitutionMasterAdminItem]])
async def list_admin_institutions(
    q: str | None = Query(None),
    state: str | None = Query(None),
    verification_status: str | None = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = select(InstitutionMaster)
    if q and len(q.strip()) >= 2:
        query = query.where(
            InstitutionMaster.name.ilike(f"%{q.strip()}%")
            | InstitutionMaster.aishe_code.ilike(f"%{q.strip()}%")
        )
    if state:
        query = query.where(InstitutionMaster.state.ilike(f"%{state.strip()}%"))
    if verification_status:
        query = query.where(InstitutionMaster.verification_status == verification_status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(InstitutionMaster.created_at.desc()).offset(offset).limit(limit)
    institutions = (await db.execute(query)).scalars().all()

    items = [
        InstitutionMasterAdminItem(
            id=inst.id,
            name=inst.name,
            official_name=inst.official_name,
            short_name=inst.short_name,
            institution_type=inst.institution_type or "University",
            ownership_type=inst.ownership_type or "Government",
            aishe_code=inst.aishe_code,
            ugc_code=inst.ugc_code,
            district=inst.district,
            state=inst.state,
            city=inst.city,
            website=inst.website,
            verification_status=inst.verification_status,
            status=inst.status or "ACTIVE",
            is_active=inst.is_active,
            source=inst.source,
            last_verified_at=inst.last_verified_at,
            created_at=inst.created_at,
        )
        for inst in institutions
    ]
    return StandardApiResponse(success=True, data=items, message=f"Total {total} institutions.")


@router.post("/admin/institutions/import-csv")
async def import_institutions_csv(
    file: UploadFile = File(...),
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")

    file_type = "json" if file.filename.endswith(".json") else "csv"
    provider = UGCFileDatasetProvider(file_content=file_bytes, file_type=file_type)
    service = InstitutionSyncService(db=db)

    sync_log = await service.sync_from_provider(
        provider=provider,
        source_name=f"admin_import_{file.filename}",
    )

    return {
        "success": True,
        "message": f"Successfully processed dataset '{file.filename}'.",
        "data": {
            "sync_id": str(sync_log.id),
            "status": sync_log.status,
            "records_processed": sync_log.records_processed,
            "records_added": sync_log.records_added,
            "records_updated": sync_log.records_updated,
            "records_failed": sync_log.records_failed,
        },
    }


@router.get("/admin/institutions/sync-logs", response_model=StandardApiResponse[list[InstitutionSyncRunResponse]])
async def list_institution_sync_logs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(InstitutionSyncLog)
        .order_by(InstitutionSyncLog.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    logs = result.scalars().all()

    items = [InstitutionSyncRunResponse.model_validate(log) for log in logs]
    return StandardApiResponse(success=True, data=items)
