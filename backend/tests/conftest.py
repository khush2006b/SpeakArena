"""Shared pytest fixtures for the SpeakArena test suite.

Fixture design:
    Fixtures are organised by scope and dependency depth:

    session  : test_engine, integration_redis — expensive, created once per run.
    function : db_session (with rollback), mock_db, mock_redis — isolated per test.

Environment variables:
    TEST_DATABASE_URL  PostgreSQL DSN for the test database.
                       Required for ``integration`` markers.
                       Example: postgresql+asyncpg://speakarena:pw@localhost:5432/speakarena_test
    TEST_REDIS_URL     Redis DSN for integration tests.
                       Default: redis://localhost:6379/15

Quick start::

    # Unit tests only (no external deps):
    pytest tests/unit -m unit

    # All tests with a test database:
    TEST_DATABASE_URL=postgresql+asyncpg://... pytest tests/
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Test environment
# ---------------------------------------------------------------------------

TEST_DATABASE_URL: str = os.getenv("TEST_DATABASE_URL", "")
TEST_REDIS_URL: str = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/15")
_DB_AVAILABLE: bool = bool(TEST_DATABASE_URL)


# ===========================================================================
# In-memory test doubles (no ORM, no DB connection required)
# ===========================================================================


@dataclass
class FakeUser:
    """In-memory stand-in for a User ORM object used in unit/API tests.

    All fields mirror the real User model's public interface so that
    ``UserSchema.from_orm(FakeUser())`` works without modification.
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    email: str = "student@example.com"
    full_name: str = "Test Student"
    role: str = "student"
    phone: str | None = None
    is_email_verified: bool = True
    is_active: bool = True
    avatar_r2_key: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    hashed_password: str = "$argon2id$v=19$m=65536,t=3,p=4$fake$hash"
    failed_login_count: int = 0
    locked_until: datetime | None = None
    deleted_at: datetime | None = None


@dataclass
class FakeTeacher(FakeUser):
    """In-memory stand-in for a teacher User ORM object."""

    role: str = "teacher"
    email: str = "teacher@example.com"
    full_name: str = "Test Teacher"
    is_email_verified: bool = True


@dataclass
class FakeTeacherProfile:
    """In-memory stand-in for a TeacherProfile ORM object."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    user_id: uuid.UUID = field(default_factory=uuid.uuid4)
    bio: str | None = "Test bio"
    headline: str | None = "Test headline"
    website_url: str | None = None
    social_links: dict | None = None
    total_students: int = 0
    total_courses: int = 0
    total_revenue: float = 0.0


@dataclass
class FakeStudentProfile:
    """In-memory stand-in for a StudentProfile ORM object."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    user_id: uuid.UUID = field(default_factory=uuid.uuid4)
    college: str | None = None
    graduation_year: int | None = None
    preferred_language: str | None = "English"
    total_courses_enrolled: int = 0
    total_courses_completed: int = 0


# ===========================================================================
# Mock infrastructure fixtures
# ===========================================================================


@pytest.fixture
def mock_db() -> AsyncMock:
    """Async mock for a SQLAlchemy AsyncSession.

    Provides a minimal interface so that repository constructors and
    service methods can operate without a real database connection.

    Returns:
        AsyncMock: Configured mock session.
    """
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    session.get = AsyncMock(return_value=None)
    session.add = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Async mock for a Redis client.

    Default behaviour mirrors a cold Redis (no existing keys):
        - ``exists`` returns 0 (key absent).
        - ``get`` returns None (no cached value).
        - ``eval`` returns 1 (first request in any rate-limit window).
        - ``set``/``expire`` return True.

    Override individual returns within tests to simulate specific states.

    Returns:
        AsyncMock: Configured mock Redis client.
    """
    client = AsyncMock()
    client.exists = AsyncMock(return_value=0)
    client.get = AsyncMock(return_value=None)
    client.set = AsyncMock(return_value=True)
    client.delete = AsyncMock(return_value=1)
    client.ttl = AsyncMock(return_value=900)
    client.expire = AsyncMock(return_value=True)
    client.incr = AsyncMock(return_value=1)
    # eval is called by the atomic rate-limit Lua script.
    client.eval = AsyncMock(return_value=1)
    return client


# ===========================================================================
# HTTP test client fixture
# ===========================================================================


@pytest.fixture
async def client(
    mock_db: AsyncMock,
    mock_redis: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client with mocked database and Redis.

    Overrides ``get_db_session`` and ``get_redis`` FastAPI dependencies
    so that the HTTP layer runs without real infrastructure.
    Repository and service objects receive the mock session; tests
    can configure mock return values to simulate specific DB states.

    Args:
        mock_db: Mocked async SQLAlchemy session.
        mock_redis: Mocked async Redis client.

    Yields:
        AsyncClient: Configured ASGI test client.
    """
    from app.main import app
    from app.database import get_db_session
    from app.core.redis.client import get_redis

    async def _override_db() -> AsyncGenerator:
        yield mock_db

    async def _override_redis() -> AsyncGenerator:
        yield mock_redis

    app.dependency_overrides[get_db_session] = _override_db
    app.dependency_overrides[get_redis] = _override_redis

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ===========================================================================
# Pre-built auth header fixtures
# ===========================================================================


@pytest.fixture
def teacher_auth_headers() -> dict[str, str]:
    """Valid Bearer token headers for a teacher user.

    Creates a real JWT signed with the configured JWT_SECRET_KEY so
    that the ``get_current_user`` dependency can decode it.

    Returns:
        dict: Authorization header dict.
    """
    from app.core.security.jwt import create_access_token
    teacher = FakeTeacher()
    token, _ = create_access_token(
        user_id=str(teacher.id),
        role="teacher",
        session_id=str(uuid.uuid4()),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_auth_headers() -> dict[str, str]:
    """Valid Bearer token headers for a student user.

    Returns:
        dict: Authorization header dict.
    """
    from app.core.security.jwt import create_access_token
    student = FakeUser()
    token, _ = create_access_token(
        user_id=str(student.id),
        role="student",
        session_id=str(uuid.uuid4()),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def expired_auth_headers() -> dict[str, str]:
    """Bearer token headers containing an already-expired access token.

    Returns:
        dict: Authorization header dict with expired token.
    """
    from app.core.security.jwt import create_access_token
    token, _ = create_access_token(
        user_id=str(uuid.uuid4()),
        role="student",
        session_id=str(uuid.uuid4()),
        expires_in_seconds=-1,  # Immediately expired.
    )
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# Integration DB fixtures (skipped when TEST_DATABASE_URL is absent)
# ===========================================================================


def pytest_collection_modifyitems(items: list) -> None:  # type: ignore[type-arg]
    """Automatically skip integration tests when TEST_DATABASE_URL is absent."""
    if not _DB_AVAILABLE:
        skip_db = pytest.mark.skip(
            reason="Set TEST_DATABASE_URL to run integration tests."
        )
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_db)


@pytest.fixture(scope="session")
async def test_engine():
    """Session-scoped async PostgreSQL engine for integration tests.

    Creates all tables before the test session and drops them after.
    Requires ``TEST_DATABASE_URL`` to point to a dedicated test database.

    Yields:
        AsyncEngine: Configured async database engine.
    """
    if not _DB_AVAILABLE:
        pytest.skip("TEST_DATABASE_URL not configured.")

    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text

    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)

    # Ensure the pg_uuidv7 extension is available.
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_uuidv7"))

    # Import all ORM models so their metadata is populated.
    import app.models.user  # noqa: F401
    import app.models.auth  # noqa: F401
    import app.models.course  # noqa: F401

    from app.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine):
    """Per-test database session with automatic rollback for isolation.

    Uses a savepoint so that each test's writes are transparently
    rolled back without touching other tests' data.

    Yields:
        AsyncSession: Isolated database session.
    """
    from sqlalchemy.ext.asyncio import AsyncSession

    connection = await test_engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()


@pytest.fixture
async def integration_redis():
    """Real Redis client on DB 15 for integration tests.

    The database is flushed before and after each test to ensure isolation.

    Yields:
        Redis: Connected async Redis client.
    """
    from redis.asyncio import Redis

    redis = Redis.from_url(TEST_REDIS_URL)
    await redis.flushdb()
    yield redis
    await redis.flushdb()
    await redis.aclose()
