from sqlalchemy import Column, String

from app.db.base import Base


class MockItem(Base):
    name = Column(String(50), nullable=False)


def test_base_model_attributes() -> None:
    item = MockItem(name="Test Item")
    assert hasattr(item, "id")
    assert hasattr(item, "created_at")
    assert hasattr(item, "updated_at")
    assert hasattr(item, "is_deleted")
    assert MockItem.__tablename__ == "mock_items"
