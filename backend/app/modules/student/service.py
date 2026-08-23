"""Student module — service layer.

All business logic for the student portal. Services:
    - Call repositories for all database access.
    - Gate content access behind enrollment verification.
    - Integrate with Cloudflare R2 for signed URL generation.
    - Write audit logs for content access events.
    - Never import FastAPI or HTTPException.
    - Strip meet links when meeting is not SCHEDULED/LIVE.

Services:
    DashboardService       Aggregate all dashboard sections.
    CourseService          List/search enrolled courses, course detail.
    ResourceService        Generate R2 signed URLs for video + PDF.
    ProgressService        Upsert progress, compute completion %.
    MeetingService         List meetings, gate meet link by enrollment + status.
    AttendanceService      Read attendance, compute stats.
    NotificationService    Read/mark/delete notifications.
    PaymentService         Payment history + payment detail.
    ProfileService         Profile update and avatar presign.
    SearchService          Cross-entity search scoped to enrollment.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import (
    CourseNotFoundError,
    EnrollmentNotFoundError,
    InvalidUploadTypeError,
    MeetingNotFoundError,
    ResourceNotFoundError,
)
from app.core.storage import r2
from app.core.storage.r2 import (
    ALLOWED_IMAGE_MIME_TYPES,
    ext_from_mime,
    make_avatar_key,
)
from app.models.audit import AuditLog
from app.models.enums import (
    AuditSeverity,
    EnrollmentStatus,
    MeetingStatus,
)
from app.models.user import User
from app.modules.student.repository import (
    StudentAttendanceRepository,
    StudentCourseRepository,
    StudentDashboardRepository,
    StudentEnrollmentRepository,
    StudentMeetingRepository,
    StudentNotificationRepository,
    StudentPaymentRepository,
    StudentPDFRepository,
    StudentProfileRepository,
    StudentProgressRepository,
    StudentVideoRepository,
)
from app.modules.student.schemas import (
    UpdatePasswordRequest,
    UpdateProfileRequest,
)

logger = logging.getLogger(__name__)


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
    """Append an audit log record to the session.

    Args:
        db: The async SQLAlchemy session.
        actor: The student performing the action.
        action: Dot-notation action string.
        entity_type: Entity category.
        entity_id: Optional UUID of the affected resource.
        severity: AuditSeverity value.
        metadata: Optional extra context.
    """
    log = AuditLog(
        actor_id=actor.id,
        actor_role=actor.role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=severity,
        metadata_=metadata or {},
    )
    db.add(log)


# ===========================================================================
# DashboardService
# ===========================================================================


class DashboardService:
    """Aggregates all student dashboard sections in a single call."""

    def __init__(self, db: AsyncSession, redis: Redis, student: User) -> None:
        """Initialize DashboardService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            student: The authenticated student user.
        """
        self._db = db
        self._redis = redis
        self._student = student
        self._dash_repo = StudentDashboardRepository(db)
        self._course_repo = StudentCourseRepository(db)
        self._video_repo = StudentVideoRepository(db)
        self._meeting_repo = StudentMeetingRepository(db)
        self._notif_repo = StudentNotificationRepository(db)
        self._payment_repo = StudentPaymentRepository(db)
        self._att_repo = StudentAttendanceRepository(db)

    async def get_dashboard(self) -> dict[str, Any]:
        """Return the full dashboard payload.

        Returns:
            dict: All dashboard sections.
        """
        total_enrolled = await self._course_repo.count_enrolled(self._student.id)
        total_completed = await self._course_repo.count_completed(self._student.id)
        overall_progress = await self._dash_repo.get_overall_progress(self._student.id)
        continue_learning = await self._video_repo.get_continue_watching(
            self._student.id, limit=3
        )
        upcoming_meetings_raw = await self._meeting_repo.get_upcoming(
            self._student.id, limit=5
        )
        # Gate meet links
        upcoming_meetings = [
            {
                **m,
                "meet_link": m["meet_link"]
                if m["status"] in (MeetingStatus.SCHEDULED, MeetingStatus.LIVE)
                else None,
            }
            for m in upcoming_meetings_raw
        ]
        announcements = await self._dash_repo.get_recent_announcements(
            self._student.id, limit=5
        )
        notifications_raw, _ = await self._notif_repo.list_for_student(
            self._student.id, page=1, page_size=5, unread_only=False
        )
        notifications = [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "action_url": n.action_url,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "is_read": n.is_read,
                "read_at": n.read_at,
                "created_at": n.created_at,
            }
            for n in notifications_raw
        ]
        attendance_summary = await self._att_repo.get_summary(self._student.id)
        recent_payments, _ = await self._payment_repo.list_for_student(
            self._student.id, page=1, page_size=5
        )

        return {
            "welcome_name": self._student.full_name,
            "total_enrolled_courses": total_enrolled,
            "total_completed_courses": total_completed,
            "overall_progress_percentage": overall_progress,
            "continue_learning": continue_learning,
            "upcoming_meetings": upcoming_meetings,
            "recent_announcements": announcements,
            "recent_notifications": notifications,
            "attendance_summary": attendance_summary,
            "recent_payments": recent_payments,
        }


# ===========================================================================
# CourseService
# ===========================================================================


class CourseService:
    """Student-scoped course listing and detail."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize CourseService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentCourseRepository(db)
        self._enrollment_repo = StudentEnrollmentRepository(db)

    async def list_courses(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "enrolled_at",
        sort_order: str = "desc",
        only_in_progress: bool = False,
        only_completed: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated enrolled courses.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            search: Optional title search.
            status: Optional enrollment status filter.
            sort_by: Column to sort by.
            sort_order: 'asc' or 'desc'.
            only_in_progress: Return only in-progress courses.
            only_completed: Return only completed courses.

        Returns:
            tuple: (list of course dicts, total count).
        """
        return await self._repo.list_enrolled(
            self._student.id,
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            only_in_progress=only_in_progress,
            only_completed=only_completed,
        )

    async def list_explore(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated list of all published courses with is_enrolled flag."""
        return await self._repo.list_explore(
            self._student.id,
            page=page,
            page_size=page_size,
            search=search,
        )

    async def enroll(self, course_id: uuid.UUID) -> dict[str, Any]:
        """Enroll the authenticated student in a course."""
        res = await self._repo.enroll(self._student.id, course_id)
        _audit(
            self._db,
            self._student,
            "student.course.enrolled",
            "course",
            course_id,
            metadata={"status": res.get("status")},
        )
        return res

    async def get_course_detail(self, course_id: uuid.UUID) -> dict[str, Any]:
        """Return full course detail for an enrolled student.

        Args:
            course_id: The course UUID.

        Returns:
            dict: Course detail payload.

        Raises:
            EnrollmentNotFoundError: If student is not enrolled.
        """
        data = await self._repo.get_course_detail(self._student.id, course_id)
        if data is None:
            raise EnrollmentNotFoundError()
        _audit(
            self._db,
            self._student,
            "student.course.accessed",
            "course",
            course_id,
        )
        return data

    async def get_recently_viewed(self, limit: int = 5) -> list[dict[str, Any]]:
        """Return recently accessed courses.

        Args:
            limit: Maximum items.

        Returns:
            list[dict]: Recent course data.
        """
        return await self._repo.get_recently_viewed(self._student.id, limit=limit)

    async def get_course_progress(self, course_id: uuid.UUID) -> dict[str, Any]:
        """Return completion percentage and progress details for an enrolled course.

        Args:
            course_id: The course UUID.

        Returns:
            dict: Course progress details.
        """
        detail = await self._repo.get_course_detail(self._student.id, course_id)
        if detail is None:
            raise EnrollmentNotFoundError()
        return {
            "course_id": str(course_id),
            "progress_percent": float(detail.get("progress_percent") or 0.0),
            "completed_lectures": detail.get("completed_lectures") or 0,
            "total_lectures": detail.get("total_lectures") or 0,
            "is_completed": detail.get("is_completed") or False,
            "completed_at": detail.get("completed_at"),
            "lecture_progress": [],
        }


# ===========================================================================
# ResourceService
# ===========================================================================


class ResourceService:
    """Student-facing R2 signed URL generation for video + PDF access."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize ResourceService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._video_repo = StudentVideoRepository(db)
        self._pdf_repo = StudentPDFRepository(db)
        self._enrollment_repo = StudentEnrollmentRepository(db)

    async def _require_enrollment(self, course_id: uuid.UUID) -> None:
        """Raise EnrollmentNotFoundError if student is not actively enrolled.

        Args:
            course_id: The course UUID.

        Raises:
            EnrollmentNotFoundError: If student is not enrolled.
        """
        enrollment = await self._enrollment_repo.get_active_enrollment(
            self._student.id, course_id
        )
        if enrollment is None:
            raise EnrollmentNotFoundError()

    async def list_videos(
        self,
        course_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List all accessible videos for an enrolled student.

        Args:
            course_id: The course UUID.

        Returns:
            list[dict]: Video list with progress.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        await self._require_enrollment(course_id)
        return await self._video_repo.list_by_course(course_id, self._student.id)

    async def get_video_stream_url(
        self,
        course_id: uuid.UUID,
        video_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Generate a time-limited signed URL for video streaming.

        Args:
            course_id: The course UUID.
            video_id: The video UUID.

        Returns:
            dict: Signed URL + metadata.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
            ResourceNotFoundError: If video not found.
        """
        await self._require_enrollment(course_id)
        video = await self._video_repo.get_by_id(video_id, course_id)
        if video is None:
            raise ResourceNotFoundError()

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_DOWNLOAD

        signed_url = await r2.generate_presigned_download_url(
            video.r2_object_key,
            expiry_seconds=expiry,
        )

        # Load progress for resume position
        from app.modules.student.repository import StudentProgressRepository
        progress_repo = StudentProgressRepository(self._db)
        progress = await progress_repo.get_video_progress(self._student.id, video_id)

        _audit(
            self._db,
            self._student,
            "student.video.accessed",
            "video",
            video_id,
            metadata={"course_id": str(course_id)},
        )

        return {
            "video_id": video.id,
            "title": video.title,
            "signed_url": signed_url,
            "expires_in": expiry,
            "duration_seconds": video.duration_seconds,
            "watch_position_seconds": progress.watch_position_seconds if progress else 0,
            "is_completed": progress.is_completed if progress else False,
        }

    async def list_pdfs(
        self,
        course_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List all accessible PDFs for an enrolled student.

        Args:
            course_id: The course UUID.

        Returns:
            list[dict]: PDF list with progress.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        await self._require_enrollment(course_id)
        return await self._pdf_repo.list_by_course(course_id, self._student.id)

    async def get_pdf_access_url(
        self,
        course_id: uuid.UUID,
        pdf_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Generate a time-limited signed URL for PDF download/view.

        Args:
            course_id: The course UUID.
            pdf_id: The PDF UUID.

        Returns:
            dict: Signed URL + metadata.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
            ResourceNotFoundError: If PDF not found.
        """
        await self._require_enrollment(course_id)
        pdf = await self._pdf_repo.get_by_id(pdf_id, course_id)
        if pdf is None:
            raise ResourceNotFoundError()

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_DOWNLOAD

        signed_url = await r2.generate_presigned_download_url(
            pdf.r2_object_key,
            expiry_seconds=expiry,
        )

        _audit(
            self._db,
            self._student,
            "student.pdf.accessed",
            "pdf",
            pdf_id,
            metadata={"course_id": str(course_id)},
        )

        return {
            "pdf_id": pdf.id,
            "title": pdf.title,
            "signed_url": signed_url,
            "expires_in": expiry,
            "file_size_bytes": pdf.file_size_bytes,
            "page_count": pdf.page_count,
            "is_downloadable": pdf.is_downloadable,
        }


# ===========================================================================
# ProgressService
# ===========================================================================


class ProgressService:
    """Manages content progress tracking and course completion."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize ProgressService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._progress_repo = StudentProgressRepository(db)
        self._enrollment_repo = StudentEnrollmentRepository(db)
        self._video_repo = StudentVideoRepository(db)
        self._course_repo = StudentCourseRepository(db)

    async def _require_enrollment(self, course_id: uuid.UUID) -> None:
        """Raise EnrollmentNotFoundError if not actively enrolled.

        Args:
            course_id: The course UUID.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        enrollment = await self._enrollment_repo.get_active_enrollment(
            self._student.id, course_id
        )
        if enrollment is None:
            raise EnrollmentNotFoundError()

    async def update_video_progress(
        self,
        course_id: uuid.UUID,
        video_id: uuid.UUID,
        watch_position_seconds: int,
        watch_duration_seconds: int,
        is_completed: bool,
    ) -> dict[str, Any]:
        """Upsert video progress (heartbeat endpoint).

        Called every 30 seconds by the video player. After upsert,
        recomputes and persists the course completion percentage.

        Args:
            course_id: The course UUID.
            video_id: The video UUID.
            watch_position_seconds: Current playback position.
            watch_duration_seconds: Cumulative watch time.
            is_completed: True when the student marks the video done.

        Returns:
            dict: Updated progress record.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        await self._require_enrollment(course_id)

        progress = await self._progress_repo.upsert_video_progress(
            student_id=self._student.id,
            video_id=video_id,
            watch_position_seconds=watch_position_seconds,
            watch_duration_seconds=watch_duration_seconds,
            is_completed=is_completed,
        )

        await self._recompute_course_progress(course_id)

        return {
            "video_id": video_id,
            "watch_position_seconds": progress.watch_position_seconds,
            "watch_duration_seconds": progress.watch_duration_seconds,
            "is_completed": progress.is_completed,
            "completed_at": progress.completed_at,
            "last_accessed_at": progress.last_accessed_at,
        }

    async def update_pdf_progress(
        self,
        course_id: uuid.UUID,
        pdf_id: uuid.UUID,
        is_completed: bool,
    ) -> dict[str, Any]:
        """Upsert PDF progress.

        Args:
            course_id: The course UUID.
            pdf_id: The PDF UUID.
            is_completed: True when the student marks the PDF done.

        Returns:
            dict: Updated progress record.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        await self._require_enrollment(course_id)

        progress = await self._progress_repo.upsert_pdf_progress(
            student_id=self._student.id,
            pdf_id=pdf_id,
            is_completed=is_completed,
        )

        await self._recompute_course_progress(course_id)

        return {
            "pdf_id": pdf_id,
            "is_completed": progress.is_completed,
            "completed_at": progress.completed_at,
            "last_accessed_at": progress.last_accessed_at,
        }

    async def _recompute_course_progress(
        self,
        course_id: uuid.UUID,
    ) -> None:
        """Recompute and persist the course completion percentage.

        Fetches the course's total_lectures, counts completed items,
        and writes the result back to CourseEnrollment.progress_percentage.
        Marks completed_at if 100% reached.

        Args:
            course_id: The course UUID.
        """
        from sqlalchemy import select
        from app.models.course import Course

        course_row = await self._db.execute(
            select(
                Course.total_lectures,
            ).where(Course.id == course_id)
        )
        total_lectures = course_row.scalar_one_or_none() or 0
        if total_lectures == 0:
            return

        stats = await self._progress_repo.get_course_progress_stats(
            self._student.id, course_id
        )
        completed_lectures = stats["completed_lectures"]

        percentage = min(100.0, round(completed_lectures / total_lectures * 100, 2))
        completed_at = datetime.now(timezone.utc) if percentage >= 100.0 else None

        await self._enrollment_repo.update_progress_percentage(
            self._student.id, course_id, percentage, completed_at=completed_at
        )

    async def get_course_progress(
        self,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return aggregated progress summary for a course.

        Args:
            course_id: The course UUID.

        Returns:
            dict: Progress summary.

        Raises:
            EnrollmentNotFoundError: If not enrolled.
        """
        enrollment = await self._enrollment_repo.get_active_enrollment(
            self._student.id, course_id
        )
        if enrollment is None:
            raise EnrollmentNotFoundError()

        stats = await self._progress_repo.get_course_progress_stats(
            self._student.id, course_id
        )
        next_video = await self._progress_repo.get_next_video(
            self._student.id, course_id
        )

        return {
            "course_id": course_id,
            "enrollment_id": enrollment.id,
            "progress_percentage": float(enrollment.progress_percentage),
            "total_lectures": 0,  # Will be joined from Course in router
            "completed_lectures": stats["completed_lectures"],
            "total_watch_time_seconds": stats["total_watch_time_seconds"],
            "last_activity_at": stats["last_activity_at"],
            "completed_at": enrollment.completed_at,
            "next_video_id": next_video.id if next_video else None,
            "next_video_title": next_video.title if next_video else None,
        }


# ===========================================================================
# MeetingService
# ===========================================================================


class MeetingService:
    """Student-facing meeting access with meet link authorization gating.

    The Google Meet link is ONLY returned when:
    1. Student has an active enrollment in the course.
    2. Meeting status is SCHEDULED or LIVE.
    In all other cases, meet_link is set to None.
    """

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize MeetingService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentMeetingRepository(db)

    def _gate_meet_link(
        self,
        meeting_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Strip meet_link from meeting data unless meeting is SCHEDULED or LIVE.

        Args:
            meeting_data: Raw meeting dict from repository.

        Returns:
            dict: Meeting dict with meet_link gated.
        """
        status = str(meeting_data.get("status") or "").upper()
        if status not in ("SCHEDULED", "LIVE"):
            meeting_data = {**meeting_data, "meet_link": None}
        return meeting_data

    async def list_meetings(
        self,
        page: int,
        page_size: int,
        course_id: Optional[uuid.UUID] = None,
        upcoming_only: bool = False,
        history_only: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated meetings with meet link gating applied.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            course_id: Optional course filter.
            upcoming_only: Return only future meetings.
            history_only: Return only past meetings.

        Returns:
            tuple: (list of meeting dicts, total count).
        """
        meetings, total = await self._repo.list_for_student(
            self._student.id,
            page=page,
            page_size=page_size,
            course_id=course_id,
            upcoming_only=upcoming_only,
            history_only=history_only,
        )
        gated = [self._gate_meet_link(m) for m in meetings]
        return gated, total

    async def get_meeting_detail(
        self,
        meeting_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return full meeting detail with meet link gating.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            dict: Meeting detail dict.

        Raises:
            MeetingNotFoundError: If not found or student not enrolled.
        """
        meeting_data = await self._repo.get_by_id(meeting_id, self._student.id)
        if meeting_data is None:
            raise MeetingNotFoundError()

        gated = self._gate_meet_link(meeting_data)

        # Audit meeting access when meet link is being accessed
        if gated.get("meet_link"):
            _audit(
                self._db,
                self._student,
                "student.meeting.joined",
                "meeting",
                meeting_id,
                metadata={"course_id": str(meeting_data["course_id"])},
            )

        return gated


# ===========================================================================
# AttendanceService
# ===========================================================================


class AttendanceService:
    """Provides the student's own attendance records and statistics."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize AttendanceService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentAttendanceRepository(db)

    async def list_attendance(
        self,
        page: int,
        page_size: int,
        course_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated attendance records.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            course_id: Optional course filter.
            status: Optional attendance status filter.

        Returns:
            tuple: (list of attendance dicts, total count).
        """
        return await self._repo.list_for_student(
            self._student.id,
            page=page,
            page_size=page_size,
            course_id=course_id,
            status=status,
        )

    async def get_summary(
        self,
        course_id: Optional[uuid.UUID] = None,
    ) -> dict[str, Any]:
        """Return aggregate attendance stats.

        Args:
            course_id: Optional course filter.

        Returns:
            dict: Attendance stats.
        """
        return await self._repo.get_summary(self._student.id, course_id=course_id)


# ===========================================================================
# NotificationService
# ===========================================================================


class NotificationService:
    """Manages student notifications: read, mark, delete."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize NotificationService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentNotificationRepository(db)

    async def list_notifications(
        self,
        page: int,
        page_size: int,
        unread_only: bool = False,
        notification_type: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated notifications.

        Args:
            page: 1-indexed page.
            page_size: Items per page.
            unread_only: Return only unread.
            notification_type: Optional type filter.

        Returns:
            tuple: (list of notification dicts, total count).
        """
        notifications, total = await self._repo.list_for_student(
            self._student.id,
            page=page,
            page_size=page_size,
            unread_only=unread_only,
            notification_type=notification_type,
        )
        items = [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "action_url": n.action_url,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "is_read": n.is_read,
                "read_at": n.read_at,
                "created_at": n.created_at,
            }
            for n in notifications
        ]
        return items, total

    async def get_unread_count(self) -> int:
        """Return the count of unread notifications.

        Returns:
            int: Unread count.
        """
        return await self._repo.count_unread(self._student.id)

    async def mark_read(self, notification_id: uuid.UUID) -> None:
        """Mark a single notification as read.

        Args:
            notification_id: The notification UUID.

        Raises:
            ResourceNotFoundError: If notification not found or not owned.
        """
        notification = await self._repo.get_by_id(notification_id, self._student.id)
        if notification is None:
            raise ResourceNotFoundError()
        await self._repo.mark_read(notification)
        _audit(
            self._db,
            self._student,
            "student.notification.read",
            "notification",
            notification_id,
        )

    async def mark_all_read(self) -> int:
        """Mark all notifications as read.

        Returns:
            int: Number of notifications marked as read.
        """
        return await self._repo.mark_all_read(self._student.id)

    async def delete_notification(self, notification_id: uuid.UUID) -> None:
        """Delete a notification.

        Args:
            notification_id: The notification UUID.

        Raises:
            ResourceNotFoundError: If not found or not owned.
        """
        notification = await self._repo.get_by_id(notification_id, self._student.id)
        if notification is None:
            raise ResourceNotFoundError()
        await self._repo.delete(notification)


# ===========================================================================
# PaymentService
# ===========================================================================


class PaymentService:
    """Provides student access to their payment history."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize PaymentService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentPaymentRepository(db)

    async def list_payments(
        self,
        page: int,
        page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated payment records.

        Args:
            page: 1-indexed page.
            page_size: Items per page.

        Returns:
            tuple: (list of payment dicts, total count).
        """
        payments, total = await self._repo.list_for_student(
            self._student.id, page=page, page_size=page_size
        )
        _audit(
            self._db,
            self._student,
            "student.payment.viewed",
            "payment",
        )
        return payments, total

    async def get_payment_detail(
        self,
        payment_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return full payment detail.

        Args:
            payment_id: The payment UUID.

        Returns:
            dict: Payment detail.

        Raises:
            ResourceNotFoundError: If not found or not owned.
        """
        payment = await self._repo.get_by_id(payment_id, self._student.id)
        if payment is None:
            raise ResourceNotFoundError()
        return payment


# ===========================================================================
# ProfileService
# ===========================================================================


class ProfileService:
    """Manages the student's own profile data and avatar upload."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize ProfileService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = StudentProfileRepository(db)

    async def get_profile(self) -> dict[str, Any]:
        """Return the student's combined User + StudentProfile data.

        Returns:
            dict: Full student profile payload.
        """
        profile = await self._repo.get_profile(self._student.id)
        return {
            "user_id": self._student.id,
            "full_name": self._student.full_name,
            "email": self._student.email,
            "phone": self._student.phone,
            "avatar_r2_key": self._student.avatar_r2_key,
            "avatar_url": r2.get_public_url(self._student.avatar_r2_key),
            "is_email_verified": self._student.is_email_verified,
            "last_login_at": self._student.last_login_at,
            "created_at": self._student.created_at,
            "college": profile.college if profile else None,
            "graduation_year": profile.graduation_year if profile else None,
            "preferred_language": profile.preferred_language if profile else "en",
            "date_of_birth": profile.date_of_birth if profile else None,
            "total_courses_enrolled": profile.total_courses_enrolled if profile else 0,
            "total_courses_completed": profile.total_courses_completed if profile else 0,
        }

    async def update_profile(self, data: UpdateProfileRequest) -> dict[str, Any]:
        """Apply partial updates to the student's profile.

        Args:
            data: Validated update data.

        Returns:
            dict: Updated profile payload.
        """
        profile = await self._repo.get_profile(self._student.id)

        user_updates: dict[str, Any] = {}
        if data.full_name is not None:
            user_updates["full_name"] = data.full_name
        if data.phone is not None:
            user_updates["phone"] = data.phone
        if user_updates:
            await self._repo.update_user_fields(self._student, **user_updates)

        if profile is not None:
            profile_updates: dict[str, Any] = {}
            for field in ("college", "graduation_year", "preferred_language", "date_of_birth"):
                val = getattr(data, field)
                if val is not None:
                    profile_updates[field] = val
            if profile_updates:
                await self._repo.update_profile(profile, **profile_updates)

        _audit(
            self._db,
            self._student,
            "student.profile.updated",
            "user",
            self._student.id,
        )
        return await self.get_profile()

    async def get_avatar_presign_url(
        self,
        content_type: str,
        file_name: str,
    ) -> dict[str, Any]:
        """Generate a presigned R2 URL for avatar image upload.

        Args:
            content_type: MIME type of the image.
            file_name: Original file name.

        Returns:
            dict: {'upload_url', 'r2_key', 'expires_in'}.

        Raises:
            InvalidUploadTypeError: If MIME type is not an allowed image type.
        """
        if content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise InvalidUploadTypeError(message="Only image files are allowed for avatars.")

        ext = ext_from_mime(content_type)
        r2_key = make_avatar_key(self._student.id, ext)

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        upload_url = await r2.generate_presigned_upload_url(
            r2_key, content_type, expiry_seconds=expiry
        )
        await self._repo.update_user_fields(self._student, avatar_r2_key=r2_key)

        return {"upload_url": upload_url, "r2_key": r2_key, "expires_in": expiry}

    async def change_password(
        self,
        data: UpdatePasswordRequest,
    ) -> None:
        """Verify current password and set a new Argon2id hash.

        Args:
            data: Current + new password.

        Raises:
            PermissionDeniedError: If current password is incorrect.
        """
        from app.core.exceptions.errors import PermissionDeniedError
        from app.modules.auth.security import PasswordHasher

        hasher = PasswordHasher()
        if not hasher.verify(self._student.hashed_password, data.current_password):
            raise PermissionDeniedError(message="Current password is incorrect.")

        new_hash = hasher.hash(data.new_password)
        await self._repo.update_user_fields(self._student, hashed_password=new_hash)
        _audit(
            self._db,
            self._student,
            "student.password.changed",
            "user",
            self._student.id,
            severity=AuditSeverity.WARNING,
        )


# ===========================================================================
# SearchService
# ===========================================================================


class SearchService:
    """Cross-entity search scoped to the student's enrolled courses."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize SearchService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._enrollment_repo = StudentEnrollmentRepository(db)

    async def search(
        self,
        query: str,
        entity: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """Search across enrolled courses, videos, PDFs, and meetings.

        Results are strictly scoped to the student's enrolled courses.

        Args:
            query: The search query string.
            entity: Optional entity type filter.
            page: 1-indexed page.
            page_size: Items per page.

        Returns:
            dict: Search results grouped by entity type.
        """
        from sqlalchemy import select
        from app.models.course import Course, CourseEnrollment
        from app.models.video import Video
        from app.models.pdf import PDF
        from app.models.meeting import Meeting
        from app.models.enums import VideoProcessingStatus, UploadStatus

        enrolled_ids = await self._enrollment_repo.list_enrolled_course_ids(
            self._student.id
        )
        if not enrolled_ids:
            return {"query": query, "total": 0, "results": [], "by_type": {}}

        results: list[dict[str, Any]] = []
        like = f"%{query}%"

        if entity is None or entity == "course":
            rows = (
                await self._db.execute(
                    select(
                        Course.id,
                        Course.title,
                        Course.short_description.label("description"),
                        Course.thumbnail_r2_key,
                    )
                    .where(
                        Course.id.in_(enrolled_ids),
                        Course.deleted_at.is_(None),
                        or_(Course.title.ilike(like), Course.short_description.ilike(like)),
                    )
                    .limit(page_size)
                )
            ).all()
            results.extend(
                {
                    "entity_type": "course",
                    "entity_id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "course_id": r.id,
                    "course_title": r.title,
                    "thumbnail_r2_key": r.thumbnail_r2_key,
                    "score": 1.0,
                }
                for r in rows
            )

        if entity is None or entity == "video":
            rows = (
                await self._db.execute(
                    select(
                        Video.id,
                        Video.title,
                        Video.description,
                        Video.course_id,
                        Course.title.label("course_title"),
                    )
                    .join(Course, Course.id == Video.course_id)
                    .where(
                        Video.course_id.in_(enrolled_ids),
                        Video.deleted_at.is_(None),
                        Video.processing_status.in_(
                            [VideoProcessingStatus.READY, VideoProcessingStatus.PUBLISHED]
                        ),
                        or_(Video.title.ilike(like), Video.description.ilike(like)),
                    )
                    .limit(page_size)
                )
            ).all()
            results.extend(
                {
                    "entity_type": "video",
                    "entity_id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "course_id": r.course_id,
                    "course_title": r.course_title,
                    "thumbnail_r2_key": None,
                    "score": 1.0,
                }
                for r in rows
            )

        if entity is None or entity == "pdf":
            rows = (
                await self._db.execute(
                    select(
                        PDF.id,
                        PDF.title,
                        PDF.description,
                        PDF.course_id,
                        Course.title.label("course_title"),
                    )
                    .join(Course, Course.id == PDF.course_id)
                    .where(
                        PDF.course_id.in_(enrolled_ids),
                        PDF.deleted_at.is_(None),
                        PDF.upload_status == UploadStatus.COMPLETED,
                        or_(PDF.title.ilike(like), PDF.description.ilike(like)),
                    )
                    .limit(page_size)
                )
            ).all()
            results.extend(
                {
                    "entity_type": "pdf",
                    "entity_id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "course_id": r.course_id,
                    "course_title": r.course_title,
                    "thumbnail_r2_key": None,
                    "score": 1.0,
                }
                for r in rows
            )

        if entity is None or entity == "meeting":
            rows = (
                await self._db.execute(
                    select(
                        Meeting.id,
                        Meeting.title,
                        Meeting.description,
                        Meeting.course_id,
                        Course.title.label("course_title"),
                    )
                    .join(Course, Course.id == Meeting.course_id)
                    .where(
                        Meeting.course_id.in_(enrolled_ids),
                        Meeting.deleted_at.is_(None),
                        or_(Meeting.title.ilike(like), Meeting.description.ilike(like)),
                    )
                    .limit(page_size)
                )
            ).all()
            results.extend(
                {
                    "entity_type": "meeting",
                    "entity_id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "course_id": r.course_id,
                    "course_title": r.course_title,
                    "thumbnail_r2_key": None,
                    "score": 1.0,
                }
                for r in rows
            )

        # Paginate
        total = len(results)
        start = (page - 1) * page_size
        paginated = results[start : start + page_size]

        by_type: dict[str, int] = {}
        for r in results:
            et = r["entity_type"]
            by_type[et] = by_type.get(et, 0) + 1

        return {
            "query": query,
            "total": total,
            "results": paginated,
            "by_type": by_type,
        }
