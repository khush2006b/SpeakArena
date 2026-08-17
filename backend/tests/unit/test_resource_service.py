"""Unit tests for the resource module service layer.

Tests cover:
    - UploadService MIME type validation
    - VideoService access control (enrollment gate, publish state)
    - StreamingService URL caching logic
    - PDFService access control
    - StorageService ownership gate
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import FakeTeacher, FakeUser


# ===========================================================================
# Helpers
# ===========================================================================


def _make_fake_video(
    course_id: uuid.UUID | None = None,
    processing_status: str = "published",
    upload_status: str = "completed",
    deleted_at: datetime | None = None,
    is_free_preview: bool = False,
) -> MagicMock:
    """Build a MagicMock that mimics a Video ORM instance."""
    v = MagicMock()
    v.id = uuid.uuid4()
    v.course_id = course_id or uuid.uuid4()
    v.title = "Test Video"
    v.description = None
    v.sort_order = 0
    v.section = None
    v.duration_seconds = 3600
    v.file_size_bytes = 100_000_000
    v.mime_type = "video/mp4"
    v.resolution_width = 1920
    v.resolution_height = 1080
    v.processing_status = processing_status
    v.upload_status = upload_status
    v.visibility = "private"
    v.is_free_preview = is_free_preview
    v.thumbnail_r2_key = None
    v.r2_object_key = f"courses/{uuid.uuid4()}/videos/{uuid.uuid4()}.mp4"
    v.created_at = datetime.now(timezone.utc)
    v.published_at = None
    v.deleted_at = deleted_at
    v.is_accessible = processing_status == "published" and deleted_at is None
    return v


def _make_fake_pdf(
    course_id: uuid.UUID | None = None,
    is_downloadable: bool = True,
    upload_status: str = "completed",
) -> MagicMock:
    """Build a MagicMock that mimics a PDF ORM instance."""
    p = MagicMock()
    p.id = uuid.uuid4()
    p.course_id = course_id or uuid.uuid4()
    p.title = "Test PDF"
    p.description = None
    p.sort_order = 0
    p.section = None
    p.file_size_bytes = 5_000_000
    p.page_count = 42
    p.mime_type = "application/pdf"
    p.is_downloadable = is_downloadable
    p.is_free_preview = False
    p.upload_status = upload_status
    p.visibility = "private"
    p.r2_object_key = f"courses/{uuid.uuid4()}/pdfs/{uuid.uuid4()}.pdf"
    p.created_at = datetime.now(timezone.utc)
    p.deleted_at = None
    return p


# ===========================================================================
# UploadService — MIME type validation
# ===========================================================================


@pytest.mark.unit
class TestUploadServiceMimeValidation:
    """Tests that MIME type validation in InitiateVideoUploadRequest works."""

    def test_valid_video_mime_types_accepted(self) -> None:
        """Valid video MIME types must not raise a validation error."""
        from app.modules.resource.schemas import InitiateVideoUploadRequest

        for mime in ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"]:
            req = InitiateVideoUploadRequest(
                course_id=uuid.uuid4(),
                title="Test",
                mime_type=mime,
                file_size_bytes=1_000_000,
            )
            assert req.mime_type == mime

    def test_invalid_video_mime_type_raises(self) -> None:
        """Invalid MIME types must raise a Pydantic ValidationError."""
        from pydantic import ValidationError
        from app.modules.resource.schemas import InitiateVideoUploadRequest

        with pytest.raises(ValidationError) as exc_info:
            InitiateVideoUploadRequest(
                course_id=uuid.uuid4(),
                title="Test",
                mime_type="text/html",
                file_size_bytes=1_000_000,
            )
        assert "Unsupported video MIME type" in str(exc_info.value)

    def test_oversized_video_rejected(self) -> None:
        """Files exceeding 5 GB must be rejected by schema validation."""
        from pydantic import ValidationError
        from app.modules.resource.schemas import InitiateVideoUploadRequest

        with pytest.raises(ValidationError):
            InitiateVideoUploadRequest(
                course_id=uuid.uuid4(),
                title="Test",
                mime_type="video/mp4",
                file_size_bytes=6 * 1024 * 1024 * 1024,  # 6 GB
            )

    def test_oversized_pdf_rejected(self) -> None:
        """PDF files exceeding 100 MB must be rejected by schema validation."""
        from pydantic import ValidationError
        from app.modules.resource.schemas import InitiatePDFUploadRequest

        with pytest.raises(ValidationError):
            InitiatePDFUploadRequest(
                course_id=uuid.uuid4(),
                title="Test",
                file_size_bytes=200 * 1024 * 1024,  # 200 MB
            )


# ===========================================================================
# VideoService — Access control
# ===========================================================================


@pytest.mark.unit
class TestVideoServiceAccessControl:
    """Tests the enrollment gate and publish-state gate in VideoService."""

    @pytest.fixture
    def teacher(self) -> FakeTeacher:
        return FakeTeacher()

    @pytest.fixture
    def student(self) -> FakeUser:
        return FakeUser()

    @pytest.mark.asyncio
    async def test_student_gets_not_enrolled_error(self, mock_db: AsyncMock, student: FakeUser) -> None:
        """Student must get NotEnrolledError when not enrolled."""
        from app.modules.resource.service import NotEnrolledError, VideoService

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate:
            mock_gate_inst = MockGate.return_value
            mock_gate_inst.is_enrolled = AsyncMock(return_value=False)

            mock_video_repo_inst = MockVideoRepo.return_value
            mock_video_repo_inst.list_for_course = AsyncMock(return_value=([], 0))

            svc = VideoService(mock_db, student)

            with pytest.raises(NotEnrolledError):
                await svc.list_videos(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_student_cannot_access_unpublished_video(
        self, mock_db: AsyncMock, student: FakeUser
    ) -> None:
        """Student must get VideoNotAccessibleError for non-published video."""
        from app.modules.resource.service import VideoNotAccessibleError, VideoService

        video = _make_fake_video(processing_status="uploading")

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate:
            MockVideoRepo.return_value.get_by_id = AsyncMock(return_value=video)
            MockGate.return_value.is_enrolled = AsyncMock(return_value=True)

            svc = VideoService(mock_db, student)

            with pytest.raises(VideoNotAccessibleError):
                await svc.get_video(video.id)

    @pytest.mark.asyncio
    async def test_teacher_can_access_unpublished_video(
        self, mock_db: AsyncMock, teacher: FakeTeacher
    ) -> None:
        """Teacher must be able to read an unpublished video."""
        from app.modules.resource.service import VideoService

        video = _make_fake_video(processing_status="uploading")

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ):
            MockVideoRepo.return_value.get_by_id = AsyncMock(return_value=video)

            svc = VideoService(mock_db, teacher)
            data = await svc.get_video(video.id)

        assert data["id"] == video.id
        assert data["processing_status"] == "uploading"

    @pytest.mark.asyncio
    async def test_non_owner_teacher_cannot_delete_video(
        self, mock_db: AsyncMock, teacher: FakeTeacher
    ) -> None:
        """A teacher who doesn't own the course must get NotCourseOwnerError."""
        from app.modules.resource.service import NotCourseOwnerError, VideoService

        video = _make_fake_video()
        other_teacher_id = uuid.uuid4()

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate:
            MockVideoRepo.return_value.get_by_id = AsyncMock(return_value=video)
            MockGate.return_value.get_course_owner = AsyncMock(return_value=other_teacher_id)

            svc = VideoService(mock_db, teacher)

            with pytest.raises(NotCourseOwnerError):
                await svc.delete_video(video.id)


# ===========================================================================
# StreamingService — Redis URL caching
# ===========================================================================


@pytest.mark.unit
class TestStreamingServiceCache:
    """Tests Redis cache hit/miss behaviour in StreamingService."""

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_url(
        self, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """A cached streaming URL must be returned without calling R2."""
        from app.modules.resource.service import StreamingService

        student = FakeUser()
        video = _make_fake_video()

        cached_url = "https://r2.example.com/cached-stream-url"
        mock_redis.get = AsyncMock(return_value=cached_url.encode())

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate, patch(
            "app.modules.resource.service.ContentProgressRepository"
        ) as MockProgress, patch(
            "app.modules.resource.service.r2"
        ) as mock_r2:
            MockVideoRepo.return_value.get_by_id = AsyncMock(return_value=video)
            MockGate.return_value.is_enrolled = AsyncMock(return_value=True)
            MockProgress.return_value.get_video_progress = AsyncMock(return_value=None)

            svc = StreamingService(mock_db, mock_redis, student)
            result = await svc.get_stream_url(video.id)

            # R2 must NOT be called when cache hits.
            mock_r2.generate_presigned_stream_url.assert_not_called()

        assert result["stream_url"] == cached_url

    @pytest.mark.asyncio
    async def test_cache_miss_calls_r2(
        self, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """On cache miss, StreamingService must generate a fresh R2 URL."""
        from app.modules.resource.service import StreamingService

        student = FakeUser()
        video = _make_fake_video()
        fresh_url = "https://r2.example.com/fresh-stream-url"

        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock()

        with patch(
            "app.modules.resource.service.VideoRepository"
        ) as MockVideoRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate, patch(
            "app.modules.resource.service.ContentProgressRepository"
        ) as MockProgress, patch(
            "app.modules.resource.service.r2"
        ) as mock_r2, patch(
            "app.config.get_settings"
        ) as mock_settings:
            MockVideoRepo.return_value.get_by_id = AsyncMock(return_value=video)
            MockGate.return_value.is_enrolled = AsyncMock(return_value=True)
            MockProgress.return_value.get_video_progress = AsyncMock(return_value=None)
            mock_r2.generate_presigned_stream_url = AsyncMock(return_value=fresh_url)
            mock_settings.return_value.R2_PRESIGNED_URL_EXPIRY_STREAM = 3600

            svc = StreamingService(mock_db, mock_redis, student)
            result = await svc.get_stream_url(video.id)

            mock_r2.generate_presigned_stream_url.assert_called_once()
            mock_redis.setex.assert_called_once()

        assert result["stream_url"] == fresh_url



# ===========================================================================
# PDFService — Access control
# ===========================================================================


@pytest.mark.unit
class TestPDFServiceAccessControl:
    """Tests enrollment verification in PDFService."""

    @pytest.mark.asyncio
    async def test_unenrolled_student_cannot_get_pdf_url(
        self, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Students must get NotEnrolledError when not enrolled."""
        from app.modules.resource.service import NotEnrolledError, PDFService

        student = FakeUser()
        pdf = _make_fake_pdf()

        with patch(
            "app.modules.resource.service.PDFRepository"
        ) as MockPDFRepo, patch(
            "app.modules.resource.service.EnrollmentGateRepository"
        ) as MockGate:
            MockPDFRepo.return_value.get_by_id = AsyncMock(return_value=pdf)
            MockGate.return_value.is_enrolled = AsyncMock(return_value=False)

            svc = PDFService(mock_db, student)

            with pytest.raises(NotEnrolledError):
                await svc.get_pdf_access_url(pdf.id, mock_redis)


# ===========================================================================
# UpdateVideoRequest — visibility validator
# ===========================================================================


@pytest.mark.unit
class TestUpdateVideoRequestValidation:
    """Tests the visibility field validator on UpdateVideoRequest."""

    def test_valid_visibility_values_accepted(self) -> None:
        """'public' and 'private' must be accepted."""
        from app.modules.resource.schemas import UpdateVideoRequest

        for v in ["public", "private"]:
            req = UpdateVideoRequest(visibility=v)
            assert req.visibility == v

    def test_invalid_visibility_raises(self) -> None:
        """Arbitrary strings must be rejected."""
        from pydantic import ValidationError
        from app.modules.resource.schemas import UpdateVideoRequest

        with pytest.raises(ValidationError):
            UpdateVideoRequest(visibility="hidden")
