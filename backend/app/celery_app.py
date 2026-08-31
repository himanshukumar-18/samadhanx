from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "samadhanx",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=["app.tasks.health"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
)
