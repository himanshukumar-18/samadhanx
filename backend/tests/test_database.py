import pytest
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class MockItem(BaseModel):
    __tablename__ = "mock_items"
    name: Mapped[str] = mapped_column(String(50), nullable=False)

@pytest.mark.asyncio
async def test_base_model_uuid_and_timestamps(db_session):
    item = MockItem(name="Test Unit")
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)

    assert item.id is not None
    assert item.created_at is not None
    assert item.updated_at is not None
    assert item.name == "Test Unit"
