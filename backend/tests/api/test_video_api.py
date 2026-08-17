"""API-layer tests for the video resource endpoints.

All tests use the mocked ASGI client (no real DB / Redis).
Dependency overrides for get_current_teacher and get_current_student
are applied per test class.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def teacher() -> FakeTeacher:
    return FakeTeacher()


@pytest.fixture
def student() -> FakeUser:
    return FakeUser()


@pytest.fixture
async def teacher_client(
    mock_db: AsyncMock,
    mock_redis: AsyncMock,
    teacher: FakeTeacher,
) -> AsyncClient:
    """ASGI client authenticated as a teacher."""
    from app.main import app
    from app.database import get_db_session
    from app.core.redis.client import get_redis
    from app.modules.auth.dependencies import get_current_teacher

    async def _db():
        yield mock_db

    async def _redis():
        yield mock_redis

    app.dependency_overrides[get_db_session] = _db
    app.dependency_overrides[get_redis] = _redis
    app.dependency_overrides[get_current_teacher] = lambda: teacher

    async with AsyncClient(
        transport=__import__("httpx").ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def student_client(
    mock_db: AsyncMock,
    mock_redis: AsyncMock,
    student: FakeUser,
) -> AsyncClient:
    """ASGI client authenticated as a student."""
    from app.main import app
    from app.database import get_db_session
    from app.core.redis.client import get_redis
    from app.modules.auth.dependencies import get_current_student, get_current_user

    async def _db():
        yield mock_db

    async def _redis():
        yield mock_redis

    app.dependency_overrides[get_db_session] = _db
    app.dependency_overrides[get_redis] = _redis
    app.dependency_overrides[get_current_student] = lambda: student
    app.dependency_overrides[get_current_user] = lambda: student

    async with AsyncClient(
        transport=__import__("httpx").ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ===========================================================================
# POST /videos/initiate-upload
# ===========================================================================


@pytest.mark.api
class TestInitiateVideoUpload:
    """Tests for the presigned video upload initiation endpoint."""

    @pytest.mark.asyncio
    async def test_returns_201_with_upload_url(
        self, teacher_client: AsyncClient, teacher: FakeTeacher
    ) -> None:
        """Valid request must return 201 with resource_id and upload_url."""
        video_id = uuid.uuid4()
        fake_result = {
            "resource_id": str(video_id),
            "upload_url": "https://r2.example.com/presigned-put",
            "r2_key": f"courses/{uuid.uuid4()}/videos/{video_id}.mp4",
            "expires_in_seconds": 3600,
            "method": "PUT",
        }

        with patch(
            "app.modules.resource.service.UploadService.initiate_video_upload",
            new_callable=AsyncMock,
            return_value=fake_result,
        ):
            resp = await teacher_client.post(
                "/api/v1/videos/initiate-upload",
                json={
                    "course_id": str(uuid.uuid4()),
                    "title": "Intro to Python",
                    "mime_type": "video/mp4",
                    "file_size_bytes": 50_000_000,
                },
            )

        assert resp.status_code == 201
        data = resp.json()["data"]
        assert "upload_url" in data
        assert "resource_id" in data

    @pytest.mark.asyncio
    async def test_invalid_mime_type_returns_422(
        self, teacher_client: AsyncClient
    ) -> None:
        """Unsupported MIME type must return 422 Unprocessable Entity."""
        resp = await teacher_client.post(
            "/api/v1/videos/initiate-upload",
            json={
                "course_id": str(uuid.uuid4()),
                "title": "Bad Upload",
                "mime_type": "application/exe",
                "file_size_bytes": 1_000_000,
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(
        self, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Request without auth token must return 401."""
        from app.main import app
        from app.database import get_db_session
        from app.core.redis.client import get_redis

        async def _db():
            yield mock_db

        async def _redis():
            yield mock_redis

        app.dependency_overrides[get_db_session] = _db
        app.dependency_overrides[get_redis] = _redis

        async with AsyncClient(
            transport=__import__("httpx").ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            resp = await ac.post(
                "/api/v1/videos/initiate-upload",
                json={
                    "course_id": str(uuid.uuid4()),
                    "title": "No auth",
                    "mime_type": "video/mp4",
                    "file_size_bytes": 1_000_000,
                },
            )

        app.dependency_overrides.clear()
        assert resp.status_code == 401


# ===========================================================================
# POST /videos/{video_id}/publish
# ===========================================================================


@pytest.mark.api
class TestPublishVideo:
    """Tests for the video publish endpoint."""

    @pytest.mark.asyncio
    async def test_publish_returns_200(
        self, teacher_client: AsyncClient
    ) -> None:
        """Publishing a ready video must return 200."""
        video_id = uuid.uuid4()
        fake_video = {
            "id": str(video_id),
            "title": "Test Video",
            "processing_status": "published",
            "upload_status": "completed",
        }

        with patch(
            "app.modules.resource.service.VideoService.publish_video",
            new_callable=AsyncMock,
            return_value=fake_video,
        ):
            resp = await teacher_client.post(
                f"/api/v1/videos/{video_id}/publish"
            )

        assert resp.status_code == 200
        assert resp.json()["data"]["processing_status"] == "published"


# ===========================================================================
# GET /videos/{course_id}/{video_id}/stream
# ===========================================================================


@pytest.mark.api
class TestVideoStream:
    """Tests for the presigned streaming URL endpoint."""

    @pytest.mark.asyncio
    async def test_stream_returns_url(
        self, student_client: AsyncClient
    ) -> None:
        """Enrolled student must receive a streaming URL."""
        video_id = uuid.uuid4()
        course_id = uuid.uuid4()
        fake_stream = {
            "video_id": str(video_id),
            "stream_url": "https://r2.example.com/stream",
            "expires_in_seconds": 3600,
            "duration_seconds": 3600,
            "resume_position_seconds": 0,
            "mime_type": "video/mp4",
        }

        with patch(
            "app.modules.resource.service.StreamingService.get_stream_url",
            new_callable=AsyncMock,
            return_value=fake_stream,
        ):
            resp = await student_client.get(
                f"/api/v1/videos/{course_id}/{video_id}/stream"
            )

        assert resp.status_code == 200
        assert "stream_url" in resp.json()["data"]
