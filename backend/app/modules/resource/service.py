"""Resource module — service layer.

All business logic for resource management:

    UploadService     Presign flow for video and PDF uploads.
    VideoService      Teacher CRUD for videos; student streaming.
    PDFService        Teacher CRUD for PDFs; student download.
    StreamingService  Presigned streaming URL generation with resume.
    StorageService    Storage statistics and orphan cleanup.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import BackgroundTasks
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage as r2_module
from app.core.exceptions.errors import AppError, ResourceNotFoundError

from app.core.storage import r2
from app.models.audit import AuditLog
from app.models.enums import (
    AuditSeverity,
    UploadStatus,
    VideoProcessingStatus,
)
from app.models.notification import Notification
from app.models.enums import NotificationChannel, NotificationType
from app.models.user import User
from app.modules.resource.repository import (
    ContentProgressRepository,
    EnrollmentGateRepository,
    PDFRepository,
    VideoRepository,
)
from app.modules.resource.schemas import (
    ConfirmPDFUploadRequest,
    ConfirmVideoUploadRequest,
    InitiatePDFUploadRequest,
    InitiateVideoUploadRequest,
    ReorderRequest,
    UpdatePDFRequest,
    UpdateVideoRequest,
)

logger = logging.getLogger(__name__)

# Redis key patterns
_STREAM_URL_CACHE_KEY = "stream_url:{video_id}:{student_id}"  # TTL = expiry - 60
_PDF_URL_CACHE_KEY = "pdf_url:{pdf_id}:{student_id}"           # TTL = expiry - 60
_URL_CACHE_BUFFER_SECONDS = 60  # Invalidate before actual expiry


# ---------------------------------------------------------------------------
# Resource-specific domain errors
# ---------------------------------------------------------------------------


class VideoNotAccessibleError(AppError):
    """Video is not in a publishable state or not found."""

    status_code = 404
    error_code = "VideoNotAccessible"
    message = "Video is not available."


class NotEnrolledError(AppError):
    """Student is not enrolled in this course."""

    status_code = 403
    error_code = "NotEnrolled"
    message = "You must be enrolled in this course to access this content."


class NotCourseOwnerError(AppError):
    """Teacher does not own the resource's course."""

    status_code = 403
    error_code = "NotCourseOwner"
    message = "You do not have permission to manage this resource."


class InvalidMimeTypeError(AppError):
    """Unsupported MIME type for the requested operation."""

    status_code = 400
    error_code = "InvalidMimeType"
    message = "Unsupported file type."


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------


def _audit(
    db: AsyncSession,
    actor_id: Optional[uuid.UUID],
    actor_role: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    severity: str = AuditSeverity.INFO,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append an audit log record to the session.

    Args:
        db: Async database session.
        actor_id: Acting user UUID.
        actor_role: Denormalized role string.
        action: Dot-notation action string.
        entity_type: Entity category.
        entity_id: Optional entity UUID.
        severity: AuditSeverity value.
        metadata: Optional extra context.
    """
    db.add(
        AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            severity=severity,
            metadata_=metadata or {},
        )
    )


# ===========================================================================
# UploadService
# ===========================================================================


class UploadService:
    """Handles presigned upload URL generation for videos and PDFs.

    Flow:
        1. Validate MIME type and file size.
        2. Verify teacher owns the course.
        3. Create metadata record in DB (status=PENDING).
        4. Generate presigned PUT URL.
        5. Return {resource_id, upload_url, r2_key}.
        6. Frontend uploads directly to R2.
        7. Frontend calls confirm endpoint.
        8. Background task updates upload_status=COMPLETED.
    """

    def __init__(
        self,
        db: AsyncSession,
        teacher: User,
    ) -> None:
        """Initialize UploadService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._video_repo = VideoRepository(db)
        self._pdf_repo = PDFRepository(db)
        self._gate = EnrollmentGateRepository(db)

    async def _verify_course_owner(self, course_id: uuid.UUID) -> None:
        """Verify the teacher owns the course.

        Args:
            course_id: The course UUID.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        owner_id = await self._gate.get_course_owner(course_id)
        if owner_id != self._teacher.id:
            raise NotCourseOwnerError()

    async def initiate_video_upload(
        self,
        body: InitiateVideoUploadRequest,
    ) -> dict[str, Any]:
        """Create a video metadata record and return a presigned PUT URL.

        Args:
            body: The upload initiation request.

        Returns:
            dict: PresignedUploadResponse payload.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        await self._verify_course_owner(body.course_id)

        # Create placeholder video record
        video_id = uuid.uuid4()
        ext = r2.ext_from_mime(body.mime_type)
        r2_key = r2.make_video_key(body.course_id, video_id, ext)

        video = await self._video_repo.create(
            course_id=body.course_id,
            title=body.title,
            r2_object_key=r2_key,
            mime_type=body.mime_type,
            file_size_bytes=body.file_size_bytes,
            description=body.description,
            section=body.section,
            sort_order=body.sort_order,
        )
        # Override ID so R2 key matches DB record
        # (We generate video_id before create; SQLAlchemy auto-sets it)
        # In practice, flush returns the DB-generated UUID.
        # We use the DB UUID for the R2 key now.
        actual_id = video.id
        actual_ext = ext
        actual_key = r2.make_video_key(body.course_id, actual_id, actual_ext)

        # Update the key if it differs from the placeholder
        if actual_key != r2_key:
            video.r2_object_key = actual_key
            await self._db.flush()

        upload_url = await r2.generate_presigned_upload_url(
            object_key=actual_key,
            content_type=body.mime_type,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.video_upload_initiated",
            entity_type="video",
            entity_id=actual_id,
            metadata={"mime_type": body.mime_type, "size": body.file_size_bytes},
        )

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        return {
            "resource_id": actual_id,
            "upload_url": upload_url,
            "r2_key": actual_key,
            "expires_in_seconds": expiry,
            "method": "PUT",
        }

    async def initiate_multipart_video_upload(
        self,
        body: InitiateVideoUploadRequest,
    ) -> dict[str, Any]:
        """Create a video metadata record and initiate a multipart upload in R2.

        Args:
            body: The upload initiation request.

        Returns:
            dict: MultipartInitiateResponse payload.
        """
        await self._verify_course_owner(body.course_id)

        video_id = uuid.uuid4()
        ext = r2.ext_from_mime(body.mime_type)
        r2_key = r2.make_video_key(body.course_id, video_id, ext)

        video = await self._video_repo.create(
            course_id=body.course_id,
            title=body.title,
            r2_object_key=r2_key,
            mime_type=body.mime_type,
            file_size_bytes=body.file_size_bytes,
            description=body.description,
            section=body.section,
            sort_order=body.sort_order,
        )
        actual_id = video.id
        actual_ext = ext
        actual_key = r2.make_video_key(body.course_id, actual_id, actual_ext)

        if actual_key != r2_key:
            video.r2_object_key = actual_key
            await self._db.flush()

        upload_id = await r2.create_multipart_upload(actual_key, body.mime_type)

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.multipart_video_initiated",
            entity_type="video",
            entity_id=actual_id,
            metadata={"mime_type": body.mime_type, "size": body.file_size_bytes, "upload_id": upload_id},
        )

        return {
            "upload_id": upload_id,
            "resource_id": actual_id,
            "r2_key": actual_key,
        }

    async def presign_video_parts(
        self,
        video_id: uuid.UUID,
        upload_id: str,
        part_numbers: list[int],
    ) -> dict[str, Any]:
        """Generate presigned URLs for specific parts of a multipart video upload.

        Args:
            video_id: The video UUID.
            upload_id: The R2 UploadId.
            part_numbers: List of part numbers to generate URLs for.

        Returns:
            dict: Mapping of part_number to presigned URL.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video record not found.")

        await self._verify_course_owner(video.course_id)

        urls = {}
        for part in part_numbers:
            url = await r2.generate_presigned_upload_part_url(video.r2_object_key, upload_id, part)
            urls[part] = url

        return {"presigned_urls": urls}

    async def complete_multipart_video_upload(
        self,
        video_id: uuid.UUID,
        upload_id: str,
        parts: list[dict[str, Any]],
        file_size_bytes: int,
        background_tasks: BackgroundTasks,
    ) -> dict[str, Any]:
        """Complete a multipart upload and trigger background processing.

        Args:
            video_id: The video UUID.
            upload_id: The R2 UploadId.
            parts: List of parts with PartNumber and ETag.
            file_size_bytes: Actual file size.
            background_tasks: FastAPI background queue.

        Returns:
            dict: Video metadata payload.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video record not found.")

        await self._verify_course_owner(video.course_id)

        await r2.complete_multipart_upload(video.r2_object_key, upload_id, parts)

        await self._video_repo.update(
            video,
            upload_status=UploadStatus.COMPLETED,
            processing_status=VideoProcessingStatus.READY,
            file_size_bytes=file_size_bytes,
        )

        background_tasks.add_task(
            _background_video_post_upload,
            video_id=video.id,
            teacher_id=self._teacher.id,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.multipart_video_completed",
            entity_type="video",
            entity_id=video.id,
        )

        return {
            "id": video.id,
            "title": video.title,
            "processing_status": video.processing_status,
            "upload_status": video.upload_status,
            "r2_object_key": video.r2_object_key,
        }

    async def abort_multipart_video_upload(
        self,
        video_id: uuid.UUID,
        upload_id: str,
    ) -> None:
        """Abort a multipart upload.

        Args:
            video_id: The video UUID.
            upload_id: The R2 UploadId.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video record not found.")

        await self._verify_course_owner(video.course_id)

        await r2.abort_multipart_upload(video.r2_object_key, upload_id)
        
        # Soft delete the video placeholder
        await self._video_repo.soft_delete(video)

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.multipart_video_aborted",
            entity_type="video",
            entity_id=video.id,
            severity=AuditSeverity.WARNING,
        )

    async def confirm_video_upload(
        self,
        body: ConfirmVideoUploadRequest,
        background_tasks: BackgroundTasks,
    ) -> dict[str, Any]:
        """Mark a video upload as completed and trigger background processing.

        Args:
            body: The upload confirmation request.
            background_tasks: FastAPI background task queue.

        Returns:
            dict: Video metadata payload.

        Raises:
            ResourceNotFoundError: If video record not found.
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        video = await self._video_repo.get_by_id(body.video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video record not found.")

        await self._verify_course_owner(video.course_id)

        # Verify the object actually landed in R2
        exists = await r2.object_exists(video.r2_object_key)
        if not exists:
            raise AppError(
                message="Video file not found in storage. Please upload again.",
                error_code="VideoFileNotInStorage",
            )

        await self._video_repo.update(
            video,
            upload_status=UploadStatus.COMPLETED,
            processing_status=VideoProcessingStatus.READY,
            file_size_bytes=body.file_size_bytes or video.file_size_bytes,
        )

        # Enqueue background tasks (lightweight; Celery-ready interface)
        background_tasks.add_task(
            _background_video_post_upload,
            video_id=video.id,
            teacher_id=self._teacher.id,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.video_upload_confirmed",
            entity_type="video",
            entity_id=video.id,
        )

        return {
            "id": video.id,
            "title": video.title,
            "processing_status": video.processing_status,
            "upload_status": video.upload_status,
            "r2_object_key": video.r2_object_key,
        }

    async def initiate_pdf_upload(
        self,
        body: InitiatePDFUploadRequest,
    ) -> dict[str, Any]:
        """Create a PDF metadata record and return a presigned PUT URL.

        Args:
            body: The upload initiation request.

        Returns:
            dict: PresignedUploadResponse payload.
        """
        await self._verify_course_owner(body.course_id)

        pdf = await self._pdf_repo.create(
            course_id=body.course_id,
            title=body.title,
            r2_object_key="pending",  # Updated after flush to get actual ID
            file_size_bytes=body.file_size_bytes,
            description=body.description,
            section=body.section,
            sort_order=body.sort_order,
            is_downloadable=body.is_downloadable,
        )

        actual_key = r2.make_pdf_key(body.course_id, pdf.id)
        pdf.r2_object_key = actual_key
        await self._db.flush()

        upload_url = await r2.generate_presigned_upload_url(
            object_key=actual_key,
            content_type="application/pdf",
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.pdf_upload_initiated",
            entity_type="pdf",
            entity_id=pdf.id,
            metadata={"size": body.file_size_bytes},
        )

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        return {
            "resource_id": pdf.id,
            "upload_url": upload_url,
            "r2_key": actual_key,
            "expires_in_seconds": expiry,
            "method": "PUT",
        }

    async def confirm_pdf_upload(
        self,
        body: ConfirmPDFUploadRequest,
        background_tasks: BackgroundTasks,
    ) -> dict[str, Any]:
        """Mark a PDF upload as completed.

        Args:
            body: The upload confirmation request.
            background_tasks: FastAPI background task queue.

        Returns:
            dict: PDF metadata payload.
        """
        pdf = await self._pdf_repo.get_by_id(body.pdf_id)
        if pdf is None:
            raise ResourceNotFoundError(message="PDF record not found.")

        await self._verify_course_owner(pdf.course_id)

        exists = await r2.object_exists(pdf.r2_object_key)
        if not exists:
            raise AppError(
                message="PDF file not found in storage. Please upload again.",
                error_code="PDFFileNotInStorage",
            )

        await self._pdf_repo.update(
            pdf,
            upload_status=UploadStatus.COMPLETED,
            file_size_bytes=body.file_size_bytes or pdf.file_size_bytes,
            page_count=body.page_count,
        )

        background_tasks.add_task(
            _background_pdf_post_upload,
            pdf_id=pdf.id,
            teacher_id=self._teacher.id,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="resource.pdf_upload_confirmed",
            entity_type="pdf",
            entity_id=pdf.id,
        )

        return {
            "id": pdf.id,
            "title": pdf.title,
            "upload_status": pdf.upload_status,
            "r2_object_key": pdf.r2_object_key,
        }


# ===========================================================================
# VideoService
# ===========================================================================


class VideoService:
    """Teacher CRUD for video metadata and teacher/student video listing."""

    def __init__(
        self,
        db: AsyncSession,
        actor: User,
    ) -> None:
        """Initialize VideoService.

        Args:
            db: Async database session.
            actor: The authenticated user (teacher or student).
        """
        self._db = db
        self._actor = actor
        self._video_repo = VideoRepository(db)
        self._gate = EnrollmentGateRepository(db)

    async def list_videos(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 50,
        section: Optional[str] = None,
        visibility: Optional[str] = None,
        processing_status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated video list for a course.

        Teachers see all videos. Students see only published ones and
        must be enrolled.

        Args:
            course_id: The course UUID.
            page: Page number.
            page_size: Items per page.
            section: Optional section filter.
            visibility: Optional visibility filter (teacher only).
            processing_status: Optional status filter (teacher only).
            search: Optional title search.

        Returns:
            tuple: (list of video dicts, total count).

        Raises:
            NotEnrolledError: If student is not enrolled.
        """
        from app.models.enums import UserRole
        is_student = self._actor.role == UserRole.STUDENT

        if is_student:
            enrolled = await self._gate.is_enrolled(self._actor.id, course_id)
            if not enrolled:
                raise NotEnrolledError()

        videos, total = await self._video_repo.list_for_course(
            course_id,
            page=page,
            page_size=page_size,
            section=section,
            visibility=visibility if not is_student else None,
            processing_status=processing_status if not is_student else None,
            search=search,
            published_only=is_student,
        )

        return [_serialize_video(v) for v in videos], total

    async def get_video(
        self,
        video_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return video metadata.

        Args:
            video_id: The video UUID.

        Returns:
            dict: Video metadata payload.

        Raises:
            ResourceNotFoundError: If not found.
            NotEnrolledError: If student is not enrolled.
            VideoNotAccessibleError: If video is not published (student view).
        """
        from app.models.enums import UserRole
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        if self._actor.role == UserRole.STUDENT:
            if not video.is_accessible:
                raise VideoNotAccessibleError()
            enrolled = await self._gate.is_enrolled(self._actor.id, video.course_id)
            if not enrolled:
                raise NotEnrolledError()

        return _serialize_video(video)

    async def update_video(
        self,
        video_id: uuid.UUID,
        body: UpdateVideoRequest,
    ) -> dict[str, Any]:
        """Update video metadata (teacher-only).

        Args:
            video_id: The video UUID.
            body: The update payload.

        Returns:
            dict: Updated video metadata.

        Raises:
            ResourceNotFoundError: If not found.
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        owner_id = await self._gate.get_course_owner(video.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        updated = await self._video_repo.update(
            video,
            title=body.title,
            description=body.description,
            section=body.section,
            sort_order=body.sort_order,
            visibility=body.visibility,
            is_free_preview=body.is_free_preview,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.video_updated",
            entity_type="video",
            entity_id=video.id,
        )

        return _serialize_video(updated)

    async def publish_video(
        self,
        video_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Publish a video (set processing_status = 'published').

        Args:
            video_id: The video UUID.

        Returns:
            dict: Updated video metadata.

        Raises:
            ResourceNotFoundError: If not found.
            NotCourseOwnerError: If teacher doesn't own the course.
            AppError: If upload is not yet complete.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        owner_id = await self._gate.get_course_owner(video.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        if video.upload_status != UploadStatus.COMPLETED:
            raise AppError(
                message="Video upload must be completed before publishing.",
                error_code="VideoNotReady",
            )

        await self._video_repo.mark_published(video.id)
        video.processing_status = VideoProcessingStatus.PUBLISHED
        video.published_at = datetime.now(timezone.utc)

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.video_published",
            entity_type="video",
            entity_id=video.id,
        )

        return _serialize_video(video)

    async def delete_video(
        self,
        video_id: uuid.UUID,
    ) -> None:
        """Soft-delete a video and schedule R2 object deletion.

        Args:
            video_id: The video UUID.

        Raises:
            ResourceNotFoundError: If not found.
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        owner_id = await self._gate.get_course_owner(video.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        r2_key = video.r2_object_key
        await self._video_repo.soft_delete(video)

        # Best-effort R2 delete (non-blocking)
        import asyncio
        asyncio.create_task(r2.delete_object(r2_key))

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.video_deleted",
            entity_type="video",
            entity_id=video_id,
            severity=AuditSeverity.WARNING,
        )

    async def reorder_videos(
        self,
        course_id: uuid.UUID,
        body: ReorderRequest,
    ) -> None:
        """Bulk update sort_order for videos in a course.

        Args:
            course_id: The course UUID.
            body: Reorder payload with list of {id, sort_order}.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        owner_id = await self._gate.get_course_owner(course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        items = [{"id": uuid.UUID(str(i["id"])), "sort_order": i["sort_order"]} for i in body.items]
        await self._video_repo.bulk_update_sort_order(items)


# ===========================================================================
# PDFService
# ===========================================================================


class PDFService:
    """Teacher CRUD for PDF metadata and student PDF access."""

    def __init__(
        self,
        db: AsyncSession,
        actor: User,
    ) -> None:
        """Initialize PDFService.

        Args:
            db: Async database session.
            actor: The authenticated user.
        """
        self._db = db
        self._actor = actor
        self._pdf_repo = PDFRepository(db)
        self._gate = EnrollmentGateRepository(db)

    async def list_pdfs(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 50,
        section: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated PDF list for a course.

        Args:
            course_id: The course UUID.
            page: Page number.
            page_size: Items per page.
            section: Optional section filter.
            search: Optional title search.

        Returns:
            tuple: (list of PDF dicts, total count).
        """
        from app.models.enums import UserRole
        is_student = self._actor.role == UserRole.STUDENT

        if is_student:
            enrolled = await self._gate.is_enrolled(self._actor.id, course_id)
            if not enrolled:
                raise NotEnrolledError()

        pdfs, total = await self._pdf_repo.list_for_course(
            course_id,
            page=page,
            page_size=page_size,
            section=section,
            search=search,
            published_only=is_student,
        )
        return [_serialize_pdf(p) for p in pdfs], total

    async def get_pdf_access_url(
        self,
        pdf_id: uuid.UUID,
        redis: Redis,
    ) -> dict[str, Any]:
        """Return a presigned GET URL for a PDF.

        Checks enrollment for students, caches the URL in Redis.

        Args:
            pdf_id: The PDF UUID.
            redis: Async Redis client for URL caching.

        Returns:
            dict: PDFAccessResponse payload.

        Raises:
            ResourceNotFoundError: If PDF not found.
            NotEnrolledError: If student not enrolled.
        """
        from app.models.enums import UserRole
        from app.config import get_settings

        pdf = await self._pdf_repo.get_by_id(pdf_id)
        if pdf is None:
            raise ResourceNotFoundError(message="PDF not found.")

        if self._actor.role == UserRole.STUDENT:
            course_id = pdf.course_id
            enrolled = await self._gate.is_enrolled(self._actor.id, course_id)
            if not enrolled:
                raise NotEnrolledError()

        # Check Redis cache
        cache_key = _PDF_URL_CACHE_KEY.format(
            pdf_id=pdf_id, student_id=self._actor.id
        )
        cached = await redis.get(cache_key)
        if cached:
            settings = get_settings()
            expiry = settings.R2_PRESIGNED_URL_EXPIRY_DOWNLOAD
            return {
                "pdf_id": pdf_id,
                "access_url": cached.decode() if isinstance(cached, bytes) else cached,
                "expires_in_seconds": expiry,
                "is_downloadable": pdf.is_downloadable,
            }

        settings = get_settings()
        expiry = settings.R2_PRESIGNED_URL_EXPIRY_DOWNLOAD

        filename = f"{pdf.title}.pdf" if pdf.is_downloadable else None
        access_url = await r2.generate_presigned_download_url(
            pdf.r2_object_key,
            expiry_seconds=expiry,
            filename=filename,
        )

        # Cache with buffer
        await redis.setex(
            cache_key,
            max(1, expiry - _URL_CACHE_BUFFER_SECONDS),
            access_url,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.pdf_accessed",
            entity_type="pdf",
            entity_id=pdf_id,
        )

        return {
            "pdf_id": pdf_id,
            "access_url": access_url,
            "expires_in_seconds": expiry,
            "is_downloadable": pdf.is_downloadable,
        }

    async def update_pdf(
        self,
        pdf_id: uuid.UUID,
        body: UpdatePDFRequest,
    ) -> dict[str, Any]:
        """Update PDF metadata (teacher-only).

        Args:
            pdf_id: The PDF UUID.
            body: The update payload.

        Returns:
            dict: Updated PDF metadata.
        """
        pdf = await self._pdf_repo.get_by_id(pdf_id)
        if pdf is None:
            raise ResourceNotFoundError(message="PDF not found.")

        owner_id = await self._gate.get_course_owner(pdf.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        updated = await self._pdf_repo.update(
            pdf,
            title=body.title,
            description=body.description,
            section=body.section,
            sort_order=body.sort_order,
            visibility=body.visibility,
            is_downloadable=body.is_downloadable,
            is_free_preview=body.is_free_preview,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.pdf_updated",
            entity_type="pdf",
            entity_id=pdf.id,
        )

        return _serialize_pdf(updated)

    async def delete_pdf(
        self,
        pdf_id: uuid.UUID,
    ) -> None:
        """Soft-delete a PDF and schedule R2 object deletion.

        Args:
            pdf_id: The PDF UUID.
        """
        pdf = await self._pdf_repo.get_by_id(pdf_id)
        if pdf is None:
            raise ResourceNotFoundError(message="PDF not found.")

        owner_id = await self._gate.get_course_owner(pdf.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        r2_key = pdf.r2_object_key
        await self._pdf_repo.soft_delete(pdf)

        import asyncio
        asyncio.create_task(r2.delete_object(r2_key))

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="resource.pdf_deleted",
            entity_type="pdf",
            entity_id=pdf_id,
            severity=AuditSeverity.WARNING,
        )

    async def reorder_pdfs(
        self,
        course_id: uuid.UUID,
        body: ReorderRequest,
    ) -> None:
        """Bulk update sort_order for PDFs in a course.

        Args:
            course_id: The course UUID.
            body: Reorder payload.
        """
        owner_id = await self._gate.get_course_owner(course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        items = [{"id": uuid.UUID(str(i["id"])), "sort_order": i["sort_order"]} for i in body.items]
        await self._pdf_repo.bulk_update_sort_order(items)


# ===========================================================================
# StreamingService
# ===========================================================================


class StreamingService:
    """Generates presigned streaming URLs for videos with resume support."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        student: User,
    ) -> None:
        """Initialize StreamingService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            student: The authenticated student user.
        """
        self._db = db
        self._redis = redis
        self._student = student
        self._video_repo = VideoRepository(db)
        self._progress_repo = ContentProgressRepository(db)
        self._gate = EnrollmentGateRepository(db)

    async def get_stream_url(
        self,
        video_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return a presigned streaming URL with resume position.

        Verifies enrollment, checks Redis cache, generates URL if needed.

        Args:
            video_id: The video UUID.

        Returns:
            dict: VideoStreamResponse payload.

        Raises:
            ResourceNotFoundError: If video not found.
            VideoNotAccessibleError: If video is not published.
            NotEnrolledError: If student is not enrolled.
        """
        from app.config import get_settings

        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        if not video.is_accessible:
            raise VideoNotAccessibleError()

        enrolled = await self._gate.is_enrolled(self._student.id, video.course_id)
        if not enrolled:
            raise NotEnrolledError()

        settings = get_settings()
        expiry = settings.R2_PRESIGNED_URL_EXPIRY_STREAM

        # Check Redis cache
        cache_key = _STREAM_URL_CACHE_KEY.format(
            video_id=video_id, student_id=self._student.id
        )
        cached_url = await self._redis.get(cache_key)

        if cached_url:
            stream_url = cached_url.decode() if isinstance(cached_url, bytes) else cached_url
        else:
            stream_url = await r2.generate_presigned_stream_url(
                video.r2_object_key, expiry_seconds=expiry
            )
            await self._redis.setex(
                cache_key,
                max(1, expiry - _URL_CACHE_BUFFER_SECONDS),
                stream_url,
            )

        # Get resume position
        progress = await self._progress_repo.get_video_progress(
            self._student.id, video_id
        )
        resume_pos = progress.watch_position_seconds if progress else 0

        _audit(
            self._db,
            actor_id=self._student.id,
            actor_role=self._student.role,
            action="resource.video_streamed",
            entity_type="video",
            entity_id=video_id,
        )

        return {
            "video_id": video_id,
            "stream_url": stream_url,
            "expires_in_seconds": expiry,
            "duration_seconds": video.duration_seconds,
            "resume_position_seconds": resume_pos,
            "mime_type": video.mime_type,
        }

    async def update_progress(
        self,
        video_id: uuid.UUID,
        watch_position_seconds: int,
        watch_duration_seconds: int,
        is_completed: bool,
    ) -> dict[str, Any]:
        """Upsert video watch progress (called every 30s by the player).

        Args:
            video_id: The video UUID.
            watch_position_seconds: Current player position.
            watch_duration_seconds: Total watch time.
            is_completed: Whether the student finished the video.

        Returns:
            dict: Updated progress payload.
        """
        video = await self._video_repo.get_by_id(video_id)
        if video is None:
            raise ResourceNotFoundError(message="Video not found.")

        enrolled = await self._gate.is_enrolled(self._student.id, video.course_id)
        if not enrolled:
            raise NotEnrolledError()

        progress = await self._progress_repo.upsert_video_progress(
            student_id=self._student.id,
            video_id=video_id,
            watch_position_seconds=watch_position_seconds,
            watch_duration_seconds=watch_duration_seconds,
            is_completed=is_completed,
        )

        return {
            "video_id": video_id,
            "watch_position_seconds": progress.watch_position_seconds,
            "watch_duration_seconds": progress.watch_duration_seconds,
            "is_completed": progress.is_completed,
            "last_accessed_at": progress.last_accessed_at,
        }

    async def get_recently_watched(
        self,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return recently watched video progress records.

        Args:
            limit: Maximum records to return.

        Returns:
            list[dict]: Progress records with video metadata.
        """
        records = await self._progress_repo.get_recently_watched(
            self._student.id, limit=limit
        )
        return [
            {
                "video_id": r.video_id,
                "watch_position_seconds": r.watch_position_seconds,
                "is_completed": r.is_completed,
                "last_accessed_at": r.last_accessed_at,
            }
            for r in records
        ]


# ===========================================================================
# StorageService
# ===========================================================================


class StorageService:
    """Storage statistics for a course."""

    def __init__(
        self,
        db: AsyncSession,
        teacher: User,
    ) -> None:
        """Initialize StorageService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._video_repo = VideoRepository(db)
        self._pdf_repo = PDFRepository(db)
        self._gate = EnrollmentGateRepository(db)

    async def get_stats(
        self,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return storage statistics for a course.

        Args:
            course_id: The course UUID.

        Returns:
            dict: StorageStatsResponse payload.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        owner_id = await self._gate.get_course_owner(course_id)
        if owner_id != self._teacher.id:
            raise NotCourseOwnerError()

        video_stats = await self._video_repo.get_course_video_stats(course_id)
        pdf_stats = await self._pdf_repo.get_course_pdf_stats(course_id)

        return {
            "course_id": course_id,
            "total_videos": video_stats["total_videos"],
            "total_pdfs": pdf_stats["total_pdfs"],
            "total_size_bytes": (
                video_stats["total_size_bytes"] + pdf_stats["total_size_bytes"]
            ),
            "published_videos": video_stats["published_videos"],
        }


# ===========================================================================
# Serializers
# ===========================================================================


def _serialize_video(video: Any) -> dict[str, Any]:
    """Serialize a Video ORM instance to a response dict.

    Args:
        video: The Video ORM instance.

    Returns:
        dict: VideoResponse payload.
    """
    return {
        "id": video.id,
        "course_id": video.course_id,
        "title": video.title,
        "description": video.description,
        "sort_order": video.sort_order,
        "section": video.section,
        "duration_seconds": video.duration_seconds,
        "file_size_bytes": video.file_size_bytes,
        "mime_type": video.mime_type,
        "resolution_width": video.resolution_width,
        "resolution_height": video.resolution_height,
        "processing_status": video.processing_status,
        "upload_status": video.upload_status,
        "visibility": video.visibility,
        "is_free_preview": video.is_free_preview,
        "thumbnail_url": None,  # Populated by caller if needed
        "created_at": video.created_at,
        "published_at": video.published_at,
    }


def _serialize_pdf(pdf: Any) -> dict[str, Any]:
    """Serialize a PDF ORM instance to a response dict.

    Args:
        pdf: The PDF ORM instance.

    Returns:
        dict: PDFResponse payload.
    """
    return {
        "id": pdf.id,
        "course_id": pdf.course_id,
        "title": pdf.title,
        "description": pdf.description,
        "sort_order": pdf.sort_order,
        "section": pdf.section,
        "file_size_bytes": pdf.file_size_bytes,
        "page_count": pdf.page_count,
        "mime_type": pdf.mime_type,
        "is_downloadable": pdf.is_downloadable,
        "is_free_preview": pdf.is_free_preview,
        "upload_status": pdf.upload_status,
        "visibility": pdf.visibility,
        "created_at": pdf.created_at,
    }


# ===========================================================================
# Background Task Functions (Celery-ready interface)
# ===========================================================================


async def _background_video_post_upload(
    video_id: uuid.UUID,
    teacher_id: uuid.UUID,
) -> None:
    """Post-upload background task for videos.

    Designed to run via FastAPI BackgroundTasks.
    Interface mirrors a Celery task signature for easy migration.

    Actions:
        - Log upload completion.
        - Future: trigger virus scan, thumbnail extraction, HLS transcode.

    Args:
        video_id: The uploaded video UUID.
        teacher_id: The uploading teacher UUID.
    """
    logger.info(
        "Post-upload background task: video=%s teacher=%s",
        video_id,
        teacher_id,
    )
    # Future: await virus_scan_service.scan(video_id)
    # Future: await thumbnail_service.extract(video_id)
    # Future: await transcode_service.enqueue_hls(video_id)


async def _background_pdf_post_upload(
    pdf_id: uuid.UUID,
    teacher_id: uuid.UUID,
) -> None:
    """Post-upload background task for PDFs.

    Args:
        pdf_id: The uploaded PDF UUID.
        teacher_id: The uploading teacher UUID.
    """
    logger.info(
        "Post-upload background task: pdf=%s teacher=%s",
        pdf_id,
        teacher_id,
    )
    # Future: await page_count_extractor.extract(pdf_id)
    # Future: await virus_scan_service.scan(pdf_id)
