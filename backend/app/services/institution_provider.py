import csv
import io
import json
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.public import invalidate_public_universities_cache
from app.models.audit_log import AuditLog
from app.models.institution_master import InstitutionMaster, normalize_institution_name
from app.models.institution_request import InstitutionVerificationRequest
from app.models.institution_sync import InstitutionSyncError, InstitutionSyncLog
from app.models.profiles import StudentProfile
from app.schemas.institution import (
    InstitutionRequestReviewAction,
    InstitutionVerificationRequestCreate,
)

logger = logging.getLogger(__name__)


class InstitutionProviderInterface(ABC):
    """Abstract Base Class for Institution Dataset Providers."""

    @abstractmethod
    def fetch_records(self) -> list[dict[str, Any]]:
        """Fetch raw records from the data source."""
        pass


class UGCFileDatasetProvider(InstitutionProviderInterface):
    """Provider that parses official UGC / AISHE dataset CSV or JSON content."""

    def __init__(self, file_content: bytes | str, file_type: str = "csv"):
        self.file_content = file_content
        self.file_type = file_type.lower()

    def fetch_records(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []

        if isinstance(self.file_content, bytes):
            content_str = self.file_content.decode("utf-8-sig", errors="ignore")
        else:
            content_str = self.file_content

        if self.file_type in ["json", "application/json"]:
            try:
                data = json.loads(content_str)
                if isinstance(data, list):
                    records = data
                elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                    records = data["data"]
            except Exception as e:
                logger.error(f"Failed to parse JSON dataset: {e}")
                raise ValueError(f"Invalid JSON dataset: {e}") from e
        else:
            # Parse CSV
            csv_file = io.StringIO(content_str)
            reader = csv.DictReader(csv_file)
            for row in reader:
                records.append(dict(row))

        return records


class InstitutionSyncService:
    """Service to safely ingest, validate, normalize, and upsert institutions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def sync_from_provider(
        self,
        provider: InstitutionProviderInterface,
        source_name: str = "ugc_dataset",
    ) -> InstitutionSyncLog:
        started_at = datetime.now(UTC)
        sync_log = InstitutionSyncLog(
            source_name=source_name,
            status="processing",
            records_processed=0,
            records_added=0,
            records_updated=0,
            records_failed=0,
            started_at=started_at,
        )
        self.db.add(sync_log)
        await self.db.flush()

        try:
            raw_records = provider.fetch_records()
        except Exception as e:
            sync_log.status = "failed"
            sync_log.error_summary = f"Failed to fetch records from provider: {e}"
            sync_log.completed_at = datetime.now(UTC)
            await self.db.commit()
            return sync_log

        now_utc = datetime.now(UTC)

        for idx, raw_record in enumerate(raw_records, start=1):
            sync_log.records_processed += 1

            # Extract fields with flex mapping
            name = (
                raw_record.get("name")
                or raw_record.get("university_name")
                or raw_record.get("institution_name")
                or raw_record.get("College Name")
                or raw_record.get("University Name")
                or ""
            ).strip()

            official_name = (
                raw_record.get("official_name")
                or raw_record.get("Official Name")
                or name
            ).strip()

            short_name = (
                raw_record.get("short_name")
                or raw_record.get("Short Name")
                or raw_record.get("acronym")
                or None
            )
            if short_name:
                short_name = str(short_name).strip()

            state = (
                raw_record.get("state")
                or raw_record.get("State")
                or raw_record.get("state_name")
                or ""
            ).strip()

            district = (
                raw_record.get("district")
                or raw_record.get("District")
                or raw_record.get("city")
                or raw_record.get("City")
                or state
                or "General"
            ).strip()

            city = (
                raw_record.get("city")
                or raw_record.get("City")
                or district
            ).strip()

            aishe_code = (
                raw_record.get("aishe_code")
                or raw_record.get("AISHE Code")
                or raw_record.get("aishe")
                or None
            )
            if aishe_code:
                aishe_code = str(aishe_code).strip()

            ugc_code = (
                raw_record.get("ugc_code")
                or raw_record.get("UGC Code")
                or raw_record.get("ugc")
                or None
            )
            if ugc_code:
                ugc_code = str(ugc_code).strip()

            website = (
                raw_record.get("website")
                or raw_record.get("Website")
                or raw_record.get("url")
                or None
            )

            inst_type = (
                raw_record.get("institution_type")
                or raw_record.get("Institution Type")
                or raw_record.get("category")
                or raw_record.get("type")
                or "UNIVERSITY"
            ).upper().strip()

            ownership = (
                raw_record.get("ownership_type")
                or raw_record.get("Ownership Type")
                or "GOVERNMENT"
            ).upper().strip()

            # Validation rules
            if not name or len(name) < 3:
                sync_log.records_failed += 1
                error_item = InstitutionSyncError(
                    sync_log_id=sync_log.id,
                    row_number=idx,
                    raw_data_json=raw_record,
                    error_message="Validation error: Institution name missing or too short (min 3 chars).",
                )
                self.db.add(error_item)
                continue

            if not state:
                sync_log.records_failed += 1
                error_item = InstitutionSyncError(
                    sync_log_id=sync_log.id,
                    row_number=idx,
                    raw_data_json=raw_record,
                    error_message="Validation error: State field is required.",
                )
                self.db.add(error_item)
                continue

            norm_name = normalize_institution_name(name)

            # Match existing by AISHE code or UGC code or (normalized_name, state)
            existing: InstitutionMaster | None = None
            if aishe_code:
                stmt = select(InstitutionMaster).where(InstitutionMaster.aishe_code == aishe_code)
                res = await self.db.execute(stmt)
                existing = res.scalar_one_or_none()

            if not existing and ugc_code:
                stmt = select(InstitutionMaster).where(InstitutionMaster.ugc_code == ugc_code)
                res = await self.db.execute(stmt)
                existing = res.scalar_one_or_none()

            if not existing:
                stmt = select(InstitutionMaster).where(
                    InstitutionMaster.normalized_name == norm_name,
                    InstitutionMaster.state == state,
                )
                res = await self.db.execute(stmt)
                existing = res.scalar_one_or_none()

            if existing:
                existing.name = name
                existing.official_name = official_name
                if short_name:
                    existing.short_name = short_name
                existing.district = district
                existing.city = city
                existing.state = state
                if aishe_code:
                    existing.aishe_code = aishe_code
                if ugc_code:
                    existing.ugc_code = ugc_code
                if website:
                    existing.website = website
                existing.institution_type = inst_type
                existing.ownership_type = ownership
                existing.source = source_name
                existing.last_synced_at = now_utc
                existing.last_verified_at = now_utc
                sync_log.records_updated += 1
            else:
                new_inst = InstitutionMaster(
                    name=name,
                    official_name=official_name,
                    short_name=short_name,
                    normalized_name=norm_name,
                    institution_type=inst_type,
                    ownership_type=ownership,
                    aishe_code=aishe_code,
                    ugc_code=ugc_code,
                    state=state,
                    district=district,
                    city=city,
                    website=website,
                    category=inst_type.capitalize(),
                    source=source_name,
                    verification_status="verified",
                    status="ACTIVE",
                    is_active=True,
                    last_verified_at=now_utc,
                    last_synced_at=now_utc,
                )
                self.db.add(new_inst)
                sync_log.records_added += 1

        sync_log.status = "success" if sync_log.records_failed == 0 else "partial"
        sync_log.completed_at = datetime.now(UTC)
        await self.db.commit()

        # Invalidate public universities cache
        invalidate_public_universities_cache()
        return sync_log


class InstitutionRequestService:
    """Service to manage student verification requests for unlisted institutions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_verification_request(
        self,
        data: InstitutionVerificationRequestCreate,
        user_id: uuid.UUID | None = None,
    ) -> InstitutionVerificationRequest:
        req = InstitutionVerificationRequest(
            submitted_by_email=data.submitted_by_email.lower(),
            submitted_by_user_id=user_id,
            requested_name=data.requested_name.strip(),
            institution_type=data.institution_type.strip(),
            state=data.state.strip(),
            district=data.district.strip(),
            city=data.city.strip() if data.city else None,
            official_website=data.official_website.strip() if data.official_website else None,
            aishe_code=data.aishe_code.strip() if data.aishe_code else None,
            ugc_code=data.ugc_code.strip() if data.ugc_code else None,
            additional_notes=data.additional_notes.strip() if data.additional_notes else None,
            status="PENDING",
        )
        self.db.add(req)
        await self.db.flush()

        audit = AuditLog(
            actor_id=user_id,
            action="INSTITUTION_VERIFICATION_REQUESTED",
            target_type="institution_request",
            target_id=str(req.id),
            metadata_json={
                "requested_name": req.requested_name,
                "state": req.state,
                "email": req.submitted_by_email,
            },
        )
        self.db.add(audit)
        await self.db.commit()
        return req

    async def list_requests(
        self,
        status_filter: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[InstitutionVerificationRequest], int]:
        query = select(InstitutionVerificationRequest).order_by(
            InstitutionVerificationRequest.created_at.desc()
        )
        if status_filter and status_filter.upper() != "ALL":
            query = query.where(InstitutionVerificationRequest.status == status_filter.upper())

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def approve_request(
        self,
        request_id: uuid.UUID,
        admin_id: uuid.UUID,
        overrides: InstitutionRequestReviewAction | None = None,
    ) -> tuple[InstitutionVerificationRequest, InstitutionMaster]:
        stmt = select(InstitutionVerificationRequest).where(InstitutionVerificationRequest.id == request_id)
        res = await self.db.execute(stmt)
        req = res.scalar_one_or_none()

        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "REQUEST_NOT_FOUND", "message": "Verification request not found."},
            )

        if req.status == "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ALREADY_APPROVED", "message": "This request is already approved."},
            )

        inst_name = req.requested_name
        norm_name = normalize_institution_name(inst_name)
        now_utc = datetime.now(UTC)

        # Check if already in master
        existing_stmt = select(InstitutionMaster).where(
            (InstitutionMaster.normalized_name == norm_name) & (InstitutionMaster.state == req.state)
        )
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()

        if existing:
            existing.verification_status = "verified"
            existing.is_active = True
            existing.status = "ACTIVE"
            existing.last_verified_at = now_utc
            if overrides and overrides.official_name:
                existing.official_name = overrides.official_name
            master_inst = existing
        else:
            master_inst = InstitutionMaster(
                name=inst_name,
                official_name=(overrides and overrides.official_name) or inst_name,
                short_name=(overrides and overrides.short_name) or None,
                normalized_name=norm_name,
                institution_type=(overrides and overrides.institution_type) or req.institution_type or "COLLEGE",
                ownership_type=(overrides and overrides.ownership_type) or "GOVERNMENT",
                aishe_code=(overrides and overrides.aishe_code) or req.aishe_code,
                ugc_code=(overrides and overrides.ugc_code) or req.ugc_code,
                state=req.state,
                district=req.district,
                city=req.city or req.district,
                website=(overrides and overrides.official_website) or req.official_website,
                source="user_request",
                verification_status="verified",
                status="ACTIVE",
                is_active=True,
                last_verified_at=now_utc,
                last_synced_at=now_utc,
            )
            self.db.add(master_inst)
            await self.db.flush()

        req.status = "APPROVED"
        req.reviewed_by = admin_id
        req.reviewed_at = now_utc
        req.approved_institution_id = master_inst.id
        req.rejection_reason = None

        # Link any pending student profiles that registered under this email
        student_stmt = select(StudentProfile).where(
            StudentProfile.institution_id == None  # noqa: E711
        )
        students = (await self.db.execute(student_stmt)).scalars().all()
        for stud in students:
            if stud.user and stud.user.email == req.submitted_by_email:
                stud.institution_id = master_inst.id
                stud.user.is_approved = True

        audit = AuditLog(
            actor_id=admin_id,
            action="INSTITUTION_REQUEST_APPROVED",
            target_type="institution_master",
            target_id=str(master_inst.id),
            metadata_json={"request_id": str(req.id), "institution_name": master_inst.name},
        )
        self.db.add(audit)
        await self.db.commit()

        invalidate_public_universities_cache()
        return req, master_inst

    async def reject_request(
        self,
        request_id: uuid.UUID,
        admin_id: uuid.UUID,
        rejection_reason: str,
    ) -> InstitutionVerificationRequest:
        stmt = select(InstitutionVerificationRequest).where(InstitutionVerificationRequest.id == request_id)
        res = await self.db.execute(stmt)
        req = res.scalar_one_or_none()

        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "REQUEST_NOT_FOUND", "message": "Verification request not found."},
            )

        req.status = "REJECTED"
        req.reviewed_by = admin_id
        req.reviewed_at = datetime.now(UTC)
        req.rejection_reason = rejection_reason or "Institution credentials could not be verified."

        audit = AuditLog(
            actor_id=admin_id,
            action="INSTITUTION_REQUEST_REJECTED",
            target_type="institution_request",
            target_id=str(req.id),
            metadata_json={"reason": req.rejection_reason},
        )
        self.db.add(audit)
        await self.db.commit()
        return req
