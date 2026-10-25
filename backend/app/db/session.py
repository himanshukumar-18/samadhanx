from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

_is_sqlite_async = "sqlite" in settings.DATABASE_URL
_async_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}
if not _is_sqlite_async:
    _async_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,
    })

# Asynchronous SQLAlchemy Engine for FastAPI request lifecycle
async_engine = create_async_engine(
    settings.async_database_url,
    **_async_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

_sync_url = settings.sync_database_url
_is_sqlite_sync = "sqlite" in _sync_url
_sync_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}
if not _is_sqlite_sync:
    _sync_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_recycle": 3600,
    })

# Synchronous SQLAlchemy Engine for Alembic and Celery workers
sync_engine = create_engine(
    _sync_url,
    **_sync_kwargs,
)


SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session with automatic rollback on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
