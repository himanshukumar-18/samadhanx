"""Database session alias for backward compatibility."""

from app.db.base import Base
from app.db.session import SyncSessionLocal, async_engine, get_db, sync_engine

engine = sync_engine
SessionLocal = SyncSessionLocal

__all__ = ["engine", "SessionLocal", "Base", "get_db", "async_engine", "sync_engine"]
