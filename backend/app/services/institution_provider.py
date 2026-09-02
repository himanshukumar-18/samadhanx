import csv
import io
import json
import logging
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.public import invalidate_public_universities_cache
from app.models.institution_master import InstitutionMaster, normalize_institution_name
from app.models.institution_sync import InstitutionSyncError, InstitutionSyncLog

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

            aishe_code = (
                raw_record.get("aishe_code")
                or raw_record.get("AISHE Code")
                or raw_record.get("aishe")
                or None
            )
            if aishe_code:
                aishe_code = str(aishe_code).strip()

            website = (
                raw_record.get("website")
                or raw_record.get("Website")
                or raw_record.get("url")
                or None
            )
            category = (
                raw_record.get("category")
                or raw_record.get("Category")
                or raw_record.get("type")
                or "University"
            )

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

            # Match existing by AISHE code or (normalized_name, state)
            existing: InstitutionMaster | None = None
            if aishe_code:
                stmt = select(InstitutionMaster).where(InstitutionMaster.aishe_code == aishe_code)
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
                # Update metadata safely while preserving Admin verification overrides
                existing.name = name
                existing.district = district
                existing.state = state
                if aishe_code:
                    existing.aishe_code = aishe_code
                if website:
                    existing.website = website
                if category:
                    existing.category = category
                existing.source = source_name
                sync_log.records_updated += 1
            else:
                # Insert new master institution
                new_inst = InstitutionMaster(
                    name=name,
                    normalized_name=norm_name,
                    aishe_code=aishe_code,
                    state=state,
                    district=district,
                    website=website,
                    category=category,
                    source=source_name,
                    verification_status="verified",
                    is_active=True,
                )
                self.db.add(new_inst)
                sync_log.records_added += 1

        sync_log.status = "success" if sync_log.records_failed == 0 else "partial"
        sync_log.completed_at = datetime.now(UTC)
        await self.db.commit()

        # Invalidate public universities cache so changes appear immediately
        invalidate_public_universities_cache()
        return sync_log
