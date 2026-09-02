import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import UserRole
from app.models.institution_master import InstitutionMaster, normalize_institution_name
from app.models.institution_sync import InstitutionSyncError, InstitutionSyncLog
from app.models.user import User
from app.services.institution_provider import InstitutionSyncService, UGCFileDatasetProvider

router = APIRouter(tags=["Institution Verification & Dataset Operations"])


# 1. Public Institution Search API (Paginated & Indexed)
@router.get("/public/institutions")
async def search_public_institutions(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str | None = Query(None, description="Search term for university name or AISHE code"),
    state: str | None = Query(None, description="Optional state filter"),
    limit: int = Query(20, ge=1, le=50, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Page offset"),
):
    query = select(InstitutionMaster).where(
        InstitutionMaster.verification_status == "verified",
        InstitutionMaster.is_active == True,
    )

    if q and len(q.strip()) >= 2:
        norm_q = normalize_institution_name(q.strip())
        raw_q = f"%{q.strip()}%"
        norm_like = f"%{norm_q}%"

        query = query.where(
            (InstitutionMaster.normalized_name.ilike(norm_like))
            | (InstitutionMaster.name.ilike(raw_q))
            | (InstitutionMaster.aishe_code.ilike(raw_q))
            | (InstitutionMaster.district.ilike(raw_q))
        )

    if state and state.strip():
        query = query.where(InstitutionMaster.state.ilike(f"%{state.strip()}%"))

    # Count total matching records for pagination metadata
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Order by normalized_name asc and apply pagination
    query = query.order_by(InstitutionMaster.name.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    institutions = result.scalars().all()

    data = [
        {
            "id": str(inst.id),
            "name": inst.name,
            "aishe_code": inst.aishe_code,
            "city": inst.district,
            "state": inst.state,
            "category": inst.category,
            "verification_status": inst.verification_status,
        }
        for inst in institutions
    ]

    return {
        "success": True,
        "data": data,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# 2. Admin Dataset Import (CSV/JSON File Upload)
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


# 3. Admin Sync History & Audit Logs
@router.get("/admin/institutions/sync-logs")
async def list_institution_sync_logs(
    current_admin: User = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    query = (
        select(InstitutionSyncLog)
        .order_by(InstitutionSyncLog.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    logs = result.scalars().all()

    data = [
        {
            "id": str(log.id),
            "source_name": log.source_name,
            "status": log.status,
            "records_processed": log.records_processed,
            "records_added": log.records_added,
            "records_updated": log.records_updated,
            "records_failed": log.records_failed,
            "started_at": log.started_at,
            "completed_at": log.completed_at,
            "error_summary": log.error_summary,
        }
        for log in logs
    ]

    return {"success": True, "data": data}
