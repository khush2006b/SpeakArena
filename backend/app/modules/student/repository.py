"""Student module — repository layer.

All database access for the student portal lives here.
Every query is scoped to the authenticated student_id.
Content access (videos, PDFs, meetings) is additionally gated by
an active enrollment record to prevent unauthorized access.

Repositories:
    StudentEnrollmentRepository   Enrollment lookup and authorization gate.
    StudentCourseRepository       Enrolled course listing, search, favorites.
    StudentVideoRepository        Videos scoped to enrolled courses.
    StudentPDFRepository          PDFs scoped to enrolled courses.
    StudentProgressRepository     ContentProgress upsert and read.
    StudentMeetingRepository      Meetings scoped to enrolled courses.
    StudentAttendanceRepository   Attendance records for the student.
    StudentNotificationRepository Notification CRUD for the student.
    StudentPaymentRepository      Payment records for the student.
    StudentProfileRepository      StudentProfile and User field updates.
    StudentDashboardRepository    Aggregated dashboard queries.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions.errors import ValidationError
from app.models.chat import ChatRoom, Message
from app.models.course import (
    ContentProgress,
    Course,
    CourseEnrollment,
)
from app.models.enums import (
    CourseStatus,
    EnrollmentStatus,
    MeetingStatus,
    PaymentStatus,
    UploadStatus,
    VideoProcessingStatus,
)
from app.models.meeting import Meeting, SessionAttendance
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.pdf import PDF
from app.models.user import StudentProfile, TeacherProfile, User
from app.models.video import Video


# ===========================================================================
# StudentEnrollmentRepository
# ===========================================================================


class StudentEnrollmentRepository:
    """Authorization gate: verifies a student is actively enrolled in a course.

    All resource repositories call ``get_active_enrollment`` before
    returning any content.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_active_enrollment(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[CourseEnrollment]:
        """Return the active enrollment record or None.

        An enrollment is considered active when:
        - status == 'active'
        - expires_at is NULL (lifetime) or expires_at > NOW()

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            CourseEnrollment | None: The enrollment, or None if not enrolled/suspended.
        """
        now = datetime.now(timezone.utc)
        result = await self._db.execute(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                or_(
                    CourseEnrollment.expires_at.is_(None),
                    CourseEnrollment.expires_at > now,
                ),
            )
        )
        return result.scalar_one_or_none()

    async def get_enrollment(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[CourseEnrollment]:
        """Fetch any enrollment record regardless of status.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            CourseEnrollment | None: The enrollment or None.
        """
        result = await self._db.execute(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_enrolled_course_ids(self, student_id: uuid.UUID) -> list[uuid.UUID]:
        """Return all course IDs the student is actively enrolled in.

        Used by search and cross-entity queries to scope results.

        Args:
            student_id: The student UUID.

        Returns:
            list[uuid.UUID]: Enrolled course UUIDs.
        """
        result = await self._db.execute(
            select(CourseEnrollment.course_id).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        return list(result.scalars().all())

    async def update_progress_percentage(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        progress_percentage: float,
        completed_at: Optional[datetime] = None,
    ) -> None:
        """Update the denormalized progress_percentage on the enrollment.

        Called by ProgressService after every content completion event.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.
            progress_percentage: New completion percentage (0–100).
            completed_at: Set when the course is 100% complete.
        """
        values: dict[str, Any] = {"progress_percentage": progress_percentage}
        if completed_at is not None:
            values["completed_at"] = completed_at

        await self._db.execute(
            update(CourseEnrollment)
            .where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
            )
            .values(**values)
        )
        await self._db.flush()


# ===========================================================================
# StudentCourseRepository
# ===========================================================================


class StudentCourseRepository:
    """Repository for enrolled course listing, search, and detail."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_enrolled(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "enrolled_at",
        sort_order: str = "desc",
        only_in_progress: bool = False,
        only_completed: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated enrolled courses with progress and teacher info.

        Args:
            student_id: Filter to this student's enrollments.
            page: 1-indexed page number.
            page_size: Items per page.
            search: Optional course title search.
            status: Optional enrollment status filter.
            sort_by: Column to sort by.
            sort_order: 'asc' or 'desc'.
            only_in_progress: Return only courses with 0 < progress < 100.
            only_completed: Return only completed courses.

        Returns:
            tuple: (list of course dict rows, total count).
        """
        conditions = [
            CourseEnrollment.student_id == student_id,
            Course.deleted_at.is_(None),
        ]

        if status:
            conditions.append(CourseEnrollment.status == status)
        if search:
            conditions.append(Course.title.ilike(f"%{search}%"))
        if only_in_progress:
            conditions.append(CourseEnrollment.progress_percentage > 0)
            conditions.append(CourseEnrollment.completed_at.is_(None))
        if only_completed:
            conditions.append(CourseEnrollment.completed_at.is_not(None))

        # last_accessed: most recent ContentProgress record
        last_accessed_sub = (
            select(func.max(ContentProgress.last_accessed_at))
            .where(ContentProgress.student_id == student_id)
            .correlate_except(ContentProgress)
            .scalar_subquery()
        )

        base_stmt = (
            select(
                CourseEnrollment.id.label("enrollment_id"),
                Course.id.label("course_id"),
                Course.teacher_id.label("teacher_id"),
                Course.title.label("title"),
                Course.slug.label("slug"),
                Course.thumbnail_r2_key,
                Course.level,
                Course.language,
                Course.total_lectures,
                Course.total_duration_seconds,
                User.full_name.label("teacher_name"),
                User.avatar_r2_key.label("teacher_avatar_r2_key"),
                CourseEnrollment.progress_percentage,
                CourseEnrollment.status.label("enrollment_status"),
                CourseEnrollment.enrolled_at,
                CourseEnrollment.completed_at,
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .join(User, User.id == Course.teacher_id)
            .where(and_(*conditions))
        )

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        sort_col_map = {
            "enrolled_at": CourseEnrollment.enrolled_at,
            "progress": CourseEnrollment.progress_percentage,
            "title": Course.title,
            "completed_at": CourseEnrollment.completed_at,
        }
        sort_col = sort_col_map.get(sort_by, CourseEnrollment.enrolled_at)
        order = desc(sort_col) if sort_order == "desc" else sort_col

        data_stmt = (
            base_stmt.order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()

        items = [
            {
                "enrollment_id": r.enrollment_id,
                "course_id": r.course_id,
                "teacher_id": str(r.teacher_id) if r.teacher_id else None,
                "title": r.title,
                "slug": r.slug,
                "thumbnail_r2_key": r.thumbnail_r2_key,
                "level": r.level,
                "language": r.language,
                "total_lectures": r.total_lectures,
                "total_duration_seconds": r.total_duration_seconds,
                "teacher_name": r.teacher_name,
                "teacher_avatar_r2_key": r.teacher_avatar_r2_key,
                "progress_percentage": float(r.progress_percentage or 0.0),
                "enrollment_status": r.enrollment_status,
                "enrolled_at": r.enrolled_at,
                "completed_at": r.completed_at,
                "last_accessed_at": None,
                "is_favorite": False,
            }
            for r in rows
        ]
        return items, total

    async def list_explore(
        self,
        student_id: Optional[uuid.UUID] = None,
        *,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated list of all published courses with is_enrolled flag.

        When ``student_id`` is None (anonymous or non-student caller), the
        ``is_enrolled`` field is always False.
        """
        if student_id is not None:
            enrolled_stmt = select(CourseEnrollment.course_id).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            enrolled_res = await self._db.execute(enrolled_stmt)
            enrolled_ids = set(enrolled_res.scalars().all())
        else:
            enrolled_ids: set = set()

        conditions = [
            or_(Course.status == CourseStatus.PUBLISHED, Course.status == "published"),
            Course.deleted_at.is_(None),
        ]
        if search:
            conditions.append(Course.title.ilike(f"%{search}%"))

        count_stmt = select(func.count(Course.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Course, User.full_name.label("teacher_name"))
            .join(User, User.id == Course.teacher_id)
            .options(selectinload(Course.enrollments))
            .where(and_(*conditions))
            .order_by(Course.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()

        items = []
        for r in rows:
            c: Course = r[0]
            teacher_name: str = r[1] or "Instructor"
            active_enrolled_count = len([e for e in (c.enrollments or []) if e.status == EnrollmentStatus.ACTIVE]) if c.enrollments is not None else (c.total_enrollments or 0)
            items.append({
                "id": str(c.id),
                "course_id": str(c.id),
                "title": c.title,
                "slug": c.slug,
                "description": c.description,
                "short_description": c.short_description,
                "thumbnail_r2_key": c.thumbnail_r2_key,
                "price": float(c.price),
                "level": c.level,
                "language": c.language,
                "total_lectures": c.total_lectures,
                "total_enrollments": active_enrolled_count,
                "max_students": c.max_students,
                "teacher_name": teacher_name,
                "is_enrolled": c.id in enrolled_ids,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        return items, total

    async def enroll(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Enroll student in a course."""
        course_stmt = select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
        course = (await self._db.execute(course_stmt)).scalar_one_or_none()
        if course is None:
            raise ValueError("Course not found")

        # Check existing enrollment
        existing_stmt = select(CourseEnrollment).where(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.course_id == course_id,
        )
        existing = (await self._db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            if existing.status != EnrollmentStatus.ACTIVE:
                # Count current active enrollments before reactivating
                count_stmt = select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.course_id == course_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
                active_count = (await self._db.execute(count_stmt)).scalar_one() or 0
                if course.max_students and active_count >= course.max_students:
                    raise ValidationError(message=f"Course is full. Maximum enrollment limit of {course.max_students} seats has been reached.")

                existing.status = EnrollmentStatus.ACTIVE
                course.total_enrollments = active_count + 1
                await self._db.flush()
            return {"course_id": str(course_id), "status": "active", "is_enrolled": True, "message": "Already enrolled"}

        # Count current active enrollments before new enrollment
        count_stmt = select(func.count(CourseEnrollment.id)).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        active_count = (await self._db.execute(count_stmt)).scalar_one() or 0
        if course.max_students and active_count >= course.max_students:
            raise ValidationError(message=f"Course is full. Maximum enrollment limit of {course.max_students} seats has been reached.")

        enrollment = CourseEnrollment(
            student_id=student_id,
            course_id=course_id,
            status=EnrollmentStatus.ACTIVE,
            progress_percentage=0.0,
            enrolled_at=datetime.now(timezone.utc),
        )
        self._db.add(enrollment)
        course.total_enrollments = active_count + 1
        await self._db.flush()

        return {"course_id": str(course_id), "status": "active", "is_enrolled": True, "message": "Successfully enrolled!"}

    async def get_course_detail(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[dict[str, Any]]:
        """Return full course detail for an enrolled student.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            dict | None: Course detail with teacher and enrollment info.
        """
        result = await self._db.execute(
            select(
                CourseEnrollment.id.label("enrollment_id"),
                CourseEnrollment.status.label("enrollment_status"),
                CourseEnrollment.progress_percentage,
                CourseEnrollment.enrolled_at,
                CourseEnrollment.completed_at,
                Course.id.label("course_id"),
                Course.title,
                Course.slug,
                Course.description,
                Course.short_description,
                Course.thumbnail_r2_key,
                Course.level,
                Course.language,
                Course.total_lectures,
                Course.total_duration_seconds,
                Course.total_enrollments,
                Course.is_certificate_enabled,
                User.id.label("teacher_user_id"),
                User.full_name.label("teacher_name"),
                User.avatar_r2_key.label("teacher_avatar_r2_key"),
                TeacherProfile.headline.label("teacher_headline"),
                TeacherProfile.bio.label("teacher_bio"),
                TeacherProfile.total_students.label("teacher_total_students"),
                TeacherProfile.total_courses.label("teacher_total_courses"),
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .join(User, User.id == Course.teacher_id)
            .outerjoin(TeacherProfile, TeacherProfile.user_id == User.id)
            .where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
                Course.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            return None

        return {
            "enrollment_id": row.enrollment_id,
            "enrollment_status": row.enrollment_status,
            "progress_percentage": float(row.progress_percentage or 0.0),
            "enrolled_at": row.enrolled_at,
            "completed_at": row.completed_at,
            "course_id": row.course_id,
            "title": row.title,
            "slug": row.slug,
            "description": row.description,
            "short_description": row.short_description,
            "thumbnail_r2_key": row.thumbnail_r2_key,
            "level": row.level,
            "language": row.language,
            "total_lectures": row.total_lectures,
            "total_duration_seconds": row.total_duration_seconds,
            "total_enrollments": row.total_enrollments,
            "is_certificate_enabled": row.is_certificate_enabled,
            "teacher": {
                "user_id": row.teacher_user_id,
                "full_name": row.teacher_name,
                "avatar_r2_key": row.teacher_avatar_r2_key,
                "headline": row.teacher_headline,
                "bio": row.teacher_bio,
                "total_students": row.teacher_total_students or 0,
                "total_courses": row.teacher_total_courses or 0,
            },
        }

    async def get_recently_viewed(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return courses the student recently accessed content from.

        Args:
            student_id: The student UUID.
            limit: Maximum results.

        Returns:
            list[dict]: Recently viewed course data.
        """
        stmt = (
            select(
                Course.id.label("course_id"),
                Course.title,
                Course.thumbnail_r2_key,
                CourseEnrollment.progress_percentage,
                func.max(ContentProgress.last_accessed_at).label("last_accessed_at"),
            )
            .join(ContentProgress, ContentProgress.student_id == student_id)
            .join(
                CourseEnrollment,
                and_(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == Course.id,
                ),
            )
            .where(Course.deleted_at.is_(None))
            .group_by(Course.id, Course.title, Course.thumbnail_r2_key, CourseEnrollment.progress_percentage)
            .order_by(desc(func.max(ContentProgress.last_accessed_at)))
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "course_id": r.course_id,
                "title": r.title,
                "thumbnail_r2_key": r.thumbnail_r2_key,
                "progress_percentage": float(r.progress_percentage),
                "last_accessed_at": r.last_accessed_at,
            }
            for r in rows
        ]

    async def count_enrolled(self, student_id: uuid.UUID) -> int:
        """Count total active enrollments for the student.

        Args:
            student_id: The student UUID.

        Returns:
            int: Active enrollment count.
        """
        return (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
            )
        ).scalar_one()

    async def count_completed(self, student_id: uuid.UUID) -> int:
        """Count completed courses for the student.

        Args:
            student_id: The student UUID.

        Returns:
            int: Completed course count.
        """
        return (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.completed_at.is_not(None),
                )
            )
        ).scalar_one()


# ===========================================================================
# StudentVideoRepository
# ===========================================================================


class StudentVideoRepository:
    """Repository for videos, scoped to enrolled courses only."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_by_course(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List all accessible videos for an enrolled student.

        Returns videos with progress injected from ContentProgress.
        Only READY/PUBLISHED videos are returned.

        Args:
            course_id: The course UUID.
            student_id: The student UUID (for progress injection).

        Returns:
            list[dict]: Video rows with progress data.
        """
        stmt = (
            select(
                Video.id,
                Video.title,
                Video.description,
                Video.section,
                Video.sort_order,
                Video.duration_seconds,
                Video.is_free_preview,
                Video.visibility,
                Video.processing_status,
                ContentProgress.is_completed,
                ContentProgress.watch_position_seconds,
                ContentProgress.last_accessed_at,
            )
            .outerjoin(
                ContentProgress,
                and_(
                    ContentProgress.video_id == Video.id,
                    ContentProgress.student_id == student_id,
                ),
            )
            .where(
                Video.course_id == course_id,
                Video.deleted_at.is_(None),
                Video.processing_status.in_(
                    [VideoProcessingStatus.READY, VideoProcessingStatus.PUBLISHED]
                ),
            )
            .order_by(Video.sort_order.asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "section": r.section,
                "sort_order": r.sort_order,
                "duration_seconds": r.duration_seconds,
                "is_free_preview": r.is_free_preview,
                "visibility": r.visibility,
                "processing_status": r.processing_status,
                "is_completed": r.is_completed or False,
                "watch_position_seconds": r.watch_position_seconds or 0,
                "last_accessed_at": r.last_accessed_at,
            }
            for r in rows
        ]

    async def get_by_id(
        self,
        video_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[Video]:
        """Fetch a single video by ID within an enrolled course.

        Args:
            video_id: The video UUID.
            course_id: The course UUID (enforces course membership).

        Returns:
            Video | None: The video or None.
        """
        return (
            await self._db.execute(
                select(Video).where(
                    Video.id == video_id,
                    Video.course_id == course_id,
                    Video.deleted_at.is_(None),
                    Video.processing_status.in_(
                        [VideoProcessingStatus.READY, VideoProcessingStatus.PUBLISHED]
                    ),
                )
            )
        ).scalar_one_or_none()

    async def get_continue_watching(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return most recently accessed in-progress videos.

        Args:
            student_id: The student UUID.
            limit: Maximum results.

        Returns:
            list[dict]: Continue-watching items.
        """
        stmt = (
            select(
                Video.id.label("video_id"),
                Video.title.label("video_title"),
                Video.duration_seconds,
                Video.course_id,
                Course.title.label("course_title"),
                Course.thumbnail_r2_key,
                ContentProgress.watch_position_seconds,
                ContentProgress.last_accessed_at,
                CourseEnrollment.progress_percentage,
            )
            .join(ContentProgress, ContentProgress.video_id == Video.id)
            .join(Course, Course.id == Video.course_id)
            .join(
                CourseEnrollment,
                and_(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == Video.course_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                ),
            )
            .where(
                ContentProgress.student_id == student_id,
                ContentProgress.is_completed.is_(False),
                ContentProgress.watch_position_seconds > 0,
                Video.deleted_at.is_(None),
            )
            .order_by(ContentProgress.last_accessed_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "course_id": r.course_id,
                "course_title": r.course_title,
                "thumbnail_r2_key": r.thumbnail_r2_key,
                "video_id": r.video_id,
                "video_title": r.video_title,
                "watch_position_seconds": r.watch_position_seconds or 0,
                "duration_seconds": r.duration_seconds,
                "progress_percentage": float(r.progress_percentage),
                "last_accessed_at": r.last_accessed_at,
            }
            for r in rows
        ]


# ===========================================================================
# StudentPDFRepository
# ===========================================================================


class StudentPDFRepository:
    """Repository for PDFs, scoped to enrolled courses only."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_by_course(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """List all accessible PDFs for an enrolled student.

        Args:
            course_id: The course UUID.
            student_id: The student UUID (for progress injection).

        Returns:
            list[dict]: PDF rows with completion status.
        """
        stmt = (
            select(
                PDF.id,
                PDF.title,
                PDF.description,
                PDF.section,
                PDF.sort_order,
                PDF.file_size_bytes,
                PDF.page_count,
                PDF.is_free_preview,
                PDF.is_downloadable,
                PDF.visibility,
                ContentProgress.is_completed,
                ContentProgress.last_accessed_at,
            )
            .outerjoin(
                ContentProgress,
                and_(
                    ContentProgress.pdf_id == PDF.id,
                    ContentProgress.student_id == student_id,
                ),
            )
            .where(
                PDF.course_id == course_id,
                PDF.deleted_at.is_(None),
                PDF.upload_status == UploadStatus.COMPLETED,
            )
            .order_by(PDF.sort_order.asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "section": r.section,
                "sort_order": r.sort_order,
                "file_size_bytes": r.file_size_bytes,
                "page_count": r.page_count,
                "is_free_preview": r.is_free_preview,
                "is_downloadable": r.is_downloadable,
                "visibility": r.visibility,
                "is_completed": r.is_completed or False,
                "last_accessed_at": r.last_accessed_at,
            }
            for r in rows
        ]

    async def get_by_id(
        self,
        pdf_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[PDF]:
        """Fetch a single PDF by ID within an enrolled course.

        Args:
            pdf_id: The PDF UUID.
            course_id: The course UUID.

        Returns:
            PDF | None: The PDF or None.
        """
        return (
            await self._db.execute(
                select(PDF).where(
                    PDF.id == pdf_id,
                    PDF.course_id == course_id,
                    PDF.deleted_at.is_(None),
                    PDF.upload_status == UploadStatus.COMPLETED,
                )
            )
        ).scalar_one_or_none()


# ===========================================================================
# StudentProgressRepository
# ===========================================================================


class StudentProgressRepository:
    """Repository for ContentProgress upsert and read operations."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_video_progress(
        self,
        student_id: uuid.UUID,
        video_id: uuid.UUID,
    ) -> Optional[ContentProgress]:
        """Fetch the progress record for a specific video.

        Args:
            student_id: The student UUID.
            video_id: The video UUID.

        Returns:
            ContentProgress | None: The progress record or None.
        """
        return (
            await self._db.execute(
                select(ContentProgress).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.video_id == video_id,
                )
            )
        ).scalar_one_or_none()

    async def get_pdf_progress(
        self,
        student_id: uuid.UUID,
        pdf_id: uuid.UUID,
    ) -> Optional[ContentProgress]:
        """Fetch the progress record for a specific PDF.

        Args:
            student_id: The student UUID.
            pdf_id: The PDF UUID.

        Returns:
            ContentProgress | None: The progress record or None.
        """
        return (
            await self._db.execute(
                select(ContentProgress).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.pdf_id == pdf_id,
                )
            )
        ).scalar_one_or_none()

    async def upsert_video_progress(
        self,
        student_id: uuid.UUID,
        video_id: uuid.UUID,
        watch_position_seconds: int,
        watch_duration_seconds: int,
        is_completed: bool,
    ) -> ContentProgress:
        """Create or update the video progress record.

        Args:
            student_id: The student UUID.
            video_id: The video UUID.
            watch_position_seconds: Current playback position.
            watch_duration_seconds: Total seconds watched (cumulative).
            is_completed: Whether the student has completed this video.

        Returns:
            ContentProgress: The upserted record.
        """
        now = datetime.now(timezone.utc)
        progress = await self.get_video_progress(student_id, video_id)

        if progress is None:
            progress = ContentProgress(
                student_id=student_id,
                video_id=video_id,
                watch_position_seconds=watch_position_seconds,
                watch_duration_seconds=watch_duration_seconds,
                is_completed=is_completed,
                completed_at=now if is_completed else None,
                last_accessed_at=now,
            )
            self._db.add(progress)
        else:
            progress.watch_position_seconds = watch_position_seconds
            progress.watch_duration_seconds = max(
                progress.watch_duration_seconds, watch_duration_seconds
            )
            progress.last_accessed_at = now
            if is_completed and not progress.is_completed:
                progress.is_completed = True
                progress.completed_at = now

        await self._db.flush()
        return progress

    async def upsert_pdf_progress(
        self,
        student_id: uuid.UUID,
        pdf_id: uuid.UUID,
        is_completed: bool,
    ) -> ContentProgress:
        """Create or update the PDF progress record.

        Args:
            student_id: The student UUID.
            pdf_id: The PDF UUID.
            is_completed: Whether the student has completed this PDF.

        Returns:
            ContentProgress: The upserted record.
        """
        now = datetime.now(timezone.utc)
        progress = await self.get_pdf_progress(student_id, pdf_id)

        if progress is None:
            progress = ContentProgress(
                student_id=student_id,
                pdf_id=pdf_id,
                is_completed=is_completed,
                completed_at=now if is_completed else None,
                last_accessed_at=now,
            )
            self._db.add(progress)
        else:
            progress.last_accessed_at = now
            if is_completed and not progress.is_completed:
                progress.is_completed = True
                progress.completed_at = now

        await self._db.flush()
        return progress

    async def get_course_progress_stats(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return aggregated progress stats for a student in a course.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            dict: Progress stats including completion counts and watch time.
        """
        # Count completed videos
        completed_videos = (
            await self._db.execute(
                select(func.count(ContentProgress.id)).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.video_id.in_(
                        select(Video.id).where(
                            Video.course_id == course_id,
                            Video.deleted_at.is_(None),
                        )
                    ),
                    ContentProgress.is_completed.is_(True),
                )
            )
        ).scalar_one()

        # Count completed PDFs
        completed_pdfs = (
            await self._db.execute(
                select(func.count(ContentProgress.id)).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.pdf_id.in_(
                        select(PDF.id).where(
                            PDF.course_id == course_id,
                            PDF.deleted_at.is_(None),
                        )
                    ),
                    ContentProgress.is_completed.is_(True),
                )
            )
        ).scalar_one()

        # Total watch time for this course
        total_watch_time = (
            await self._db.execute(
                select(
                    func.coalesce(func.sum(ContentProgress.watch_duration_seconds), 0)
                ).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.video_id.in_(
                        select(Video.id).where(Video.course_id == course_id)
                    ),
                )
            )
        ).scalar_one()

        # Last activity
        last_activity = (
            await self._db.execute(
                select(func.max(ContentProgress.last_accessed_at)).where(
                    ContentProgress.student_id == student_id,
                    or_(
                        ContentProgress.video_id.in_(
                            select(Video.id).where(Video.course_id == course_id)
                        ),
                        ContentProgress.pdf_id.in_(
                            select(PDF.id).where(PDF.course_id == course_id)
                        ),
                    ),
                )
            )
        ).scalar_one()

        return {
            "completed_videos": completed_videos,
            "completed_pdfs": completed_pdfs,
            "completed_lectures": completed_videos + completed_pdfs,
            "total_watch_time_seconds": int(total_watch_time),
            "last_activity_at": last_activity,
        }

    async def get_next_video(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[Video]:
        """Return the first incomplete video in a course (for continue watching).

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            Video | None: The next video to watch.
        """
        completed_ids_stmt = select(ContentProgress.video_id).where(
            ContentProgress.student_id == student_id,
            ContentProgress.video_id.is_not(None),
            ContentProgress.is_completed.is_(True),
        )
        stmt = (
            select(Video)
            .where(
                Video.course_id == course_id,
                Video.deleted_at.is_(None),
                Video.processing_status.in_(
                    [VideoProcessingStatus.READY, VideoProcessingStatus.PUBLISHED]
                ),
                Video.id.not_in(completed_ids_stmt),
            )
            .order_by(Video.sort_order.asc())
            .limit(1)
        )
        return (await self._db.execute(stmt)).scalar_one_or_none()


# ===========================================================================
# StudentMeetingRepository
# ===========================================================================


class StudentMeetingRepository:
    """Repository for meetings, scoped to the student's enrolled courses."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        course_id: Optional[uuid.UUID] = None,
        upcoming_only: bool = False,
        history_only: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        """List meetings for the student's enrolled courses.

        Args:
            student_id: The student UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            course_id: Optional filter to a single course.
            upcoming_only: Return only future meetings.
            history_only: Return only past meetings.

        Returns:
            tuple: (list of meeting dicts, total count).
        """
        now = datetime.now(timezone.utc)
        enrolled_courses = (
            select(CourseEnrollment.course_id)
            .where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .scalar_subquery()
        )

        conditions = [
            Meeting.course_id.in_(select(CourseEnrollment.course_id).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )),
            Meeting.deleted_at.is_(None),
        ]

        if course_id:
            conditions.append(Meeting.course_id == course_id)
        if upcoming_only:
            conditions.append(Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.LIVE]))
        if history_only:
            conditions.append(Meeting.status.in_([MeetingStatus.COMPLETED, MeetingStatus.ENDED]))

        count_stmt = select(func.count(Meeting.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(
                Meeting.id,
                Meeting.course_id,
                Course.title.label("course_title"),
                Meeting.title,
                Meeting.status,
                Meeting.scheduled_at,
                Meeting.duration_minutes,
                Meeting.meeting_url.label("meet_link"),
                SessionAttendance.status.label("attendance_status"),
            )
            .join(Course, Course.id == Meeting.course_id)
            .outerjoin(
                SessionAttendance,
                and_(
                    SessionAttendance.meeting_id == Meeting.id,
                    SessionAttendance.student_id == student_id,
                ),
            )
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()
        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "title": r.title,
                "status": r.status,
                "scheduled_at": r.scheduled_at,
                "duration_minutes": r.duration_minutes,
                "provider": "google_meet",
                "meet_link": r.meet_link,  # Gated by service layer
                "attendance_status": r.attendance_status,
            }
            for r in rows
        ], total

    async def get_by_id(
        self,
        meeting_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> Optional[dict[str, Any]]:
        """Fetch a meeting only if the student is enrolled in its course.

        Args:
            meeting_id: The meeting UUID.
            student_id: The student UUID.

        Returns:
            dict | None: Meeting data dict or None.
        """
        result = await self._db.execute(
            select(
                Meeting.id,
                Meeting.course_id,
                Course.title.label("course_title"),
                Meeting.title,
                Meeting.description,
                Meeting.status,
                Meeting.scheduled_at,
                Meeting.duration_minutes,
                Meeting.provider,
                Meeting.meet_link,
                Meeting.max_participants,
                Meeting.recording_r2_key,
                Meeting.actual_started_at,
                Meeting.actual_ended_at,
                Meeting.reminder_sent,
                SessionAttendance.status.label("attendance_status"),
            )
            .join(Course, Course.id == Meeting.course_id)
            .join(
                CourseEnrollment,
                and_(
                    CourseEnrollment.course_id == Meeting.course_id,
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                ),
            )
            .outerjoin(
                SessionAttendance,
                and_(
                    SessionAttendance.meeting_id == Meeting.id,
                    SessionAttendance.student_id == student_id,
                ),
            )
            .where(
                Meeting.id == meeting_id,
                Meeting.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            return None
        return {
            "id": row.id,
            "course_id": row.course_id,
            "course_title": row.course_title,
            "title": row.title,
            "description": row.description,
            "status": row.status,
            "scheduled_at": row.scheduled_at,
            "duration_minutes": row.duration_minutes,
            "provider": row.provider,
            "meet_link": row.meet_link,  # Gated by service layer
            "max_participants": row.max_participants,
            "recording_r2_key": row.recording_r2_key,
            "actual_started_at": row.actual_started_at,
            "actual_ended_at": row.actual_ended_at,
            "reminder_sent": row.reminder_sent,
            "attendance_status": row.attendance_status,
        }

    async def get_upcoming(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return the next N upcoming meetings for the student.

        Args:
            student_id: The student UUID.
            limit: Maximum meetings to return.

        Returns:
            list[dict]: Upcoming meeting data.
        """
        now = datetime.now(timezone.utc)
        data_stmt = (
            select(
                Meeting.id,
                Meeting.course_id,
                Course.title.label("course_title"),
                Meeting.title,
                Meeting.status,
                Meeting.scheduled_at,
                Meeting.duration_minutes,
                Meeting.provider,
                Meeting.meet_link,
            )
            .join(Course, Course.id == Meeting.course_id)
            .join(
                CourseEnrollment,
                and_(
                    CourseEnrollment.course_id == Meeting.course_id,
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                ),
            )
            .where(
                Meeting.deleted_at.is_(None),
                Meeting.scheduled_at >= now,
                Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.LIVE]),
            )
            .order_by(Meeting.scheduled_at.asc())
            .limit(limit)
        )
        rows = (await self._db.execute(data_stmt)).all()
        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "title": r.title,
                "status": r.status,
                "scheduled_at": r.scheduled_at,
                "duration_minutes": r.duration_minutes,
                "provider": r.provider,
                "meet_link": r.meet_link,
                "attendance_status": None,
            }
            for r in rows
        ]


# ===========================================================================
# StudentAttendanceRepository
# ===========================================================================


class StudentAttendanceRepository:
    """Repository for the student's own attendance records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        course_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Paginated attendance records for the student.

        Args:
            student_id: The student UUID.
            page: 1-indexed page.
            page_size: Items per page.
            course_id: Optional course filter.
            status: Optional attendance status filter.

        Returns:
            tuple: (list of attendance dicts, total count).
        """
        conditions = [SessionAttendance.student_id == student_id]
        if course_id:
            conditions.append(Meeting.course_id == course_id)
        if status:
            conditions.append(SessionAttendance.status == status)

        count_stmt = (
            select(func.count(SessionAttendance.id))
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(and_(*conditions))
        )
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(
                SessionAttendance.id,
                Meeting.id.label("meeting_id"),
                Meeting.title.label("meeting_title"),
                Meeting.course_id,
                Course.title.label("course_title"),
                Meeting.scheduled_at,
                SessionAttendance.status,
                SessionAttendance.join_time,
                SessionAttendance.leave_time,
                SessionAttendance.total_duration_seconds,
                SessionAttendance.attendance_percentage,
                SessionAttendance.is_late,
            )
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .join(Course, Course.id == Meeting.course_id)
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()
        return [
            {
                "meeting_id": r.meeting_id,
                "meeting_title": r.meeting_title,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "scheduled_at": r.scheduled_at,
                "status": r.status,
                "join_time": r.join_time,
                "leave_time": r.leave_time,
                "total_duration_seconds": r.total_duration_seconds,
                "attendance_percentage": float(r.attendance_percentage) if r.attendance_percentage else 0.0,
                "is_late": r.is_late or False,
            }
            for r in rows
        ], total

    async def get_summary(
        self,
        student_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
    ) -> dict[str, Any]:
        """Return aggregate attendance stats.

        Args:
            student_id: The student UUID.
            course_id: Optional course filter.

        Returns:
            dict: Aggregate stats.
        """
        from sqlalchemy import case
        conditions = [SessionAttendance.student_id == student_id]
        if course_id:
            conditions.append(Meeting.course_id == course_id)

        stmt = (
            select(
                func.count(SessionAttendance.id).label("total"),
                func.sum(
                    case((SessionAttendance.status == "present", 1), else_=0)
                ).label("present"),
                func.sum(
                    case((SessionAttendance.status == "absent", 1), else_=0)
                ).label("absent"),
                func.sum(
                    case((SessionAttendance.status == "late", 1), else_=0)
                ).label("late"),
                func.coalesce(
                    func.avg(SessionAttendance.attendance_percentage), 0
                ).label("avg_pct"),
            )
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(and_(*conditions))
        )
        row = (await self._db.execute(stmt)).one_or_none()
        if row is None or (row.total or 0) == 0:
            return {
                "total_meetings": 0,
                "attended_meetings": 0,
                "absent_meetings": 0,
                "late_meetings": 0,
                "overall_attendance_percentage": 0.0,
                "by_course": [],
            }
        return {
            "total_meetings": row.total or 0,
            "attended_meetings": (row.present or 0) + (row.late or 0),
            "absent_meetings": row.absent or 0,
            "late_meetings": row.late or 0,
            "overall_attendance_percentage": round(float(row.avg_pct), 2),
            "by_course": [],
        }


# ===========================================================================
# StudentNotificationRepository
# ===========================================================================


class StudentNotificationRepository:
    """Repository for notification CRUD scoped to the student."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
        notification_type: Optional[str] = None,
    ) -> tuple[list[Notification], int]:
        """Paginated notifications for a student.

        Args:
            student_id: The student UUID.
            page: 1-indexed page.
            page_size: Items per page.
            unread_only: Return only unread.
            notification_type: Optional type filter.

        Returns:
            tuple: (list of Notification, total count).
        """
        conditions = [Notification.recipient_id == student_id]
        if unread_only:
            conditions.append(Notification.is_read.is_(False))
        if notification_type:
            conditions.append(Notification.type == notification_type)

        count_stmt = select(func.count(Notification.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Notification)
            .where(and_(*conditions))
            .order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        notifications = list((await self._db.execute(data_stmt)).scalars().all())
        return notifications, total

    async def count_unread(self, student_id: uuid.UUID) -> int:
        """Count unread notifications for the student.

        Args:
            student_id: The student UUID.

        Returns:
            int: Unread notification count.
        """
        return (
            await self._db.execute(
                select(func.count(Notification.id)).where(
                    Notification.recipient_id == student_id,
                    Notification.is_read.is_(False),
                )
            )
        ).scalar_one()

    async def get_by_id(
        self,
        notification_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> Optional[Notification]:
        """Fetch a notification owned by the student.

        Args:
            notification_id: The notification UUID.
            student_id: The student UUID.

        Returns:
            Notification | None: The notification or None.
        """
        return (
            await self._db.execute(
                select(Notification).where(
                    Notification.id == notification_id,
                    Notification.recipient_id == student_id,
                )
            )
        ).scalar_one_or_none()

    async def mark_read(self, notification: Notification) -> None:
        """Mark a single notification as read.

        Args:
            notification: The notification to mark as read.
        """
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            await self._db.flush()

    async def mark_all_read(self, student_id: uuid.UUID) -> int:
        """Mark all unread notifications for the student as read.

        Args:
            student_id: The student UUID.

        Returns:
            int: Number of notifications marked as read.
        """
        now = datetime.now(timezone.utc)
        result = await self._db.execute(
            update(Notification)
            .where(
                Notification.recipient_id == student_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        await self._db.flush()
        return result.rowcount  # type: ignore[return-value]

    async def delete(self, notification: Notification) -> None:
        """Delete a notification.

        Args:
            notification: The notification to delete.
        """
        await self._db.delete(notification)
        await self._db.flush()


# ===========================================================================
# StudentPaymentRepository
# ===========================================================================


class StudentPaymentRepository:
    """Repository for payment records scoped to the student."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """Paginated payment records for a student.

        Args:
            student_id: The student UUID.
            page: 1-indexed page.
            page_size: Items per page.

        Returns:
            tuple: (list of payment dicts, total count).
        """
        conditions = [Payment.student_id == student_id]

        count_stmt = select(func.count(Payment.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(
                Payment.id,
                Payment.course_id,
                Course.title.label("course_title"),
                Payment.amount,
                Payment.currency,
                Payment.status,
                Payment.razorpay_order_id,
                Payment.razorpay_payment_id,
                Payment.refund_status,
                Payment.paid_at,
                Payment.created_at,
            )
            .join(Course, Course.id == Payment.course_id)
            .where(and_(*conditions))
            .order_by(Payment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()
        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "amount": float(r.amount),
                "currency": r.currency,
                "status": r.status,
                "razorpay_order_id": r.razorpay_order_id,
                "razorpay_payment_id": r.razorpay_payment_id,
                "refund_status": r.refund_status,
                "paid_at": r.paid_at,
                "created_at": r.created_at,
            }
            for r in rows
        ], total

    async def get_by_id(
        self,
        payment_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> Optional[dict[str, Any]]:
        """Fetch a single payment owned by the student.

        Args:
            payment_id: The payment UUID.
            student_id: The student UUID.

        Returns:
            dict | None: Payment dict or None.
        """
        result = await self._db.execute(
            select(
                Payment.id,
                Payment.course_id,
                Course.title.label("course_title"),
                Payment.amount,
                Payment.currency,
                Payment.status,
                Payment.razorpay_order_id,
                Payment.razorpay_payment_id,
                Payment.razorpay_signature,
                Payment.refund_status,
                Payment.paid_at,
                Payment.created_at,
            )
            .join(Course, Course.id == Payment.course_id)
            .where(
                Payment.id == payment_id,
                Payment.student_id == student_id,
            )
        )
        row = result.one_or_none()
        if row is None:
            return None
        return {
            "id": row.id,
            "course_id": row.course_id,
            "course_title": row.course_title,
            "amount": float(row.amount),
            "currency": row.currency,
            "status": row.status,
            "razorpay_order_id": row.razorpay_order_id,
            "razorpay_payment_id": row.razorpay_payment_id,
            "razorpay_signature": row.razorpay_signature,
            "refund_status": row.refund_status,
            "paid_at": row.paid_at,
            "created_at": row.created_at,
        }

    async def get_recent(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return the most recent payments for the student.

        Args:
            student_id: The student UUID.
            limit: Maximum payments to return.

        Returns:
            list[dict]: Recent payment data.
        """
        items, _ = await self.list_for_student(student_id, page=1, page_size=limit)
        return items


# ===========================================================================
# StudentProfileRepository
# ===========================================================================


class StudentProfileRepository:
    """Repository for reading and updating the student's profile."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_profile(
        self,
        user_id: uuid.UUID,
    ) -> Optional[StudentProfile]:
        """Fetch the student's profile record.

        Args:
            user_id: The student's user UUID.

        Returns:
            StudentProfile | None: The profile or None.
        """
        return (
            await self._db.execute(
                select(StudentProfile).where(StudentProfile.user_id == user_id)
            )
        ).scalar_one_or_none()

    async def update_profile(
        self,
        profile: StudentProfile,
        **kwargs: Any,
    ) -> StudentProfile:
        """Apply partial updates to the student profile.

        Args:
            profile: The StudentProfile ORM instance.
            **kwargs: Column name → value updates.

        Returns:
            StudentProfile: The updated profile.
        """
        for key, value in kwargs.items():
            setattr(profile, key, value)
        await self._db.flush()
        return profile

    async def update_user_fields(
        self,
        user: User,
        **kwargs: Any,
    ) -> User:
        """Apply updates to User fields (full_name, phone, avatar_r2_key).

        Args:
            user: The User ORM instance.
            **kwargs: Column name → value updates.

        Returns:
            User: The updated user.
        """
        for key, value in kwargs.items():
            setattr(user, key, value)
        await self._db.flush()
        return user


# ===========================================================================
# StudentDashboardRepository
# ===========================================================================


class StudentDashboardRepository:
    """Repository for aggregated student dashboard queries."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_overall_progress(
        self,
        student_id: uuid.UUID,
    ) -> float:
        """Compute the student's average progress across all enrolled courses.

        Args:
            student_id: The student UUID.

        Returns:
            float: Average progress percentage (0–100).
        """
        result = (
            await self._db.execute(
                select(
                    func.coalesce(func.avg(CourseEnrollment.progress_percentage), 0)
                ).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
            )
        ).scalar_one()
        return round(float(result), 2)

    async def get_recent_announcements(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return recent pinned announcements from enrolled courses.

        Args:
            student_id: The student UUID.
            limit: Maximum announcements.

        Returns:
            list[dict]: Recent announcement data.
        """
        enrolled_course_ids = (
            select(CourseEnrollment.course_id).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        stmt = (
            select(
                Message.id,
                Message.content,
                Message.created_at,
                Message.is_pinned,
                Course.id.label("course_id"),
                Course.title.label("course_title"),
                User.full_name.label("sender_name"),
            )
            .join(ChatRoom, ChatRoom.id == Message.chat_room_id)
            .join(Course, Course.id == ChatRoom.course_id)
            .join(User, User.id == Message.sender_id)
            .where(
                ChatRoom.course_id.in_(enrolled_course_ids),
                Message.is_announcement.is_(True),
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "id": r.id,
                "content": r.content,
                "is_pinned": r.is_pinned,
                "created_at": r.created_at,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "sender_name": r.sender_name,
            }
            for r in rows
        ]
