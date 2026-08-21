"""Teacher module — repository layer.

All database access for the teacher portal lives here. Services call
repositories; routers never touch SQLAlchemy directly.

Each repository receives an ``AsyncSession`` at construction time and
exposes only async methods. No business logic — only I/O.

Repositories provided:
    CourseRepository          CRUD + pagination for courses.
    CourseCategoryRepository  Category assignment for a course.
    MeetingRepository         CRUD + filtering for meetings.
    VideoRepository           CRUD + reorder for video resources.
    PDFRepository             CRUD + reorder for PDF resources.
    AnnouncementRepository    Pinned / announcement messages in chat rooms.
    AttendanceRepository      Session attendance read access.
    AnalyticsRepository       Aggregated stats queries.
    StudentManagementRepository Enrolled student queries.
    TeacherProfileRepository  Teacher profile read/write.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import Select, and_, case, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.auth import UserSession
from app.models.chat import ChatRoom, Message
from app.models.course import (
    Category,
    ContentProgress,
    Course,
    CourseCategory,
    CourseEnrollment,
)
from app.models.enums import (
    CourseStatus,
    CourseVisibility,
    EnrollmentStatus,
    MeetingStatus,
    MessageContentType,
    PaymentStatus,
)
from app.models.meeting import Meeting, SessionAttendance
from app.models.payment import Payment
from app.models.pdf import PDF
from app.models.user import StudentProfile, TeacherProfile, User
from app.models.video import Video


# ===========================================================================
# CourseRepository
# ===========================================================================


class CourseRepository:
    """Repository for Course CRUD and teacher-scoped queries.

    All queries automatically filter ``deleted_at IS NULL`` unless
    a method name explicitly indicates it includes soft-deleted rows.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session for this request.
        """
        self._db = db

    async def create(self, **kwargs: Any) -> Course:
        """Create and persist a new course.

        Args:
            **kwargs: Column values for the new Course record.

        Returns:
            Course: The newly created and refreshed course instance.
        """
        course = Course(**kwargs)
        self._db.add(course)
        await self._db.flush()
        await self._db.refresh(course, ["course_categories"])
        return course

    async def get_by_id(
        self,
        course_id: uuid.UUID,
        teacher_id: Optional[uuid.UUID] = None,
    ) -> Optional[Course]:
        """Fetch a course by primary key, optionally scoped to a teacher.

        Args:
            course_id: The course UUID.
            teacher_id: If provided, also filters by teacher ownership.

        Returns:
            Course | None: The course, or None if not found.
        """
        stmt = (
            select(Course)
            .where(Course.id == course_id, Course.deleted_at.is_(None))
            .options(selectinload(Course.course_categories).selectinload(CourseCategory.category))
        )
        if teacher_id is not None:
            stmt = stmt.where(Course.teacher_id == teacher_id)

        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Course]:
        """Fetch an active course by slug.

        Args:
            slug: The unique course slug.

        Returns:
            Course | None: The course, or None if not found.
        """
        result = await self._db.execute(
            select(Course).where(Course.slug == slug, Course.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def slug_exists(self, slug: str, exclude_id: Optional[uuid.UUID] = None) -> bool:
        """Check if a slug is already taken.

        Args:
            slug: The slug to check.
            exclude_id: Exclude this course ID from the check (for updates).

        Returns:
            bool: True if the slug is already in use by another course.
        """
        stmt = select(Course.id).where(
            Course.slug == slug, Course.deleted_at.is_(None)
        )
        if exclude_id is not None:
            stmt = stmt.where(Course.id != exclude_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def list_by_teacher(
        self,
        teacher_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        visibility: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[Course], int]:
        """Paginated list of a teacher's courses.

        Args:
            teacher_id: Filter to this teacher's courses.
            page: 1-indexed page number.
            page_size: Items per page.
            status: Optional status filter.
            visibility: Optional visibility filter.
            search: Optional case-insensitive title search.
            sort_by: Column to sort by.
            sort_order: 'asc' or 'desc'.

        Returns:
            tuple: (list of Course objects, total count).
        """
        base = and_(
            Course.teacher_id == teacher_id,
            Course.deleted_at.is_(None),
        )
        conditions = [base]

        if status:
            conditions.append(Course.status == status)
        if visibility:
            conditions.append(Course.visibility == visibility)
        if search:
            conditions.append(Course.title.ilike(f"%{search}%"))

        # Count query
        count_stmt = select(func.count(Course.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        # Sort column
        sort_col = getattr(Course, sort_by, Course.created_at)
        order = desc(sort_col) if sort_order == "desc" else sort_col

        # Data query
        data_stmt = (
            select(Course)
            .where(and_(*conditions))
            .options(selectinload(Course.enrollments))
            .order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).scalars().all()
        return list(rows), total

    async def update(
        self,
        course: Course,
        **kwargs: Any,
    ) -> Course:
        """Apply partial updates to a course.

        Args:
            course: The course ORM instance to update.
            **kwargs: Column name → new value pairs.

        Returns:
            Course: The updated course instance.
        """
        for key, value in kwargs.items():
            setattr(course, key, value)
        await self._db.flush()
        return course

    async def soft_delete(self, course: Course) -> None:
        """Soft-delete a course by setting deleted_at.

        Args:
            course: The course to soft-delete.
        """
        course.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def count_by_teacher(
        self,
        teacher_id: uuid.UUID,
        status: Optional[str] = None,
    ) -> int:
        """Count a teacher's courses, optionally filtered by status.

        Args:
            teacher_id: The teacher's user UUID.
            status: Optional status filter.

        Returns:
            int: Number of matching courses.
        """
        stmt = select(func.count(Course.id)).where(
            Course.teacher_id == teacher_id,
            Course.deleted_at.is_(None),
        )
        if status:
            stmt = stmt.where(Course.status == status)
        return (await self._db.execute(stmt)).scalar_one()

    async def count_by_status(self, teacher_id: uuid.UUID) -> dict[str, int]:
        """Return course counts grouped by status for a teacher.

        Args:
            teacher_id: The teacher's user UUID.

        Returns:
            dict: Maps status string to count.
        """
        stmt = (
            select(Course.status, func.count(Course.id).label("cnt"))
            .where(Course.teacher_id == teacher_id, Course.deleted_at.is_(None))
            .group_by(Course.status)
        )
        rows = (await self._db.execute(stmt)).all()
        return {row.status: row.cnt for row in rows}


# ===========================================================================
# CourseCategoryRepository
# ===========================================================================


class CourseCategoryRepository:
    """Repository for managing course category assignments."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def set_categories(
        self,
        course_id: uuid.UUID,
        category_ids: list[uuid.UUID],
        primary_category_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Replace all category assignments for a course atomically.

        Deletes existing assignments first, then inserts the new set.
        If primary_category_id is not provided, the first category in the
        list is marked as primary.

        Args:
            course_id: The course UUID.
            category_ids: Ordered list of category UUIDs to assign.
            primary_category_id: The category to mark as primary.
        """
        # Delete existing assignments
        existing = await self._db.execute(
            select(CourseCategory).where(CourseCategory.course_id == course_id)
        )
        for cc in existing.scalars().all():
            await self._db.delete(cc)

        if not category_ids:
            return

        primary_id = primary_category_id or category_ids[0]

        for cat_id in category_ids:
            cc = CourseCategory(
                course_id=course_id,
                category_id=cat_id,
                is_primary=(cat_id == primary_id),
            )
            self._db.add(cc)

        await self._db.flush()

    async def get_all_categories(
        self,
        active_only: bool = True,
    ) -> list[Category]:
        """Return all platform categories for the category picker UI.

        Args:
            active_only: If True, only return active categories.

        Returns:
            list[Category]: Categories ordered by sort_order.
        """
        stmt = select(Category).order_by(Category.sort_order)
        if active_only:
            stmt = stmt.where(Category.is_active.is_(True))
        rows = (await self._db.execute(stmt)).scalars().all()
        return list(rows)

    async def category_ids_exist(self, ids: list[uuid.UUID]) -> bool:
        """Check all given category IDs exist in the database.

        Args:
            ids: List of category UUIDs to validate.

        Returns:
            bool: True if all IDs are valid active categories.
        """
        if not ids:
            return True
        count_stmt = select(func.count(Category.id)).where(
            Category.id.in_(ids), Category.is_active.is_(True)
        )
        count: int = (await self._db.execute(count_stmt)).scalar_one()
        return count == len(ids)


# ===========================================================================
# MeetingRepository
# ===========================================================================


class MeetingRepository:
    """Repository for Meeting CRUD and teacher-scoped queries."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(self, **kwargs: Any) -> Meeting:
        """Create and persist a new meeting.

        Args:
            **kwargs: Column values for the Meeting record.

        Returns:
            Meeting: The newly created meeting.
        """
        if "meet_link" in kwargs:
            kwargs["meeting_url"] = kwargs.pop("meet_link")
        valid_cols = {c.name for c in Meeting.__table__.columns}
        filtered_kwargs = {k: v for k, v in kwargs.items() if k in valid_cols}
        meeting = Meeting(**filtered_kwargs)
        self._db.add(meeting)
        await self._db.flush()
        await self._db.refresh(meeting)
        return meeting

    async def get_by_id(
        self,
        meeting_id: uuid.UUID,
        teacher_id: Optional[uuid.UUID] = None,
    ) -> Optional[Meeting]:
        """Fetch a meeting by primary key, optionally scoped to a teacher.

        Args:
            meeting_id: The meeting UUID.
            teacher_id: If provided, filters by teacher ownership.

        Returns:
            Meeting | None: The meeting, or None.
        """
        stmt = select(Meeting).where(
            Meeting.id == meeting_id, Meeting.deleted_at.is_(None)
        )
        if teacher_id is not None:
            stmt = stmt.where(Meeting.teacher_id == teacher_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_teacher(
        self,
        teacher_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        course_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        upcoming_only: bool = False,
    ) -> tuple[list[Meeting], int]:
        """Paginated list of a teacher's meetings.

        Args:
            teacher_id: Filter by teacher.
            page: 1-indexed page number.
            page_size: Items per page.
            course_id: Optional course filter.
            status: Optional status filter.
            upcoming_only: If True, only return future meetings.

        Returns:
            tuple: (list of Meeting, total count).
        """
        conditions = [Meeting.teacher_id == teacher_id]

        if course_id:
            conditions.append(Meeting.course_id == course_id)
        if status:
            conditions.append(Meeting.status == status)
        if upcoming_only:
            conditions.append(Meeting.scheduled_at > datetime.now(timezone.utc))

        count_stmt = select(func.count(Meeting.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Meeting)
            .options(joinedload(Meeting.course))
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).scalars().all()
        return list(rows), total

    async def get_upcoming(
        self,
        teacher_id: uuid.UUID,
        limit: int = 5,
    ) -> list[Meeting]:
        """Return the next N upcoming meetings for a teacher.

        Args:
            teacher_id: The teacher's user UUID.
            limit: Maximum meetings to return.

        Returns:
            list[Meeting]: Upcoming meetings ordered by scheduled_at.
        """
        now = datetime.now(timezone.utc)
        stmt = (
            select(Meeting)
            .where(
                Meeting.teacher_id == teacher_id,
                Meeting.scheduled_at > now,
                Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.LIVE]),
            )
            .order_by(Meeting.scheduled_at.asc())
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).scalars().all()
        return list(rows)

    async def get_today(self, teacher_id: uuid.UUID) -> list[Meeting]:
        """Return meetings scheduled for today (UTC) for a teacher.

        Args:
            teacher_id: The teacher's user UUID.

        Returns:
            list[Meeting]: Today's meetings ordered by scheduled_at.
        """
        from datetime import date
        today = date.today()
        start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
        end = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc)

        stmt = (
            select(Meeting)
            .where(
                Meeting.teacher_id == teacher_id,
                Meeting.scheduled_at.between(start, end),
            )
            .order_by(Meeting.scheduled_at.asc())
        )
        rows = (await self._db.execute(stmt)).scalars().all()
        return list(rows)

    async def update(self, meeting: Meeting, **kwargs: Any) -> Meeting:
        """Apply partial updates to a meeting.

        Args:
            meeting: The Meeting ORM instance.
            **kwargs: Column name → value updates.

        Returns:
            Meeting: The updated meeting.
        """
        if "meet_link" in kwargs:
            kwargs["meeting_url"] = kwargs.pop("meet_link")
        valid_cols = {c.name for c in Meeting.__table__.columns}
        for key, value in kwargs.items():
            if key in valid_cols or hasattr(meeting, key):
                setattr(meeting, key, value)
        await self._db.flush()
        return meeting

    async def soft_delete(self, meeting: Meeting) -> None:
        """Soft-delete a meeting.

        Args:
            meeting: The meeting to soft-delete.
        """
        meeting.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()


# ===========================================================================
# VideoRepository
# ===========================================================================


class VideoRepository:
    """Repository for Video resource CRUD and reordering."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(self, **kwargs: Any) -> Video:
        """Create a new video metadata record.

        Args:
            **kwargs: Video column values.

        Returns:
            Video: The newly created video.
        """
        video = Video(**kwargs)
        self._db.add(video)
        await self._db.flush()
        await self._db.refresh(video)
        return video

    async def get_by_id(
        self,
        video_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
    ) -> Optional[Video]:
        """Fetch a video by ID, optionally scoped to a course.

        Args:
            video_id: The video UUID.
            course_id: If provided, also filters by course.

        Returns:
            Video | None: The video, or None.
        """
        stmt = select(Video).where(Video.id == video_id, Video.deleted_at.is_(None))
        if course_id is not None:
            stmt = stmt.where(Video.course_id == course_id)
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def list_by_course(self, course_id: uuid.UUID) -> list[Video]:
        """List all active videos for a course, ordered by sort_order.

        Args:
            course_id: The course UUID.

        Returns:
            list[Video]: Videos in sort order.
        """
        stmt = (
            select(Video)
            .where(Video.course_id == course_id, Video.deleted_at.is_(None))
            .order_by(Video.sort_order.asc())
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def update(self, video: Video, **kwargs: Any) -> Video:
        """Apply partial updates to a video.

        Args:
            video: The Video ORM instance.
            **kwargs: Column name → value.

        Returns:
            Video: The updated video.
        """
        for key, value in kwargs.items():
            setattr(video, key, value)
        await self._db.flush()
        return video

    async def soft_delete(self, video: Video) -> None:
        """Soft-delete a video.

        Args:
            video: The video to soft-delete.
        """
        video.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def reorder(self, items: list[dict[str, Any]]) -> None:
        """Bulk-update sort_order for a list of video IDs.

        Args:
            items: List of {'id': UUID, 'sort_order': int} dicts.
        """
        for item in items:
            await self._db.execute(
                update(Video)
                .where(Video.id == item["id"])
                .values(sort_order=item["sort_order"])
            )
        await self._db.flush()

    async def count_by_course(self, course_id: uuid.UUID) -> int:
        """Count active videos for a course.

        Args:
            course_id: The course UUID.

        Returns:
            int: Number of active (non-deleted) videos.
        """
        stmt = select(func.count(Video.id)).where(
            Video.course_id == course_id, Video.deleted_at.is_(None)
        )
        return (await self._db.execute(stmt)).scalar_one()


# ===========================================================================
# PDFRepository
# ===========================================================================


class PDFRepository:
    """Repository for PDF resource CRUD and reordering."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(self, **kwargs: Any) -> PDF:
        """Create a new PDF metadata record.

        Args:
            **kwargs: PDF column values.

        Returns:
            PDF: The newly created PDF record.
        """
        pdf = PDF(**kwargs)
        self._db.add(pdf)
        await self._db.flush()
        await self._db.refresh(pdf)
        return pdf

    async def get_by_id(
        self,
        pdf_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
    ) -> Optional[PDF]:
        """Fetch a PDF by ID, optionally scoped to a course.

        Args:
            pdf_id: The PDF UUID.
            course_id: If provided, also filters by course.

        Returns:
            PDF | None: The PDF, or None.
        """
        stmt = select(PDF).where(PDF.id == pdf_id, PDF.deleted_at.is_(None))
        if course_id is not None:
            stmt = stmt.where(PDF.course_id == course_id)
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def list_by_course(self, course_id: uuid.UUID) -> list[PDF]:
        """List all active PDFs for a course, ordered by sort_order.

        Args:
            course_id: The course UUID.

        Returns:
            list[PDF]: PDFs in sort order.
        """
        stmt = (
            select(PDF)
            .where(PDF.course_id == course_id, PDF.deleted_at.is_(None))
            .order_by(PDF.sort_order.asc())
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def update(self, pdf: PDF, **kwargs: Any) -> PDF:
        """Apply partial updates to a PDF.

        Args:
            pdf: The PDF ORM instance.
            **kwargs: Column name → value.

        Returns:
            PDF: The updated PDF.
        """
        for key, value in kwargs.items():
            setattr(pdf, key, value)
        await self._db.flush()
        return pdf

    async def soft_delete(self, pdf: PDF) -> None:
        """Soft-delete a PDF.

        Args:
            pdf: The PDF to soft-delete.
        """
        pdf.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def reorder(self, items: list[dict[str, Any]]) -> None:
        """Bulk-update sort_order for a list of PDF IDs.

        Args:
            items: List of {'id': UUID, 'sort_order': int} dicts.
        """
        for item in items:
            await self._db.execute(
                update(PDF)
                .where(PDF.id == item["id"])
                .values(sort_order=item["sort_order"])
            )
        await self._db.flush()


# ===========================================================================
# AnnouncementRepository
# ===========================================================================


class AnnouncementRepository:
    """Repository for announcement messages (is_announcement=True messages).

    Announcements are stored as regular messages in the course chat room
    with ``is_announcement=True``. This avoids a separate table while
    still providing list / pin / delete semantics.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_chat_room_by_course(
        self,
        course_id: uuid.UUID,
    ) -> Optional[ChatRoom]:
        """Fetch the chat room for a course.

        Args:
            course_id: The course UUID.

        Returns:
            ChatRoom | None: The chat room, or None if not created yet.
        """
        result = await self._db.execute(
            select(ChatRoom).where(ChatRoom.course_id == course_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        chat_room_id: uuid.UUID,
        sender_id: uuid.UUID,
        content: str,
        is_pinned: bool = True,
    ) -> Message:
        """Create an announcement message in the given chat room.

        Args:
            chat_room_id: The chat room UUID.
            sender_id: Teacher's user UUID.
            content: Announcement text content.
            is_pinned: Whether to pin the announcement.

        Returns:
            Message: The created announcement message.
        """
        now = datetime.now(timezone.utc)
        msg = Message(
            chat_room_id=chat_room_id,
            sender_id=sender_id,
            content=content,
            content_type=MessageContentType.TEXT,
            is_announcement=True,
            is_pinned=is_pinned,
            pinned_at=now if is_pinned else None,
            pinned_by=sender_id if is_pinned else None,
        )
        self._db.add(msg)
        await self._db.flush()
        await self._db.refresh(msg)
        return msg

    async def get_by_id(
        self,
        message_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
    ) -> Optional[Message]:
        """Fetch an announcement by message ID.

        Args:
            message_id: The message UUID.
            course_id: Optional course scope for ownership validation.

        Returns:
            Message | None: The announcement message, or None.
        """
        stmt = (
            select(Message)
            .where(
                Message.id == message_id,
                Message.is_announcement.is_(True),
                Message.deleted_at.is_(None),
            )
        )
        if course_id is not None:
            stmt = stmt.join(ChatRoom, ChatRoom.id == Message.chat_room_id).where(
                ChatRoom.course_id == course_id
            )
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def list_by_course(
        self,
        course_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Message], int]:
        """List all announcements for a course (paginated, newest first).

        Args:
            course_id: The course UUID.
            page: 1-indexed page number.
            page_size: Items per page.

        Returns:
            tuple: (list of Message, total count).
        """
        subq = select(ChatRoom.id).where(ChatRoom.course_id == course_id).scalar_subquery()

        cond = and_(
            Message.chat_room_id.in_(select(ChatRoom.id).where(ChatRoom.course_id == course_id)),
            Message.is_announcement.is_(True),
            Message.deleted_at.is_(None),
        )

        total: int = (
            await self._db.execute(select(func.count(Message.id)).where(cond))
        ).scalar_one()

        data_stmt = (
            select(Message)
            .where(cond)
            .order_by(Message.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).scalars().all()
        return list(rows), total

    async def update(self, message: Message, **kwargs: Any) -> Message:
        """Apply partial updates to an announcement message.

        Args:
            message: The Message ORM instance.
            **kwargs: Column name → value.

        Returns:
            Message: The updated message.
        """
        for key, value in kwargs.items():
            setattr(message, key, value)
        await self._db.flush()
        return message

    async def delete(self, message: Message) -> None:
        """Soft-delete an announcement message.

        Args:
            message: The message to soft-delete.
        """
        message.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()


# ===========================================================================
# AttendanceRepository
# ===========================================================================


class AttendanceRepository:
    """Repository for reading session attendance records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_by_meeting(
        self,
        meeting_id: uuid.UUID,
    ) -> list[tuple[SessionAttendance, User]]:
        """Return all attendance records for a meeting, joined with student user.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            list: Tuples of (SessionAttendance, User).
        """
        stmt = (
            select(SessionAttendance, User)
            .join(User, User.id == SessionAttendance.student_id)
            .where(SessionAttendance.meeting_id == meeting_id)
            .order_by(User.full_name.asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [(r.SessionAttendance, r.User) for r in rows]

    async def get_by_student(
        self,
        student_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
        limit: int = 50,
    ) -> list[tuple[SessionAttendance, Meeting]]:
        """Return attendance records for a student, optionally scoped to a course.

        Args:
            student_id: The student UUID.
            course_id: Optional course filter.
            limit: Maximum records to return.

        Returns:
            list: Tuples of (SessionAttendance, Meeting).
        """
        stmt = (
            select(SessionAttendance, Meeting)
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(SessionAttendance.student_id == student_id)
        )
        if course_id:
            stmt = stmt.where(Meeting.course_id == course_id)

        stmt = stmt.order_by(Meeting.scheduled_at.desc()).limit(limit)
        rows = (await self._db.execute(stmt)).all()
        return [(r.SessionAttendance, r.Meeting) for r in rows]

    async def get_summary_for_teacher(
        self,
        teacher_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Compute aggregate attendance statistics for all teacher meetings.

        Args:
            teacher_id: The teacher's user UUID.

        Returns:
            dict: Aggregate attendance stats.
        """
        # Count meetings
        total_meetings = (
            await self._db.execute(
                select(func.count(Meeting.id)).where(
                    Meeting.teacher_id == teacher_id,
                    Meeting.deleted_at.is_(None),
                )
            )
        ).scalar_one()

        # Count attendance records
        stmt = (
            select(
                func.count(SessionAttendance.id).label("total"),
                func.sum(case((SessionAttendance.status == "present", 1), else_=0)).label(
                    "present"
                ),
                func.sum(case((SessionAttendance.status == "absent", 1), else_=0)).label(
                    "absent"
                ),
                func.sum(case((SessionAttendance.status == "late", 1), else_=0)).label("late"),
                func.avg(SessionAttendance.attendance_percentage).label("avg_pct"),
            )
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(Meeting.teacher_id == teacher_id)
        )
        row = (await self._db.execute(stmt)).one_or_none()

        if row is None or row.total == 0:
            return {
                "total_meetings": total_meetings,
                "total_records": 0,
                "present_count": 0,
                "absent_count": 0,
                "late_count": 0,
                "average_attendance_rate": 0.0,
            }

        return {
            "total_meetings": total_meetings,
            "total_records": row.total,
            "present_count": row.present or 0,
            "absent_count": row.absent or 0,
            "late_count": row.late or 0,
            "average_attendance_rate": round(float(row.avg_pct or 0), 2),
        }

    async def get_export_data(
        self,
        meeting_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Return raw attendance data for CSV export.

        Args:
            meeting_id: The meeting UUID.

        Returns:
            list[dict]: Rows suitable for CSV serialization.
        """
        rows = await self.list_by_meeting(meeting_id)
        result = []
        for att, user in rows:
            result.append(
                {
                    "student_name": user.full_name,
                    "student_email": user.email,
                    "status": att.status,
                    "join_time": att.join_time.isoformat() if att.join_time else "",
                    "leave_time": att.leave_time.isoformat() if att.leave_time else "",
                    "duration_seconds": att.total_duration_seconds,
                    "attendance_pct": float(att.attendance_percentage),
                    "is_late": att.is_late,
                }
            )
        return result


# ===========================================================================
# AnalyticsRepository
# ===========================================================================


class AnalyticsRepository:
    """Repository for aggregated analytics queries."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_revenue_stats(
        self,
        teacher_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return today's revenue, this month's revenue, and total revenue.

        Args:
            teacher_id: The teacher's user UUID.

        Returns:
            dict: Revenue stats with keys 'today', 'this_month', 'total'.
        """
        from datetime import date

        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        # All captured payments for teacher's courses
        base_stmt = (
            select(func.sum(Payment.amount).label("total"))
            .join(Course, Course.id == Payment.course_id)
            .where(
                Course.teacher_id == teacher_id,
                Payment.status == PaymentStatus.CAPTURED,
            )
        )

        total = (await self._db.execute(base_stmt)).scalar_one() or 0.0

        today_stmt = base_stmt.where(func.coalesce(Payment.captured_at, Payment.created_at) >= today_start)
        today = (await self._db.execute(today_stmt)).scalar_one() or 0.0

        month_stmt = base_stmt.where(func.coalesce(Payment.captured_at, Payment.created_at) >= month_start)
        this_month = (await self._db.execute(month_stmt)).scalar_one() or 0.0

        return {
            "today": round(float(today), 2),
            "this_month": round(float(this_month), 2),
            "total": round(float(total), 2),
            "currency": "INR",
        }

    async def get_revenue_series(
        self,
        teacher_id: uuid.UUID,
        since: datetime,
    ) -> list[dict[str, Any]]:
        """Return daily revenue aggregated as a time series.

        Args:
            teacher_id: The teacher's user UUID.
            since: Start of the time window.

        Returns:
            list[dict]: Daily revenue data points [{date, amount, currency}].
        """
        date_col = func.date(func.coalesce(Payment.captured_at, Payment.created_at))
        stmt = (
            select(
                date_col.label("date"),
                func.sum(Payment.amount).label("amount"),
            )
            .join(Course, Course.id == Payment.course_id)
            .where(
                Course.teacher_id == teacher_id,
                Payment.status == PaymentStatus.CAPTURED,
                func.coalesce(Payment.captured_at, Payment.created_at) >= since,
            )
            .group_by(date_col)
            .order_by(date_col.asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {"date": str(r.date), "amount": round(float(r.amount), 2), "currency": "INR"}
            for r in rows
        ]

    async def get_enrollment_series(
        self,
        teacher_id: uuid.UUID,
        since: datetime,
    ) -> list[dict[str, Any]]:
        """Return daily enrollment counts as a time series.

        Args:
            teacher_id: The teacher's user UUID.
            since: Start of the time window.

        Returns:
            list[dict]: Daily enrollment data points [{date, count}].
        """
        stmt = (
            select(
                func.date(CourseEnrollment.enrolled_at).label("date"),
                func.count(CourseEnrollment.id).label("count"),
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .where(
                Course.teacher_id == teacher_id,
                CourseEnrollment.enrolled_at >= since,
            )
            .group_by(func.date(CourseEnrollment.enrolled_at))
            .order_by(func.date(CourseEnrollment.enrolled_at).asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [{"date": str(r.date), "count": r.count} for r in rows]

    async def get_course_performance(
        self,
        teacher_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[dict[str, Any]]:
        """Return per-course analytics aggregates.

        Args:
            teacher_id: The teacher's user UUID.
            course_id: Optional filter to a single course.

        Returns:
            list[dict]: Per-course stats.
        """
        stmt = (
            select(
                Course.id.label("course_id"),
                Course.title.label("title"),
                func.count(CourseEnrollment.id).label("total_enrollments"),
                func.coalesce(func.sum(Payment.amount), 0).label("total_revenue"),
                func.coalesce(func.avg(CourseEnrollment.progress_percent), 0).label(
                    "average_progress"
                ),
            )
            .outerjoin(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .outerjoin(Payment, Payment.course_id == Course.id)
            .where(
                Course.teacher_id == teacher_id,
                Course.deleted_at.is_(None),
            )
            .group_by(Course.id, Course.title)
            .order_by(func.count(CourseEnrollment.id).desc())
        )
        if course_id:
            stmt = stmt.where(Course.id == course_id)

        rows = (await self._db.execute(stmt)).all()
        results = []
        for r in rows:
            total = r.total_enrollments or 0
            completed_stmt = select(func.count(CourseEnrollment.id)).where(
                CourseEnrollment.course_id == r.course_id,
                CourseEnrollment.completed_at.is_not(None),
            )
            completed: int = (await self._db.execute(completed_stmt)).scalar_one()
            completion_rate = (completed / total * 100) if total > 0 else 0.0

            results.append(
                {
                    "course_id": r.course_id,
                    "title": r.title,
                    "total_enrollments": total,
                    "total_revenue": round(float(r.total_revenue), 2),
                    "average_progress": round(float(r.average_progress), 2),
                    "completion_rate": round(completion_rate, 2),
                }
            )
        return results

    async def get_recent_enrollments(
        self,
        teacher_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return the most recent enrollments across all teacher courses.

        Args:
            teacher_id: The teacher's user UUID.
            limit: Maximum records to return.

        Returns:
            list[dict]: Recent enrollment data.
        """
        stmt = (
            select(
                User.full_name.label("student_name"),
                User.email.label("student_email"),
                Course.title.label("course_title"),
                CourseEnrollment.enrolled_at,
                Payment.amount.label("amount_paid"),
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .join(User, User.id == CourseEnrollment.student_id)
            .outerjoin(Payment, Payment.id == CourseEnrollment.payment_id)
            .where(Course.teacher_id == teacher_id)
            .order_by(CourseEnrollment.enrolled_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "student_name": r.student_name,
                "student_email": r.student_email,
                "course_title": r.course_title,
                "enrolled_at": r.enrolled_at.isoformat() if r.enrolled_at else None,
                "amount_paid": float(r.amount_paid or 0),
            }
            for r in rows
        ]

    async def get_recent_payments(
        self,
        teacher_id: uuid.UUID,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return the most recent payments for the teacher's courses.

        Args:
            teacher_id: The teacher's user UUID.
            limit: Maximum records.

        Returns:
            list[dict]: Recent payment data.
        """
        stmt = (
            select(
                User.full_name.label("student_name"),
                Course.title.label("course_title"),
                Payment.amount,
                Payment.status,
                func.coalesce(Payment.captured_at, Payment.created_at).label("created_at"),
            )
            .join(Course, Course.id == Payment.course_id)
            .join(User, User.id == Payment.student_id)
            .where(Course.teacher_id == teacher_id)
            .order_by(Payment.created_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "student_name": r.student_name,
                "course_title": r.course_title,
                "amount": float(r.amount),
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    async def get_total_students(self, teacher_id: uuid.UUID) -> int:
        """Count unique enrolled students across all teacher courses.

        Args:
            teacher_id: The teacher's user UUID.

        Returns:
            int: Unique student count.
        """
        stmt = (
            select(func.count(func.distinct(CourseEnrollment.student_id)))
            .join(Course, Course.id == CourseEnrollment.course_id)
            .where(Course.teacher_id == teacher_id)
        )
        return (await self._db.execute(stmt)).scalar_one()


# ===========================================================================
# StudentManagementRepository
# ===========================================================================


class StudentManagementRepository:
    """Repository for teacher's enrolled student management."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def list_enrolled_students(
        self,
        teacher_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        course_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Paginated list of enrolled students for a teacher.

        Args:
            teacher_id: The teacher's user UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            search: Optional name/email search string.
            course_id: Optional filter to a single course.
            is_active: Optional active status filter.

        Returns:
            tuple: (list of enrollment dicts, total count).
        """
        conditions = [Course.teacher_id == teacher_id]

        if course_id:
            conditions.append(CourseEnrollment.course_id == course_id)
        if search:
            conditions.append(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                )
            )
        if is_active is not None:
            conditions.append(User.is_active == is_active)

        base_stmt = (
            select(
                CourseEnrollment.id.label("enrollment_id"),
                User.id.label("student_id"),
                User.full_name.label("student_name"),
                User.email.label("student_email"),
                User.avatar_r2_key.label("student_avatar_r2_key"),
                Course.id.label("course_id"),
                Course.title.label("course_title"),
                CourseEnrollment.status.label("enrollment_status"),
                CourseEnrollment.enrolled_at,
                CourseEnrollment.progress_percentage.label("progress_percent"),
                CourseEnrollment.completed_at,
                Payment.amount.label("payment_amount"),
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .join(User, User.id == CourseEnrollment.student_id)
            .outerjoin(Payment, Payment.id == CourseEnrollment.payment_id)
            .where(and_(*conditions))
        )

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            base_stmt.order_by(CourseEnrollment.enrolled_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()

        items = [
            {
                "enrollment_id": str(r.enrollment_id),
                "student_id": str(r.student_id),
                "student_name": r.student_name,
                "student_email": r.student_email,
                "student_avatar_r2_key": r.student_avatar_r2_key,
                "course_id": str(r.course_id),
                "course_title": r.course_title,
                "enrollment_status": r.enrollment_status,
                "enrolled_at": r.enrolled_at.isoformat() if r.enrolled_at else None,
                "progress_percent": float(r.progress_percent or 0.0),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "payment_amount": float(r.payment_amount) if r.payment_amount else None,
            }
            for r in rows
        ]
        return items, total


    async def list_all_students_directory(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return a directory of all registered students in the platform for teacher DMs.

        Args:
            page: 1-indexed page number.
            page_size: Items per page.
            search: Optional name/email search term.

        Returns:
            tuple: (list of student dicts, total count).
        """
        from app.models.enums import UserRole

        conditions = [
            User.role == UserRole.STUDENT,
            User.deleted_at.is_(None),
        ]
        if search:
            conditions.append(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                )
            )

        stmt = select(User).where(and_(*conditions))
        count_stmt = select(func.count(User.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        paginated_stmt = (
            stmt.order_by(User.full_name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        users = (await self._db.execute(paginated_stmt)).scalars().all()

        items = [
            {
                "student_id": str(u.id),
                "student_name": u.full_name,
                "student_email": u.email,
                "student_avatar_r2_key": u.avatar_r2_key,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
        return items, total


    async def get_student_with_enrollments(
        self,
        student_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> Optional[dict[str, Any]]:
        """Fetch a student's profile and all their enrollments in teacher's courses.

        Args:
            student_id: The student's user UUID.
            teacher_id: The teacher's user UUID for scoping.

        Returns:
            dict | None: Student profile + enrollments, or None if not found.
        """
        # Load student user + profile
        user_stmt = (
            select(User)
            .options(selectinload(User.student_profile))
            .where(User.id == student_id, User.deleted_at.is_(None))
        )
        user: Optional[User] = (await self._db.execute(user_stmt)).scalar_one_or_none()
        if user is None:
            return None

        # Check they're enrolled in at least one teacher course
        enrollments_stmt = (
            select(
                CourseEnrollment,
                Course.title.label("course_title"),
                Payment.amount.label("payment_amount"),
            )
            .join(Course, Course.id == CourseEnrollment.course_id)
            .outerjoin(Payment, Payment.id == CourseEnrollment.payment_id)
            .where(
                CourseEnrollment.student_id == student_id,
                Course.teacher_id == teacher_id,
            )
        )
        enrollment_rows = (await self._db.execute(enrollments_stmt)).all()
        profile = user.student_profile
        enrollments = [
            {
                "enrollment_id": str(r.CourseEnrollment.id),
                "id": str(r.CourseEnrollment.id),
                "student_id": str(student_id),
                "student_name": user.full_name,
                "student_email": user.email,
                "student_avatar_r2_key": user.avatar_r2_key,
                "course_id": str(r.CourseEnrollment.course_id),
                "course_title": r.course_title,
                "enrollment_status": r.CourseEnrollment.status.value if hasattr(r.CourseEnrollment.status, "value") else str(r.CourseEnrollment.status),
                "status": r.CourseEnrollment.status.value if hasattr(r.CourseEnrollment.status, "value") else str(r.CourseEnrollment.status),
                "enrolled_at": r.CourseEnrollment.enrolled_at.isoformat() if r.CourseEnrollment.enrolled_at else None,
                "progress_percent": float(getattr(r.CourseEnrollment, "progress_percentage", getattr(r.CourseEnrollment, "progress_percent", 0.0)) or 0.0),
                "completed_at": r.CourseEnrollment.completed_at.isoformat() if r.CourseEnrollment.completed_at else None,
                "payment_amount": float(r.payment_amount) if r.payment_amount else None,
            }
            for r in enrollment_rows
        ]

        return {
            "id": str(user.id),
            "student_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "avatar_r2_key": user.avatar_r2_key,
            "phone": user.phone,
            "is_active": user.is_active,
            "college": profile.college if profile else None,
            "graduation_year": profile.graduation_year if profile else None,
            "preferred_language": profile.preferred_language if profile else "en",
            "total_courses_enrolled": profile.total_courses_enrolled if profile else len(enrollments),
            "total_courses_completed": profile.total_courses_completed if profile else 0,
            "enrollments": enrollments,
        }

    async def get_enrollment(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> Optional[CourseEnrollment]:
        """Fetch a specific enrollment record.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            CourseEnrollment | None: The enrollment, or None.
        """
        result = await self._db.execute(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_student_enrollments(
        self,
        student_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> list[CourseEnrollment]:
        """Fetch all enrollment records for a student in courses belonging to a teacher."""
        stmt = (
            select(CourseEnrollment)
            .join(Course, Course.id == CourseEnrollment.course_id)
            .where(
                CourseEnrollment.student_id == student_id,
                Course.teacher_id == teacher_id,
                Course.deleted_at.is_(None),
            )
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def update_enrollment_status(
        self,
        enrollment: CourseEnrollment,
        status: str,
    ) -> CourseEnrollment:
        """Update an enrollment's status.

        Args:
            enrollment: The enrollment record to update.
            status: The new status string.

        Returns:
            CourseEnrollment: The updated enrollment.
        """
        enrollment.status = status
        await self._db.flush()
        return enrollment

    async def delete_enrollment(self, enrollment: CourseEnrollment) -> None:
        """Delete an enrollment record (unenroll student).

        Args:
            enrollment: The enrollment record to delete.
        """
        course_id = enrollment.course_id
        await self._db.delete(enrollment)
        await self._db.flush()

        if course_id:
            course = (await self._db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
            if course and course.total_enrollments and course.total_enrollments > 0:
                course.total_enrollments -= 1
                await self._db.flush()

    async def get_student(self, student_id: uuid.UUID) -> Optional[User]:
        """Fetch a student user record.

        Args:
            student_id: The student UUID.

        Returns:
            User | None: The user, or None.
        """
        return (
            await self._db.execute(
                select(User).where(User.id == student_id, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()

    async def update_user_active(self, user: User, is_active: bool) -> None:
        """Set the is_active flag on a user account.

        Args:
            user: The User ORM instance to update.
            is_active: New active status.
        """
        user.is_active = is_active
        await self._db.flush()

    async def get_payment_history(
        self,
        student_id: uuid.UUID,
        teacher_id: uuid.UUID,
    ) -> list[Payment]:
        """Return all payments from a student for the teacher's courses.

        Args:
            student_id: The student UUID.
            teacher_id: The teacher UUID for scoping.

        Returns:
            list[Payment]: Payments ordered by newest first.
        """
        stmt = (
            select(Payment)
            .join(Course, Course.id == Payment.course_id)
            .where(
                Payment.student_id == student_id,
                Course.teacher_id == teacher_id,
            )
            .order_by(Payment.created_at.desc())
        )
        return list((await self._db.execute(stmt)).scalars().all())


# ===========================================================================
# TeacherProfileRepository
# ===========================================================================


class TeacherProfileRepository:
    """Repository for reading and updating the teacher's profile."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_by_user_id(self, user_id: uuid.UUID) -> Optional[TeacherProfile]:
        """Fetch the teacher profile for a user.

        Args:
            user_id: The teacher's user UUID.

        Returns:
            TeacherProfile | None: The profile, or None.
        """
        result = await self._db.execute(
            select(TeacherProfile).where(TeacherProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_profile(
        self,
        profile: TeacherProfile,
        **kwargs: Any,
    ) -> TeacherProfile:
        """Apply partial updates to the teacher profile.

        Args:
            profile: The TeacherProfile ORM instance.
            **kwargs: Column name → value updates.

        Returns:
            TeacherProfile: The updated profile.
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
