"""Teacher module — service layer.

All business logic for the teacher portal. Services:
    - Call repositories for all database access.
    - Integrate with Cloudflare R2 for storage operations.
    - Write to AuditLog for key events.
    - Cache read-heavy dashboard stats in Redis.
    - Raise domain exceptions for all error conditions.
    - Never import FastAPI or HTTPException.

Services:
    DashboardService           Aggregated dashboard statistics.
    CourseService              Course CRUD and publish lifecycle.
    MeetingService             Meeting CRUD and status transitions.
    ResourceService            Video + PDF upload pipeline.
    AnnouncementService        Pinned announcement messages.
    StudentManagementService   Enroll/suspend/block students.
    AttendanceService          Read attendance, CSV export.
    AnalyticsService           Revenue/enrollment/attendance charts.
    TeacherProfileService      Profile update and avatar presign.
"""

from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import (
    AnnouncementNotFoundError,
    CourseAlreadyPublishedError,
    CourseNotFoundError,
    CourseNotReadyError,
    EnrollmentNotFoundError,
    InvalidSeatLimitError,
    InvalidUploadTypeError,
    MeetingInPastError,
    MeetingNotCancellableError,
    MeetingNotFoundError,
    R2OperationError,
    ResourceNotFoundError,
    SlugConflictError,
    StudentNotFoundError,
)
from app.core.redis import RedisKeys
from app.core.redis import operations as RedisOps
from app.core.storage import r2
from app.core.storage.r2 import (
    ALLOWED_IMAGE_MIME_TYPES,
    ALLOWED_PDF_MIME_TYPES,
    ALLOWED_VIDEO_MIME_TYPES,
    ext_from_mime,
    make_avatar_key,
    make_pdf_key,
    make_thumbnail_key,
    make_video_key,
)
from app.models.audit import AuditLog
from app.models.course import Course, CourseEnrollment
from app.models.chat import ChatRoom
from app.models.enums import (
    AuditSeverity,
    CourseStatus,
    EnrollmentStatus,
    MeetingStatus,
    UploadStatus,
    VideoProcessingStatus,
)
from app.models.user import User
from app.modules.teacher.repository import (
    AnalyticsRepository,
    AnnouncementRepository,
    AttendanceRepository,
    CourseCategoryRepository,
    CourseRepository,
    MeetingRepository,
    PDFRepository,
    StudentManagementRepository,
    TeacherProfileRepository,
    VideoRepository,
)
from app.modules.teacher.schemas import (
    CreateAnnouncementRequest,
    CreateCourseRequest,
    CreateMeetingRequest,
    CreatePDFRequest,
    CreateVideoRequest,
    UpdateAnnouncementRequest,
    UpdateCourseRequest,
    UpdateMeetingRequest,
    UpdatePDFRequest,
    UpdateTeacherProfileRequest,
    UpdateVideoRequest,
)

logger = logging.getLogger(__name__)

# Redis cache TTL for dashboard stats (5 minutes)
_DASHBOARD_CACHE_TTL = 300


# ---------------------------------------------------------------------------
# Slug generation helper
# ---------------------------------------------------------------------------


def _slugify(text: str) -> str:
    """Convert a title to a URL-safe slug.

    Args:
        text: The raw title string.

    Returns:
        str: Lowercased, hyphenated slug.
    """
    import re
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = slug.strip("-")
    return slug[:200]


# ---------------------------------------------------------------------------
# Audit log helper
# ---------------------------------------------------------------------------
def _audit(
    db: AsyncSession,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    severity: str = AuditSeverity.INFO,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append an audit log record to the session (flushed with next commit).

    Args:
        db: The async SQLAlchemy session.
        actor: The teacher performing the action.
        action: Machine-readable action string (e.g. 'course.published').
        entity_type: Resource category string (e.g. 'course').
        entity_id: Optional UUID of the affected resource.
        severity: AuditSeverity value.
        metadata: Optional extra context (never contains PII).
    """
    sev_str = severity.value if hasattr(severity, "value") else str(severity)
    role_str = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    log = AuditLog(
        actor_id=actor.id,
        actor_role=role_str,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=sev_str,
        metadata_=metadata or {},
    )
    db.add(log)




# ===========================================================================
# DashboardService
# ===========================================================================


class DashboardService:
    """Aggregates all teacher dashboard statistics.

    Results are cached in Redis for ``_DASHBOARD_CACHE_TTL`` seconds to
    avoid N+1 queries on every page load. The cache is keyed per teacher.
    """

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        teacher: User,
    ) -> None:
        """Initialize DashboardService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._redis = redis
        self._teacher = teacher
        self._analytics = AnalyticsRepository(db)
        self._meetings = MeetingRepository(db)
        self._courses = CourseRepository(db)

    async def get_dashboard(self) -> dict[str, Any]:
        """Return the full dashboard payload, using Redis cache.

        Returns:
            dict: All dashboard stats and recent activity.
        """
        revenue = await self._analytics.get_revenue_stats(self._teacher.id)
        total_students = await self._analytics.get_total_students(self._teacher.id)
        total_courses = await self._courses.count_by_teacher(self._teacher.id)
        total_published = await self._courses.count_by_teacher(
            self._teacher.id, status=CourseStatus.PUBLISHED
        )
        status_counts = await self._courses.count_by_status(self._teacher.id)
        today_meetings = await self._meetings.get_today(self._teacher.id)
        upcoming = await self._meetings.get_upcoming(self._teacher.id, limit=5)
        recent_enrollments = await self._analytics.get_recent_enrollments(
            self._teacher.id, limit=5
        )
        recent_payments = await self._analytics.get_recent_payments(
            self._teacher.id, limit=5
        )

        return {
            "revenue": revenue,
            "total_students": total_students,
            "total_courses": total_courses,
            "total_published_courses": total_published,
            "today_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "course_title": "",  # populated by router from joined data
                    "scheduled_at": m.scheduled_at,
                    "duration_minutes": m.duration_minutes,
                    "status": m.status,
                    "meet_link": m.meet_link,
                }
                for m in today_meetings
            ],
            "upcoming_meetings": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "course_title": "",
                    "scheduled_at": m.scheduled_at,
                    "duration_minutes": m.duration_minutes,
                    "status": m.status,
                    "meet_link": m.meet_link,
                }
                for m in upcoming
            ],
            "recent_enrollments": recent_enrollments,
            "recent_payments": recent_payments,
            "course_count_by_status": status_counts,
        }


# ===========================================================================
# CourseService
# ===========================================================================


class CourseService:
    """Manages the full course lifecycle for the teacher.

    Responsibilities:
        - Course creation with unique slug generation.
        - Category assignment via CourseCategoryRepository.
        - Status transitions (draft → published → archived).
        - Thumbnail presign URL generation.
        - Soft-delete with R2 cleanup registration.
    """

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize CourseService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = CourseRepository(db)
        self._cat_repo = CourseCategoryRepository(db)
        self._video_repo = VideoRepository(db)
        self._pdf_repo = PDFRepository(db)

    async def create_course(self, data: CreateCourseRequest) -> Any:
        """Create a new course in draft status.

        Generates a unique slug from the title, validates category IDs,
        and auto-creates the course chat room.

        Args:
            data: Validated request data.

        Returns:
            Course: The newly created course ORM instance.

        Raises:
            SlugConflictError: If the generated slug is already in use.
            CategoryNotFoundError: If any category ID is invalid.
        """
        from app.core.exceptions.errors import CategoryNotFoundError

        # Validate categories
        if data.category_ids:
            if not await self._cat_repo.category_ids_exist(data.category_ids):
                raise CategoryNotFoundError()

        # Generate unique slug
        base_slug = _slugify(data.title)
        slug = base_slug
        suffix = 1
        while await self._repo.slug_exists(slug):
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        target_status = getattr(data, "status", CourseStatus.DRAFT) or CourseStatus.DRAFT
        published_at = datetime.now(timezone.utc) if target_status == CourseStatus.PUBLISHED else None

        course = await self._repo.create(
            teacher_id=self._teacher.id,
            title=data.title,
            slug=slug,
            description=data.description,
            short_description=data.short_description,
            price=data.price,
            original_price=data.original_price,
            currency=data.currency,
            level=data.level or CourseLevel.BEGINNER,
            language=data.language,
            visibility=data.visibility,
            max_students=data.max_students,
            is_certificate_enabled=data.is_certificate_enabled,
            thumbnail_r2_key=data.thumbnail_r2_key,
            metadata_=data.metadata,
            status=target_status,
            published_at=published_at,
        )

        # Assign categories
        if data.category_ids:
            await self._cat_repo.set_categories(
                course.id, data.category_ids, data.primary_category_id
            )

        # Auto-create chat rooms (Announcements + General)
        ann_room = ChatRoom(
            course_id=course.id,
            name=f"{data.title} — Announcements",
            room_type="announcement",
            is_announcement_only=True,
        )
        gen_room = ChatRoom(
            course_id=course.id,
            name=f"{data.title} — General",
            room_type="general",
            is_announcement_only=False,
        )
        self._db.add_all([ann_room, gen_room])
        await self._db.flush()

        _audit(
            self._db,
            self._teacher,
            "course.created",
            "course",
            course.id,
            metadata={"slug": slug, "title": data.title},
        )

        logger.info("Course created id=%s teacher=%s", course.id, self._teacher.id)
        return course

    async def update_course(self, course_id: uuid.UUID, data: UpdateCourseRequest) -> Any:
        """Apply partial updates to a course.

        Args:
            course_id: The course UUID to update.
            data: Partial update data (all fields optional).

        Returns:
            Course: The updated course.

        Raises:
            CourseNotFoundError: If the course does not exist or is not owned by the teacher.
            SlugConflictError: If a title change results in a conflicting slug.
        """
        from app.core.exceptions.errors import CategoryNotFoundError

        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        updates: dict[str, Any] = {}

        if data.max_students is not None:
            active_enrolled = await self._repo.get_active_enrolled_count(course_id)
            if data.max_students < active_enrolled:
                raise InvalidSeatLimitError(
                    message=f"Cannot reduce seat limit to {data.max_students} because {active_enrolled} student(s) are already enrolled."
                )

        if data.title is not None:
            new_slug = _slugify(data.title)
            if await self._repo.slug_exists(new_slug, exclude_id=course_id):
                raise SlugConflictError()
            updates["title"] = data.title
            updates["slug"] = new_slug

        for field in (
            "description",
            "short_description",
            "price",
            "original_price",
            "currency",
            "level",
            "language",
            "visibility",
            "max_students",
            "is_certificate_enabled",
            "thumbnail_r2_key",
        ):
            val = getattr(data, field)
            if val is not None:
                updates[field] = val

        if data.metadata is not None:
            updates["metadata_"] = data.metadata

        if updates:
            await self._repo.update(course, **updates)

        if data.category_ids is not None:
            if data.category_ids and not await self._cat_repo.category_ids_exist(
                data.category_ids
            ):
                raise CategoryNotFoundError()
            await self._cat_repo.set_categories(
                course.id, data.category_ids, data.primary_category_id
            )

        return course

    async def publish_course(self, course_id: uuid.UUID) -> Any:
        """Transition a course from draft to published.

        Validates that the course has a title, price, and at least one
        published video before allowing publication.

        Args:
            course_id: The course UUID.

        Returns:
            Course: The updated published course.

        Raises:
            CourseNotFoundError: If course not found.
            CourseAlreadyPublishedError: If already published.
            CourseNotReadyError: If required content is missing.
        """
        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        if course.status in (CourseStatus.PUBLISHED, "published"):
            return course

        if not course.title or course.price is None:
            raise CourseNotReadyError(
                message="Course must have a title and price before publishing."
            )

        # Allow publishing as long as title and price are present

        now = datetime.now(timezone.utc)
        course = await self._repo.update(
            course,
            status=CourseStatus.PUBLISHED,
            published_at=now,
        )

        _audit(
            self._db,
            self._teacher,
            "course.published",
            "course",
            course.id,
        )
        logger.info("Course published id=%s", course.id)
        return course

    async def unpublish_course(self, course_id: uuid.UUID) -> Any:
        """Revert a published course back to draft.

        Args:
            course_id: The course UUID.

        Returns:
            Course: The updated draft course.

        Raises:
            CourseNotFoundError: If not found or not owned.
        """
        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        course = await self._repo.update(course, status=CourseStatus.DRAFT)
        _audit(self._db, self._teacher, "course.unpublished", "course", course.id)
        return course

    async def archive_course(self, course_id: uuid.UUID) -> Any:
        """Archive a course (hides from students, preserves data).

        Args:
            course_id: The course UUID.

        Returns:
            Course: The archived course.

        Raises:
            CourseNotFoundError: If not found or not owned.
        """
        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        course = await self._repo.update(course, status=CourseStatus.ARCHIVED)
        _audit(self._db, self._teacher, "course.archived", "course", course.id)
        return course

    async def delete_course(self, course_id: uuid.UUID) -> None:
        """Soft-delete a course and all related resources, meetings, chat rooms, and tests.

        Args:
            course_id: The course UUID.

        Raises:
            CourseNotFoundError: If not found or not owned.
        """
        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        # Best-effort cleanup of associated R2 storage objects
        try:
            videos = await self._video_repo.list_by_course(course_id)
            for video in videos:
                if video.r2_object_key:
                    await r2.delete_object(video.r2_object_key)
        except Exception as exc:
            logger.warning("Failed to delete video R2 objects for course_id=%s: %s", course_id, exc)

        try:
            pdfs = await self._pdf_repo.list_by_course(course_id)
            for pdf in pdfs:
                if pdf.r2_object_key:
                    await r2.delete_object(pdf.r2_object_key)
        except Exception as exc:
            logger.warning("Failed to delete PDF R2 objects for course_id=%s: %s", course_id, exc)

        if course.thumbnail_r2_key:
            try:
                await r2.delete_object(course.thumbnail_r2_key)
            except Exception as exc:
                logger.warning("Failed to delete thumbnail R2 object for course_id=%s: %s", course_id, exc)

        await self._repo.soft_delete(course)
        _audit(
            self._db,
            self._teacher,
            "course.deleted",
            "course",
            course.id,
            severity=AuditSeverity.WARNING,
        )
        logger.info("Course and all related resources soft-deleted id=%s", course_id)

    async def get_thumbnail_presign_url(
        self,
        course_id: uuid.UUID,
        content_type: str,
        file_name: str,
    ) -> dict[str, Any]:
        """Generate a presigned R2 URL for uploading a course thumbnail.

        Also updates the course's thumbnail_r2_key in the database so the
        record is ready before the upload completes.

        Args:
            course_id: The course UUID.
            content_type: MIME type of the image (must be allowed image type).
            file_name: Original file name (used to derive extension).

        Returns:
            dict: {'upload_url', 'r2_key', 'expires_in'}.

        Raises:
            CourseNotFoundError: If not found.
            InvalidUploadTypeError: If MIME type is not allowed.
        """
        if content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise InvalidUploadTypeError()

        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        ext = ext_from_mime(content_type)
        r2_key = make_thumbnail_key(course_id, ext)
        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        upload_url = await r2.generate_presigned_upload_url(
            r2_key, content_type, expiry_seconds=expiry
        )

        # Record the key immediately so the course is ready on confirm
        await self._repo.update(course, thumbnail_r2_key=r2_key)

        return {"upload_url": upload_url, "r2_key": r2_key, "expires_in": expiry}

    async def get_course(self, course_id: uuid.UUID) -> Any:
        """Fetch a course with ownership validation.

        Args:
            course_id: The course UUID.

        Returns:
            Course: The course ORM instance.

        Raises:
            CourseNotFoundError: If not found or not owned.
        """
        course = await self._repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()
        return course

    async def list_courses(
        self,
        page: int,
        page_size: int,
        status: Optional[str] = None,
        visibility: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[Any], int]:
        """Return paginated course list for the teacher.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            status: Optional status filter.
            visibility: Optional visibility filter.
            search: Optional title search.
            sort_by: Column to sort by.
            sort_order: 'asc' or 'desc'.

        Returns:
            tuple: (list of Course, total count).
        """
        return await self._repo.list_by_teacher(
            self._teacher.id,
            page=page,
            page_size=page_size,
            status=status,
            visibility=visibility,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )


# ===========================================================================
# MeetingService
# ===========================================================================


class MeetingService:
    """Manages meeting scheduling and status transitions."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize MeetingService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = MeetingRepository(db)
        self._course_repo = CourseRepository(db)

    async def create_meeting(self, data: CreateMeetingRequest) -> Any:
        """Create and schedule a new meeting.

        Args:
            data: Validated meeting creation data.

        Returns:
            Meeting: The created meeting.

        Raises:
            CourseNotFoundError: If course_id is not owned by teacher.
            MeetingInPastError: If scheduled_at is in the past.
        """
        course = await self._course_repo.get_by_id(
            data.course_id, teacher_id=self._teacher.id
        )
        if course is None:
            raise CourseNotFoundError()

        if data.scheduled_at.tzinfo and data.scheduled_at <= datetime.now(timezone.utc):
            raise MeetingInPastError()

        meeting = await self._repo.create(
            course_id=data.course_id,
            teacher_id=self._teacher.id,
            title=data.title,
            description=data.description,
            meeting_url=data.meet_link,
            scheduled_at=data.scheduled_at,
            duration_minutes=data.duration_minutes,
            status=MeetingStatus.SCHEDULED,
        )

        _audit(
            self._db,
            self._teacher,
            "meeting.created",
            "meeting",
            meeting.id,
            metadata={"course_id": str(data.course_id), "title": data.title},
        )
        return meeting

    async def update_meeting(
        self, meeting_id: uuid.UUID, data: UpdateMeetingRequest
    ) -> Any:
        """Apply partial updates to a meeting.

        Args:
            meeting_id: The meeting UUID.
            data: Partial update data.

        Returns:
            Meeting: The updated meeting.

        Raises:
            MeetingNotFoundError: If not found or not owned.
        """
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            raise MeetingNotFoundError()

        updates: dict[str, Any] = {}
        for field in ("title", "description", "scheduled_at", "duration_minutes", "status"):
            val = getattr(data, field, None)
            if val is not None:
                updates[field] = val

        if getattr(data, "meet_link", None) is not None:
            updates["meeting_url"] = data.meet_link

        if updates:
            await self._repo.update(meeting, **updates)
        return meeting

    async def cancel_meeting(self, meeting_id: uuid.UUID) -> Any:
        """Cancel a scheduled or live meeting.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            Meeting: The cancelled meeting.

        Raises:
            MeetingNotFoundError: If not found.
            MeetingNotCancellableError: If meeting is completed.
        """
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            raise MeetingNotFoundError()

        if meeting.status not in (MeetingStatus.SCHEDULED, MeetingStatus.LIVE):
            raise MeetingNotCancellableError()

        return await self._repo.update(meeting, status=MeetingStatus.CANCELLED)

    async def start_meeting(self, meeting_id: uuid.UUID) -> Any:
        """Mark a meeting as live.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            Meeting: The updated meeting.

        Raises:
            MeetingNotFoundError: If not found.
        """
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            raise MeetingNotFoundError()

        return await self._repo.update(
            meeting,
            status=MeetingStatus.LIVE,
            actual_started_at=datetime.now(timezone.utc),
        )

    async def end_meeting(self, meeting_id: uuid.UUID) -> Any:
        """Mark a meeting as completed.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            Meeting: The updated meeting.

        Raises:
            MeetingNotFoundError: If not found.
        """
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            raise MeetingNotFoundError()

        return await self._repo.update(
            meeting,
            status=MeetingStatus.COMPLETED,
            actual_ended_at=datetime.now(timezone.utc),
        )

    async def delete_meeting(self, meeting_id: uuid.UUID) -> None:
        """Soft-delete a meeting."""
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            return

        await self._repo.soft_delete(meeting)
        _audit(self._db, self._teacher, "meeting.deleted", "meeting", meeting_id)

    async def get_meeting(self, meeting_id: uuid.UUID) -> Any:
        """Fetch a meeting with ownership validation.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            Meeting: The meeting instance.

        Raises:
            MeetingNotFoundError: If not found.
        """
        meeting = await self._repo.get_by_id(meeting_id, teacher_id=self._teacher.id)
        if meeting is None:
            raise MeetingNotFoundError()
        return meeting

    async def list_meetings(
        self,
        page: int,
        page_size: int,
        course_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        upcoming_only: bool = False,
    ) -> tuple[list[Any], int]:
        """Return paginated meeting list.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            course_id: Optional course filter.
            status: Optional status filter.
            upcoming_only: Return only future meetings.

        Returns:
            tuple: (list of Meeting, total count).
        """
        return await self._repo.list_by_teacher(
            self._teacher.id,
            page=page,
            page_size=page_size,
            course_id=course_id,
            status=status,
            upcoming_only=upcoming_only,
        )


# ===========================================================================
# ResourceService
# ===========================================================================


class ResourceService:
    """Manages video and PDF resource lifecycle.

    Two-phase upload flow:
        1. Client calls create → DB record created, presigned PUT URL returned.
        2. Client uploads directly to R2 using the presigned URL.
        3. Client calls confirm → upload_status set to 'completed'.

    Soft-delete triggers R2 object deletion (best-effort).
    """

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize ResourceService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._video_repo = VideoRepository(db)
        self._pdf_repo = PDFRepository(db)
        self._course_repo = CourseRepository(db)

    # ---- Videos ------------------------------------------------------------

    async def create_video(
        self, course_id: uuid.UUID, data: CreateVideoRequest
    ) -> dict[str, Any]:
        """Create a video record and return an R2 presigned upload URL.

        Args:
            course_id: The course UUID to attach the video to.
            data: Video metadata and MIME type.

        Returns:
            dict: {'video': Video, 'upload_url': str, 'r2_key': str, 'expires_in': int}.

        Raises:
            CourseNotFoundError: If course is not found or not owned.
            InvalidUploadTypeError: If MIME type not allowed.
        """
        course = await self._course_repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        if data.mime_type not in ALLOWED_VIDEO_MIME_TYPES:
            raise InvalidUploadTypeError()

        video_id = uuid.uuid4()
        ext = ext_from_mime(data.mime_type)
        r2_key = make_video_key(course_id, video_id, ext)

        from app.config import get_settings
        settings = get_settings()
        expiry = settings.R2_PRESIGNED_URL_EXPIRY_UPLOAD

        upload_url = await r2.generate_presigned_upload_url(
            r2_key, data.mime_type, expiry_seconds=expiry
        )

        video = await self._video_repo.create(
            id=video_id,
            course_id=course_id,
            title=data.title,
            description=data.description,
            section=data.section,
            sort_order=data.sort_order,
            visibility=data.visibility,
            is_free_preview=data.is_free_preview,
            mime_type=data.mime_type,
            r2_object_key=r2_key,
            upload_status=UploadStatus.PENDING,
            processing_status=VideoProcessingStatus.UPLOADING,
        )

        _audit(
            self._db,
            self._teacher,
            "resource.video.created",
            "video",
            video.id,
            metadata={"course_id": str(course_id)},
        )

        return {
            "video": video,
            "upload_url": upload_url,
            "r2_key": r2_key,
            "expires_in": expiry,
        }

    async def confirm_video_upload(
        self,
        course_id: uuid.UUID,
        video_id: uuid.UUID,
        file_size_bytes: int,
        duration_seconds: Optional[int] = None,
    ) -> Any:
        """Mark a video upload as completed.

        Args:
            course_id: The course UUID.
            video_id: The video UUID.
            file_size_bytes: Size of the uploaded file.
            duration_seconds: Optional video duration.

        Returns:
            Video: The updated video.

        Raises:
            ResourceNotFoundError: If video not found.
        """
        video = await self._video_repo.get_by_id(video_id, course_id=course_id)
        if video is None:
            raise ResourceNotFoundError()

        updates: dict[str, Any] = {
            "upload_status": UploadStatus.COMPLETED,
            "processing_status": VideoProcessingStatus.READY,
            "file_size_bytes": file_size_bytes,
        }
        if duration_seconds is not None:
            updates["duration_seconds"] = duration_seconds

        updated_video = await self._video_repo.update(video, **updates)
        from app.modules.resource.notifications import notify_enrolled_students_of_resource
        await notify_enrolled_students_of_resource(
            self._db,
            course_id=course_id,
            resource_title=video.title,
            resource_type="video",
            resource_id=video.id,
            teacher=self._teacher,
        )
        return updated_video

    async def update_video(
        self, course_id: uuid.UUID, video_id: uuid.UUID, data: UpdateVideoRequest
    ) -> Any:
        """Update video metadata.

        Args:
            course_id: The course UUID.
            video_id: The video UUID.
            data: Partial update data.

        Returns:
            Video: The updated video.

        Raises:
            ResourceNotFoundError: If not found.
        """
        video = await self._video_repo.get_by_id(video_id, course_id=course_id)
        if video is None:
            raise ResourceNotFoundError()

        updates: dict[str, Any] = {}
        for field in ("title", "description", "section", "sort_order", "visibility", "is_free_preview"):
            val = getattr(data, field)
            if val is not None:
                updates[field] = val

        if updates:
            await self._video_repo.update(video, **updates)
        return video

    async def delete_video(
        self, course_id: uuid.UUID, video_id: uuid.UUID
    ) -> None:
        """Soft-delete a video and best-effort delete from R2.

        Args:
            course_id: The course UUID.
            video_id: The video UUID.

        Raises:
            ResourceNotFoundError: If not found.
        """
        video = await self._video_repo.get_by_id(video_id, course_id=course_id)
        if video is None:
            raise ResourceNotFoundError()

        r2_key = video.r2_object_key
        await self._video_repo.soft_delete(video)
        await r2.delete_object(r2_key)  # best-effort, logs on failure
        _audit(
            self._db,
            self._teacher,
            "resource.video.deleted",
            "video",
            video_id,
            severity=AuditSeverity.WARNING,
        )

    async def reorder_videos(
        self, course_id: uuid.UUID, items: list[dict[str, Any]]
    ) -> None:
        """Reorder videos within a course.

        Args:
            course_id: The course UUID (ownership validated upstream).
            items: List of {'id': UUID, 'sort_order': int} dicts.
        """
        await self._video_repo.reorder(items)

    # ---- PDFs --------------------------------------------------------------

    async def create_pdf(
        self, course_id: uuid.UUID, data: CreatePDFRequest
    ) -> dict[str, Any]:
        """Create a PDF record and return an R2 presigned upload URL.

        Args:
            course_id: The course UUID.
            data: PDF metadata.

        Returns:
            dict: {'pdf': PDF, 'upload_url': str, 'r2_key': str, 'expires_in': int}.

        Raises:
            CourseNotFoundError: If course not found.
            InvalidUploadTypeError: If MIME type not allowed.
        """
        course = await self._course_repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        if data.mime_type not in ALLOWED_PDF_MIME_TYPES:
            raise InvalidUploadTypeError()

        pdf_id = uuid.uuid4()
        r2_key = make_pdf_key(course_id, pdf_id)

        from app.config import get_settings
        settings = get_settings()
        expiry = settings.R2_PRESIGNED_URL_EXPIRY_UPLOAD

        upload_url = await r2.generate_presigned_upload_url(
            r2_key, data.mime_type, expiry_seconds=expiry
        )

        pdf = await self._pdf_repo.create(
            id=pdf_id,
            course_id=course_id,
            title=data.title,
            description=data.description,
            section=data.section,
            sort_order=data.sort_order,
            visibility=data.visibility,
            is_downloadable=data.is_downloadable,
            is_free_preview=data.is_free_preview,
            file_size_bytes=data.file_size_bytes,
            mime_type=data.mime_type,
            r2_object_key=r2_key,
            upload_status=UploadStatus.PENDING,
        )

        _audit(
            self._db,
            self._teacher,
            "resource.pdf.created",
            "pdf",
            pdf.id,
            metadata={"course_id": str(course_id)},
        )

        return {
            "pdf": pdf,
            "upload_url": upload_url,
            "r2_key": r2_key,
            "expires_in": expiry,
        }

    async def confirm_pdf_upload(
        self, course_id: uuid.UUID, pdf_id: uuid.UUID, page_count: Optional[int] = None
    ) -> Any:
        """Mark a PDF upload as completed.

        Args:
            course_id: The course UUID.
            pdf_id: The PDF UUID.
            page_count: Optional number of pages (set by client after parsing).

        Returns:
            PDF: The updated PDF record.

        Raises:
            ResourceNotFoundError: If not found.
        """
        pdf = await self._pdf_repo.get_by_id(pdf_id, course_id=course_id)
        if pdf is None:
            raise ResourceNotFoundError()

        updates: dict[str, Any] = {"upload_status": UploadStatus.COMPLETED}
        if page_count is not None:
            updates["page_count"] = page_count

        updated_pdf = await self._pdf_repo.update(pdf, **updates)
        from app.modules.resource.notifications import notify_enrolled_students_of_resource
        await notify_enrolled_students_of_resource(
            self._db,
            course_id=course_id,
            resource_title=pdf.title,
            resource_type="pdf",
            resource_id=pdf.id,
            teacher=self._teacher,
        )
        return updated_pdf

    async def update_pdf(
        self, course_id: uuid.UUID, pdf_id: uuid.UUID, data: UpdatePDFRequest
    ) -> Any:
        """Update PDF metadata.

        Args:
            course_id: The course UUID.
            pdf_id: The PDF UUID.
            data: Partial update data.

        Returns:
            PDF: The updated PDF.

        Raises:
            ResourceNotFoundError: If not found.
        """
        pdf = await self._pdf_repo.get_by_id(pdf_id, course_id=course_id)
        if pdf is None:
            raise ResourceNotFoundError()

        updates: dict[str, Any] = {}
        for field in (
            "title",
            "description",
            "section",
            "sort_order",
            "visibility",
            "is_downloadable",
            "is_free_preview",
            "page_count",
        ):
            val = getattr(data, field)
            if val is not None:
                updates[field] = val

        if updates:
            await self._pdf_repo.update(pdf, **updates)
        return pdf

    async def delete_pdf(
        self, course_id: uuid.UUID, pdf_id: uuid.UUID
    ) -> None:
        """Soft-delete a PDF and best-effort delete from R2.

        Args:
            course_id: The course UUID.
            pdf_id: The PDF UUID.

        Raises:
            ResourceNotFoundError: If not found.
        """
        pdf = await self._pdf_repo.get_by_id(pdf_id, course_id=course_id)
        if pdf is None:
            raise ResourceNotFoundError()

        r2_key = pdf.r2_object_key
        await self._pdf_repo.soft_delete(pdf)
        await r2.delete_object(r2_key)
        _audit(
            self._db,
            self._teacher,
            "resource.pdf.deleted",
            "pdf",
            pdf_id,
            severity=AuditSeverity.WARNING,
        )

    async def reorder_pdfs(
        self, course_id: uuid.UUID, items: list[dict[str, Any]]
    ) -> None:
        """Reorder PDFs within a course.

        Args:
            course_id: The course UUID.
            items: List of {'id': UUID, 'sort_order': int} dicts.
        """
        await self._pdf_repo.reorder(items)


# ===========================================================================
# AnnouncementService
# ===========================================================================


class AnnouncementService:
    """Manages course announcements stored as pinned chat messages."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize AnnouncementService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = AnnouncementRepository(db)
        self._course_repo = CourseRepository(db)

    async def _get_course_chat_room(
        self, course_id: uuid.UUID, room_type: str = "announcement"
    ) -> ChatRoom:
        """Fetch the course's specified chat room, auto-creating both if missing.

        Args:
            course_id: The course UUID.
            room_type: 'announcement' or 'general'.

        Returns:
            ChatRoom: The requested course chat room.

        Raises:
            CourseNotFoundError: If course not found.
        """
        course = await self._course_repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        chat_room = await self._repo.get_chat_room_by_course(course_id, room_type=room_type)
        if chat_room is None:
            # Auto-create if missing (edge case for legacy courses)
            ann_room = ChatRoom(
                course_id=course_id,
                name=f"{course.title} — Announcements",
                room_type="announcement",
                is_announcement_only=True,
            )
            gen_room = ChatRoom(
                course_id=course_id,
                name=f"{course.title} — General",
                room_type="general",
                is_announcement_only=False,
            )
            self._db.add_all([ann_room, gen_room])
            await self._db.flush()
            chat_room = ann_room if room_type == "announcement" else gen_room

        return chat_room

    async def create_announcement(
        self, course_id: uuid.UUID, data: CreateAnnouncementRequest
    ) -> Any:
        """Post a new announcement in the course chat room.

        Args:
            course_id: The course UUID.
            data: Announcement content and pin setting.

        Returns:
            Message: The created announcement message.
        """
        chat_room = await self._get_course_chat_room(course_id)

        msg = await self._repo.create(
            chat_room_id=chat_room.id,
            sender_id=self._teacher.id,
            content=data.content,
            is_pinned=data.is_pinned,
        )

        _audit(
            self._db,
            self._teacher,
            "announcement.created",
            "message",
            msg.id,
            metadata={"course_id": str(course_id)},
        )
        return msg

    async def update_announcement(
        self,
        course_id: uuid.UUID,
        announcement_id: uuid.UUID,
        data: UpdateAnnouncementRequest,
    ) -> Any:
        """Update an announcement's content or pin status.

        Args:
            course_id: The course UUID.
            announcement_id: The message UUID.
            data: Partial update data.

        Returns:
            Message: The updated message.

        Raises:
            AnnouncementNotFoundError: If not found.
        """
        msg = await self._repo.get_by_id(announcement_id, course_id=course_id)
        if msg is None:
            raise AnnouncementNotFoundError()

        updates: dict[str, Any] = {}
        if data.content is not None:
            updates["content"] = data.content
            updates["is_edited"] = True
            updates["edited_at"] = datetime.now(timezone.utc)
        if data.is_pinned is not None:
            updates["is_pinned"] = data.is_pinned
            if data.is_pinned:
                updates["pinned_at"] = datetime.now(timezone.utc)
                updates["pinned_by"] = self._teacher.id

        if updates:
            await self._repo.update(msg, **updates)
        return msg

    async def delete_announcement(
        self, course_id: uuid.UUID, announcement_id: uuid.UUID
    ) -> None:
        """Soft-delete an announcement.

        Args:
            course_id: The course UUID.
            announcement_id: The message UUID.

        Raises:
            AnnouncementNotFoundError: If not found.
        """
        msg = await self._repo.get_by_id(announcement_id, course_id=course_id)
        if msg is None:
            raise AnnouncementNotFoundError()

        await self._repo.delete(msg)

    async def pin_announcement(
        self, course_id: uuid.UUID, announcement_id: uuid.UUID, pin: bool
    ) -> Any:
        """Pin or unpin an announcement.

        Args:
            course_id: The course UUID.
            announcement_id: The announcement UUID.
            pin: True to pin, False to unpin.

        Returns:
            Message: The updated message.

        Raises:
            AnnouncementNotFoundError: If not found.
        """
        msg = await self._repo.get_by_id(announcement_id, course_id=course_id)
        if msg is None:
            raise AnnouncementNotFoundError()

        updates: dict[str, Any] = {"is_pinned": pin}
        if pin:
            updates["pinned_at"] = datetime.now(timezone.utc)
            updates["pinned_by"] = self._teacher.id
        else:
            updates["pinned_at"] = None
            updates["pinned_by"] = None

        return await self._repo.update(msg, **updates)

    async def list_announcements(
        self, course_id: uuid.UUID, page: int, page_size: int
    ) -> tuple[list[Any], int]:
        """List all announcements for a course.

        Args:
            course_id: The course UUID.
            page: 1-indexed page number.
            page_size: Items per page.

        Returns:
            tuple: (list of Message, total count).

        Raises:
            CourseNotFoundError: If course not found.
        """
        course = await self._course_repo.get_by_id(course_id, teacher_id=self._teacher.id)
        if course is None:
            raise CourseNotFoundError()

        return await self._repo.list_by_course(course_id, page=page, page_size=page_size)


# ===========================================================================
# StudentManagementService
# ===========================================================================


class StudentManagementService:
    """Manages teacher's enrolled student interactions."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize StudentManagementService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = StudentManagementRepository(db)

    async def list_students(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None,
        course_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated enrolled student list.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            search: Optional name/email search.
            course_id: Optional course filter.
            is_active: Optional active filter.

        Returns:
            tuple: (list of student dicts, total count).
        """
        return await self._repo.list_enrolled_students(
            self._teacher.id,
            page=page,
            page_size=page_size,
            search=search,
            course_id=course_id,
            is_active=is_active,
        )

    async def list_all_students_directory(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return directory of all platform students for teacher DMs."""
        return await self._repo.list_all_students_directory(
            page=page,
            page_size=page_size,
            search=search,
        )


    async def get_student_detail(self, student_id: uuid.UUID) -> dict[str, Any]:
        """Fetch full student profile visible to the teacher.

        Args:
            student_id: The student UUID.

        Returns:
            dict: Student profile + enrollment history.

        Raises:
            StudentNotFoundError: If not found or not enrolled in any teacher course.
        """
        data = await self._repo.get_student_with_enrollments(student_id, self._teacher.id)
        if data is None:
            raise StudentNotFoundError()
        return data

    async def suspend_student(
        self,
        student_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
    ) -> None:
        """Suspend a student from a specific course (or all teacher's courses if omitted)."""
        if course_id:
            enrollment = await self._repo.get_enrollment(student_id, course_id)
            enrollments = [enrollment] if enrollment else []
        else:
            enrollments = await self._repo.get_student_enrollments(student_id, self._teacher.id)

        if not enrollments:
            raise StudentNotFoundError()

        for e in enrollments:
            if e:
                await self._repo.update_enrollment_status(e, EnrollmentStatus.SUSPENDED)
                _audit(
                    self._db,
                    self._teacher,
                    "student.suspended",
                    "enrollment",
                    e.id,
                    severity=AuditSeverity.WARNING,
                    metadata={"reason": reason, "student_id": str(student_id)},
                )

    async def unsuspend_student(
        self, student_id: uuid.UUID, course_id: Optional[uuid.UUID] = None
    ) -> None:
        """Restore a suspended student's access to a course (or all teacher's courses if omitted)."""
        if course_id:
            enrollment = await self._repo.get_enrollment(student_id, course_id)
            enrollments = [enrollment] if enrollment else []
        else:
            enrollments = await self._repo.get_student_enrollments(student_id, self._teacher.id)

        if not enrollments:
            raise StudentNotFoundError()

        for e in enrollments:
            if e:
                await self._repo.update_enrollment_status(e, EnrollmentStatus.ACTIVE)

    async def unenroll_student(
        self,
        student_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
    ) -> None:
        """Unenroll a student from a specific course (or all teacher's courses if omitted)."""
        if course_id:
            enrollment = await self._repo.get_enrollment(student_id, course_id)
            enrollments = [enrollment] if enrollment else []
        else:
            enrollments = await self._repo.get_student_enrollments(student_id, self._teacher.id)

        if not enrollments:
            raise StudentNotFoundError()

        for e in enrollments:
            if e:
                enrollment_id = e.id
                c_id = e.course_id
                course = await self._db.get(Course, c_id)
                if course and course.total_enrollments and course.total_enrollments > 0:
                    course.total_enrollments -= 1
                await self._repo.delete_enrollment(e)
                _audit(
                    self._db,
                    self._teacher,
                    "student.unenrolled",
                    "enrollment",
                    enrollment_id,
                    severity=AuditSeverity.WARNING,
                    metadata={"reason": reason, "student_id": str(student_id), "course_id": str(c_id)},
                )

    async def block_student(
        self, student_id: uuid.UUID, reason: Optional[str] = None
    ) -> None:
        """Block a student's account (deactivate is_active).

        Args:
            student_id: The student UUID.
            reason: Optional block reason.

        Raises:
            StudentNotFoundError: If student not found.
        """
        user = await self._repo.get_student(student_id)
        if user is None:
            raise StudentNotFoundError()

        await self._repo.update_user_active(user, is_active=False)
        _audit(
            self._db,
            self._teacher,
            "student.blocked",
            "user",
            student_id,
            severity=AuditSeverity.WARNING,
            metadata={"reason": reason},
        )

    async def unblock_student(self, student_id: uuid.UUID) -> None:
        """Reactivate a blocked student account.

        Args:
            student_id: The student UUID.

        Raises:
            StudentNotFoundError: If student not found.
        """
        user = await self._repo.get_student(student_id)
        if user is None:
            raise StudentNotFoundError()

        await self._repo.update_user_active(user, is_active=True)

    async def get_payment_history(
        self, student_id: uuid.UUID
    ) -> list[Any]:
        """Return payment history for a student scoped to teacher's courses.

        Args:
            student_id: The student UUID.

        Returns:
            list[Payment]: Payments.
        """
        return await self._repo.get_payment_history(student_id, self._teacher.id)


# ===========================================================================
# AttendanceService
# ===========================================================================


class AttendanceService:
    """Provides read access and CSV export for session attendance."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize AttendanceService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = AttendanceRepository(db)
        self._meeting_repo = MeetingRepository(db)

    async def _validate_meeting(self, meeting_id: uuid.UUID) -> None:
        """Ensure the meeting belongs to the teacher.

        Args:
            meeting_id: The meeting UUID.

        Raises:
            MeetingNotFoundError: If not found or not owned.
        """
        meeting = await self._meeting_repo.get_by_id(
            meeting_id, teacher_id=self._teacher.id
        )
        if meeting is None:
            raise MeetingNotFoundError()

    async def get_meeting_attendance(
        self, meeting_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """Return attendance list for a meeting.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            list[dict]: Attendance records with student details.

        Raises:
            MeetingNotFoundError: If not found or not owned.
        """
        await self._validate_meeting(meeting_id)
        rows = await self._repo.list_by_meeting(meeting_id)
        return [
            {
                "id": att.id,
                "meeting_id": att.meeting_id,
                "student_id": att.student_id,
                "status": att.status,
                "join_time": att.join_time,
                "leave_time": att.leave_time,
                "total_duration_seconds": att.total_duration_seconds,
                "attendance_percentage": float(att.attendance_percentage),
                "is_late": att.is_late,
                "student_name": user.full_name,
                "student_email": user.email,
            }
            for att, user in rows
        ]

    async def get_attendance_summary(self) -> dict[str, Any]:
        """Return overall attendance analytics for the teacher.

        Returns:
            dict: Aggregate attendance stats.
        """
        return await self._repo.get_summary_for_teacher(self._teacher.id)

    async def export_attendance_csv(self, meeting_id: uuid.UUID) -> str:
        """Generate a CSV string of attendance data for a meeting.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            str: CSV-formatted attendance data.

        Raises:
            MeetingNotFoundError: If not owned.
        """
        await self._validate_meeting(meeting_id)
        rows = await self._repo.get_export_data(meeting_id)

        output = io.StringIO()
        if not rows:
            return ""

        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        return output.getvalue()


# ===========================================================================
# AnalyticsService
# ===========================================================================


class AnalyticsService:
    """Provides revenue, enrollment, attendance, and course analytics."""

    # Period → timedelta lookup
    _PERIOD_MAP: dict[str, Optional[timedelta]] = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "1y": timedelta(days=365),
        "all": None,
        "daily": timedelta(days=1),
        "weekly": timedelta(days=7),
        "monthly": timedelta(days=30),
        "yearly": timedelta(days=365),
        "DAILY": timedelta(days=1),
        "WEEKLY": timedelta(days=7),
        "MONTHLY": timedelta(days=30),
        "YEARLY": timedelta(days=365),
        "ALL": None,
    }

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize AnalyticsService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = AnalyticsRepository(db)
        self._att_repo = AttendanceRepository(db)

    def _since(self, period: str) -> datetime:
        """Compute the start datetime for the given period string.

        Args:
            period: Period string ('7d', '30d', '90d', '1y', 'all').

        Returns:
            datetime: UTC start of the period, or epoch for 'all'.
        """
        delta = self._PERIOD_MAP.get(period)
        if delta is None:
            return datetime(2020, 1, 1, tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - delta

    async def get_revenue_analytics(
        self, period: str, course_id: Optional[uuid.UUID] = None
    ) -> dict[str, Any]:
        """Return revenue time-series and totals.

        Args:
            period: Time window identifier.
            course_id: Optional filter to a single course.

        Returns:
            dict: Revenue analytics payload.
        """
        since = self._since(period)
        stats = await self._repo.get_revenue_stats(self._teacher.id)
        series = await self._repo.get_revenue_series(self._teacher.id, since)
        return {
            "period": period,
            "total_revenue": stats["total"],
            "currency": "INR",
            "data_points": series,
        }

    async def get_enrollment_analytics(
        self, period: str, course_id: Optional[uuid.UUID] = None
    ) -> dict[str, Any]:
        """Return enrollment time-series and totals.

        Args:
            period: Time window identifier.
            course_id: Optional course filter.

        Returns:
            dict: Enrollment analytics payload.
        """
        since = self._since(period)
        series = await self._repo.get_enrollment_series(self._teacher.id, since)
        total = sum(p["count"] for p in series)
        return {
            "period": period,
            "total_enrollments": total,
            "data_points": series,
        }

    async def get_attendance_analytics(self) -> dict[str, Any]:
        """Return attendance summary stats.

        Returns:
            dict: Attendance analytics payload.
        """
        summary = await self._att_repo.get_summary_for_teacher(self._teacher.id)
        total = summary.get("total_records", 0)
        present = summary.get("present_count", 0)
        absent = summary.get("absent_count", 0)
        late = summary.get("late_count", 0)

        return {
            "total_meetings": summary.get("total_meetings", 0),
            "average_attendance_rate": summary.get("average_attendance_rate", 0.0),
            "present_rate": round(present / total * 100, 2) if total > 0 else 0.0,
            "absent_rate": round(absent / total * 100, 2) if total > 0 else 0.0,
            "late_rate": round(late / total * 100, 2) if total > 0 else 0.0,
        }

    async def get_course_analytics(
        self, course_id: Optional[uuid.UUID] = None
    ) -> dict[str, Any]:
        """Return per-course performance analytics.

        Args:
            course_id: Optional filter to a single course.

        Returns:
            dict: Course analytics payload.
        """
        courses = await self._repo.get_course_performance(self._teacher.id, course_id)
        top = courses[0] if courses else None
        return {
            "courses": courses,
            "top_course_id": str(top["course_id"]) if top else None,
            "top_course_title": top["title"] if top else None,
        }


# ===========================================================================
# TeacherProfileService
# ===========================================================================


class TeacherProfileService:
    """Manages the teacher's own profile data and avatar upload."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize TeacherProfileService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = TeacherProfileRepository(db)

    async def get_profile(self) -> dict[str, Any]:
        """Return the teacher's profile combined from User + TeacherProfile.

        Returns:
            dict: Full teacher profile payload.
        """
        profile = await self._repo.get_by_user_id(self._teacher.id)
        return {
            "user_id": self._teacher.id,
            "full_name": self._teacher.full_name,
            "email": self._teacher.email,
            "avatar_r2_key": self._teacher.avatar_r2_key,
            "phone": self._teacher.phone,
            "bio": profile.bio if profile else None,
            "headline": profile.headline if profile else None,
            "website_url": profile.website_url if profile else None,
            "social_links": profile.social_links if profile else {},
            "total_students": profile.total_students if profile else 0,
            "total_courses": profile.total_courses if profile else 0,
            "total_revenue": float(profile.total_revenue) if profile else 0.0,
        }

    async def update_profile(self, data: UpdateTeacherProfileRequest) -> dict[str, Any]:
        """Update the teacher's user and profile fields.

        Args:
            data: Partial profile update data.

        Returns:
            dict: Updated teacher profile.
        """
        profile = await self._repo.get_by_user_id(self._teacher.id)

        user_updates: dict[str, Any] = {}
        if data.full_name is not None:
            user_updates["full_name"] = data.full_name
        if data.phone is not None:
            user_updates["phone"] = data.phone

        if user_updates:
            await self._repo.update_user_fields(self._teacher, **user_updates)

        if profile is not None:
            profile_updates: dict[str, Any] = {}
            for field in ("bio", "headline", "website_url", "social_links"):
                val = getattr(data, field)
                if val is not None:
                    profile_updates[field] = val
            if profile_updates:
                await self._repo.update_profile(profile, **profile_updates)

        return await self.get_profile()

    async def get_avatar_presign_url(
        self, content_type: str, file_name: str
    ) -> dict[str, Any]:
        """Generate a presigned R2 URL for avatar upload.

        Args:
            content_type: MIME type of the image.
            file_name: Original file name for extension derivation.

        Returns:
            dict: {'upload_url', 'r2_key', 'expires_in'}.

        Raises:
            InvalidUploadTypeError: If MIME type is not an allowed image type.
        """
        if content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise InvalidUploadTypeError(message="Only image files are allowed for avatars.")

        ext = ext_from_mime(content_type)
        r2_key = make_avatar_key(self._teacher.id, ext)

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        upload_url = await r2.generate_presigned_upload_url(
            r2_key, content_type, expiry_seconds=expiry
        )

        # Store the key immediately so the profile shows the avatar on first load
        await self._repo.update_user_fields(self._teacher, avatar_r2_key=r2_key)

        return {"upload_url": upload_url, "r2_key": r2_key, "expires_in": expiry}
