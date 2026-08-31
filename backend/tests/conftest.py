import asyncio
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base import Base
from app.models.enums import UserRole
from app.models.profiles import UniversityProfile
from app.models.user import User

# In-memory SQLite async database for ultra-fast, isolated unit testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True)
async def init_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session

@pytest.fixture
async def seed_admin(db_session: AsyncSession) -> User:
    admin = User(
        email="admin@samadhanx.gov.in",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin

@pytest.fixture
async def seed_approved_university(db_session: AsyncSession) -> tuple[User, UniversityProfile]:
    user = User(
        email="nodal@iitd.ac.in",
        hashed_password=get_password_hash("UnivPass123!"),
        role=UserRole.UNIVERSITY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(user)
    await db_session.flush()

    univ_prof = UniversityProfile(
        user_id=user.id,
        university_name="Indian Institute of Technology Delhi",
        aishe_code="U-0109",
        state="Delhi",
        district="New Delhi",
        nodal_officer_name="Dr. Nodal Officer",
        official_email="nodal@iitd.ac.in",
        is_approved=True,
    )
    db_session.add(univ_prof)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(univ_prof)
    return user, univ_prof
