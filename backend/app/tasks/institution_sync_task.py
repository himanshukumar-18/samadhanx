import asyncio
import logging

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.institution_provider import InstitutionSyncService, UGCFileDatasetProvider

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def sync_institutions_task(self, dataset_content: str, file_type: str = "csv", source_name: str = "ugc_dataset"):
    """Background Celery task to execute transactional institution dataset synchronization with retries."""
    async def _async_sync():
        async with AsyncSessionLocal() as db:
            provider = UGCFileDatasetProvider(file_content=dataset_content, file_type=file_type)
            service = InstitutionSyncService(db=db)
            sync_log = await service.sync_from_provider(provider=provider, source_name=source_name)
            return {
                "sync_id": str(sync_log.id),
                "status": sync_log.status,
                "processed": sync_log.records_processed,
                "added": sync_log.records_added,
                "updated": sync_log.records_updated,
                "failed": sync_log.records_failed,
            }

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            task = asyncio.create_task(_async_sync())
            return loop.run_until_complete(task)
        else:
            return asyncio.run(_async_sync())
    except Exception as exc:
        logger.error(f"[INSTITUTION SYNC TASK ERROR] {exc}")
        raise self.retry(exc=exc) from exc
