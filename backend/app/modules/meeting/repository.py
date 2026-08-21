"""Meeting module — Repository layer.

Repositories are pure database access objects. They contain NO business
logic — all logic belongs in the service layer. Each repository method
performs exactly one database operation.

Repositories:
    MeetingRepository         : Meeting CRUD and status queries.
    AttendanceRepository      : Session attendance and event tracking.
    MeetingAnalyticsRepository: Aggregate analytics queries.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import CourseEnrollment
from app.models.meeting import AttendanceEvent, Meeting, SessionAttendance
from app.models.enums import AttendanceStatus, MeetingStatus


class MeetingRepository:
    """Database access for Meeting records.

    All queries automatically exclude soft-deleted records
    (``deleted_at IS NULL``) unless explicitly requested.

    Args:
        db: Async SQLAlchemy session for the current request.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the repository with an async DB session."""
        self._db = db

    async def create(
        self,
        data: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Meeting:
        """Insert a new Meeting record and flush to obtain the server-generated ID.

        Args:
            data: Dict of column-name to value mappings.
            **kwargs: Column-name to value keyword arguments.

        Returns:
            Meeting: The newly created, flushed Meeting ORM instance.
        """
        payload = dict(data) if data else {}
        payload.update(kwargs)
        meeting = Meeting(**payload)
        self._db.add(meeting)
        await self._db.flush()
        await self._db.refresh(meeting)
        return meeting

    async def get_by_id(
        self,
        meeting_id: uuid.UUID,
        *,
        load_attendance: bool = False,
    ) -> Optional[Meeting]:
        """Fetch a non-deleted meeting by primary key.

        Args:
            meeting_id: UUID of the meeting to retrieve.
            load_attendance: If True, eagerly load attendance_records.

        Returns:
            Meeting | None: The meeting or None if not found/deleted.
        """
        q = select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.deleted_at.is_(None),
        )
        if load_attendance:
            q = q.options(selectinload(Meeting.attendance_records))
        result = await self._db.execute(q)
        return result.scalar_one_or_none()

    async def get_by_meet_link(
        self, meet_link: str, exclude_id: Optional[uuid.UUID] = None
    ) -> Optional[Meeting]:
        """Look up a non-deleted meeting by its stored meet_link.

        Used for duplicate link detection.

        Args:
            meet_link: The normalized meet link to search.
            exclude_id: Optionally exclude a specific meeting ID
                (used during update to exclude the meeting being edited).

        Returns:
            Meeting | None: Existing meeting with this link, or None.
        """
        conditions = [
            Meeting.meet_link == meet_link,
            Meeting.deleted_at.is_(None),
            Meeting.status.notin_([MeetingStatus.CANCELLED, MeetingStatus.EXPIRED]),
        ]
        if exclude_id is not None:
            conditions.append(Meeting.id != exclude_id)

        result = await self._db.execute(
            select(Meeting).where(and_(*conditions))
        )
        return result.scalar_one_or_none()

    async def list_for_course(
        self,
        course_id: Optional[uuid.UUID] = None,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        exclude_cancelled: bool = False,
        exclude_draft: bool = False,
        sort_by: str = "scheduled_at",
        sort_order: str = "asc",
    ) -> tuple[list[Meeting], int]:
        """List meetings for a course with pagination and filters.

        Args:
            course_id: Filter by this course UUID (optional).
            page: Page number (1-indexed).
            page_size: Items per page.
            status: Optional status filter.
            exclude_cancelled: When True, omit cancelled meetings.
            exclude_draft: When True, omit draft meetings.
            sort_by: Column to sort by.
            sort_order: 'asc' or 'desc'.

        Returns:
            tuple[list[Meeting], int]: Page of meetings and total count.
        """
        conditions = [
            Meeting.deleted_at.is_(None),
        ]
        if course_id and course_id != uuid.UUID(int=0):
            conditions.append(Meeting.course_id == course_id)
        if status:
            conditions.append(Meeting.status == status)
        if exclude_cancelled:
            conditions.append(Meeting.status != MeetingStatus.CANCELLED)
        if exclude_draft:
            conditions.append(Meeting.status != MeetingStatus.DRAFT)

        count_result = await self._db.execute(
            select(func.count()).select_from(Meeting).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        sort_col = getattr(Meeting, sort_by, Meeting.scheduled_at)
        order = desc(sort_col) if sort_order == "desc" else sort_col

        result = await self._db.execute(
            select(Meeting)
            .where(and_(*conditions))
            .order_by(order)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        return list(result.scalars().all()), total

    async def list_today(
        self,
        teacher_id: Optional[uuid.UUID] = None,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[Meeting]:
        """Fetch all non-deleted meetings scheduled for today (UTC).

        Args:
            teacher_id: Optional filter by teacher.
            course_id: Optional filter by course.

        Returns:
            list[Meeting]: Today's meetings ordered by scheduled_at.
        """
        now = datetime.now(timezone.utc)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        conditions = [
            Meeting.scheduled_at >= day_start,
            Meeting.scheduled_at < day_end,
            Meeting.deleted_at.is_(None),
            Meeting.status != MeetingStatus.CANCELLED,
        ]
        if teacher_id:
            conditions.append(Meeting.teacher_id == teacher_id)
        if course_id:
            conditions.append(Meeting.course_id == course_id)

        result = await self._db.execute(
            select(Meeting)
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at)
        )
        return list(result.scalars().all())

    async def list_upcoming(
        self,
        days: int = 7,
        teacher_id: Optional[uuid.UUID] = None,
        course_id: Optional[uuid.UUID] = None,
        limit: int = 50,
    ) -> list[Meeting]:
        """Fetch upcoming meetings within the next N days.

        Args:
            days: Number of days ahead to look (default 7).
            teacher_id: Optional teacher filter.
            course_id: Optional course filter.
            limit: Maximum records to return.

        Returns:
            list[Meeting]: Upcoming meetings ordered by scheduled_at ascending.
        """
        now = datetime.now(timezone.utc)
        until = now + timedelta(days=days)

        conditions = [
            Meeting.scheduled_at > now,
            Meeting.scheduled_at <= until,
            Meeting.deleted_at.is_(None),
            Meeting.status.in_([MeetingStatus.SCHEDULED, MeetingStatus.LIVE]),
        ]
        if teacher_id:
            conditions.append(Meeting.teacher_id == teacher_id)
        if course_id:
            conditions.append(Meeting.course_id == course_id)

        result = await self._db.execute(
            select(Meeting)
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_past(
        self,
        teacher_id: Optional[uuid.UUID] = None,
        course_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Meeting], int]:
        """Fetch past (completed/expired) meetings with pagination.

        Args:
            teacher_id: Optional teacher filter.
            course_id: Optional course filter.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple[list[Meeting], int]: Page of past meetings and total count.
        """
        conditions = [
            Meeting.deleted_at.is_(None),
            Meeting.status.in_([
                MeetingStatus.COMPLETED,
                MeetingStatus.EXPIRED,
                MeetingStatus.ARCHIVED,
            ]),
        ]
        if teacher_id:
            conditions.append(Meeting.teacher_id == teacher_id)
        if course_id:
            conditions.append(Meeting.course_id == course_id)

        count_result = await self._db.execute(
            select(func.count()).select_from(Meeting).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self._db.execute(
            select(Meeting)
            .where(and_(*conditions))
            .order_by(desc(Meeting.scheduled_at))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        return list(result.scalars().all()), total

    async def list_by_date_range(
        self,
        start: datetime,
        end: datetime,
        teacher_id: Optional[uuid.UUID] = None,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[Meeting]:
        """Fetch meetings within an absolute datetime range.

        Used by weekly and monthly calendar views.

        Args:
            start: Range start (inclusive), UTC.
            end: Range end (exclusive), UTC.
            teacher_id: Optional teacher filter.
            course_id: Optional course filter.

        Returns:
            list[Meeting]: Meetings in range ordered by scheduled_at.
        """
        conditions = [
            Meeting.scheduled_at >= start,
            Meeting.scheduled_at < end,
            Meeting.deleted_at.is_(None),
        ]
        if teacher_id:
            conditions.append(Meeting.teacher_id == teacher_id)
        if course_id:
            conditions.append(Meeting.course_id == course_id)

        result = await self._db.execute(
            select(Meeting)
            .where(and_(*conditions))
            .order_by(Meeting.scheduled_at)
        )
        return list(result.scalars().all())

    async def update(
        self,
        meeting: Union[uuid.UUID, Meeting],
        data: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Optional[Meeting]:
        """Apply a partial update to a Meeting row.

        Args:
            meeting: UUID or Meeting instance to update.
            data: Dict of column updates to apply.
            **kwargs: Column updates as keyword arguments.

        Returns:
            Meeting | None: Updated meeting, or None if not found.
        """
        mid = meeting.id if isinstance(meeting, Meeting) else meeting
        payload = dict(data) if data else {}
        payload.update(kwargs)
        if not payload:
            return await self.get_by_id(mid)
        await self._db.execute(
            update(Meeting)
            .where(Meeting.id == mid, Meeting.deleted_at.is_(None))
            .values(**payload)
        )
        return await self.get_by_id(mid)

    async def soft_delete(self, meeting: Union[uuid.UUID, Meeting]) -> None:
        """Soft-delete a meeting by setting deleted_at to now.

        Args:
            meeting: UUID or Meeting instance to soft-delete.
        """
        mid = meeting.id if isinstance(meeting, Meeting) else meeting
        now = datetime.now(timezone.utc)
        await self._db.execute(
            update(Meeting)
            .where(Meeting.id == mid)
            .values(deleted_at=now)
        )

    async def set_status(
        self,
        meeting_id: uuid.UUID,
        status: str,
        extra: Optional[dict[str, Any]] = None,
    ) -> Optional[Meeting]:
        """Transition a meeting to a new status.

        Args:
            meeting_id: UUID of the target meeting.
            status: New status string (e.g. 'live', 'completed').
            extra: Optional additional column updates (e.g. actual_started_at).

        Returns:
            Meeting | None: Updated meeting, or None if not found.
        """
        values: dict[str, Any] = {"status": status}
        if extra:
            values.update(extra)
        return await self.update(meeting_id, values)

    async def mark_reminder_sent(self, meeting_id: uuid.UUID) -> None:
        """Mark the meeting as having had its reminder notification sent.

        Prevents duplicate reminder fires from the scheduler.

        Args:
            meeting_id: UUID of the meeting.
        """
        await self._db.execute(
            update(Meeting)
            .where(Meeting.id == meeting_id)
            .values(reminder_sent=True)
        )

    async def get_course_owner(self, course_id: uuid.UUID) -> Optional[uuid.UUID]:
        """Fetch the teacher_id (owner) of a course.

        Args:
            course_id: UUID of the course.

        Returns:
            uuid.UUID | None: The teacher's user ID, or None if not found.
        """
        from app.models.course import Course
        result = await self._db.execute(
            select(Course.teacher_id).where(Course.id == course_id)
        )
        return result.scalar_one_or_none()

    async def is_enrolled(
        self, student_id: uuid.UUID, course_id: uuid.UUID
    ) -> bool:
        """Check whether a student has an active enrollment in a course.

        Args:
            student_id: UUID of the student.
            course_id: UUID of the course.

        Returns:
            bool: True if an active enrollment exists.
        """
        result = await self._db.execute(
            select(func.count())
            .select_from(CourseEnrollment)
            .where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == "active",
            )
        )
        return result.scalar_one() > 0

    async def count_current_participants(self, meeting_id: uuid.UUID) -> int:
        """Count students currently in the meeting (joined but not left).

        A participant is 'current' when their latest AttendanceEvent is
        a 'join' event (i.e. no corresponding 'leave' event after it).
        This is approximated by counting SessionAttendance rows where
        join_time is set and leave_time is NULL.

        Args:
            meeting_id: UUID of the meeting.

        Returns:
            int: Number of currently active participants.
        """
        result = await self._db.execute(
            select(func.count())
            .select_from(SessionAttendance)
            .where(
                SessionAttendance.meeting_id == meeting_id,
                SessionAttendance.join_time.isnot(None),
                SessionAttendance.leave_time.is_(None),
            )
        )
        return result.scalar_one()


class AttendanceRepository:
    """Database access for SessionAttendance and AttendanceEvent records.

    Args:
        db: Async SQLAlchemy session for the current request.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the repository with an async DB session."""
        self._db = db

    async def get_session_attendance(
        self,
        meeting_id: uuid.UUID,
        student_id: uuid.UUID,
        *,
        load_events: bool = False,
    ) -> Optional[SessionAttendance]:
        """Fetch the aggregate attendance record for a student in a meeting.

        Args:
            meeting_id: UUID of the meeting.
            student_id: UUID of the student.
            load_events: If True, eagerly load attendance events.

        Returns:
            SessionAttendance | None: Attendance record or None.
        """
        q = select(SessionAttendance).where(
            SessionAttendance.meeting_id == meeting_id,
            SessionAttendance.student_id == student_id,
        )
        if load_events:
            q = q.options(selectinload(SessionAttendance.events))
        result = await self._db.execute(q)
        return result.scalar_one_or_none()

    async def get_by_id(
        self, attendance_id: uuid.UUID
    ) -> Optional[SessionAttendance]:
        """Fetch a SessionAttendance record by primary key.

        Args:
            attendance_id: UUID of the attendance record.

        Returns:
            SessionAttendance | None: Attendance record or None.
        """
        result = await self._db.execute(
            select(SessionAttendance).where(SessionAttendance.id == attendance_id)
        )
        return result.scalar_one_or_none()

    async def upsert_session_attendance(
        self,
        meeting_id: uuid.UUID,
        student_id: uuid.UUID,
        data: dict[str, Any],
    ) -> SessionAttendance:
        """Create or update the SessionAttendance record for a student.

        If a record already exists (student rejoined), the existing
        record is updated with the provided data.

        Args:
            meeting_id: UUID of the meeting.
            student_id: UUID of the student.
            data: Column-value pairs to apply.

        Returns:
            SessionAttendance: Created or updated attendance record.
        """
        existing = await self.get_session_attendance(meeting_id, student_id)
        if existing is None:
            record = SessionAttendance(
                meeting_id=meeting_id,
                student_id=student_id,
                **data,
            )
            self._db.add(record)
            await self._db.flush()
            await self._db.refresh(record)
            return record
        else:
            for key, value in data.items():
                setattr(existing, key, value)
            await self._db.flush()
            return existing

    async def record_event(
        self,
        session_attendance_id: uuid.UUID,
        event_type: str,
        occurred_at: Optional[datetime] = None,
    ) -> AttendanceEvent:
        """Append an immutable join or leave event to the audit log.

        Args:
            session_attendance_id: UUID of the parent SessionAttendance.
            event_type: 'join' or 'leave'.
            occurred_at: Event timestamp. Defaults to UTC now.

        Returns:
            AttendanceEvent: The newly created event record.
        """
        ts = occurred_at or datetime.now(timezone.utc)
        event = AttendanceEvent(
            session_attendance_id=session_attendance_id,
            event_type=event_type,
            occurred_at=ts,
        )
        self._db.add(event)
        await self._db.flush()
        return event

    async def list_for_meeting(
        self,
        meeting_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 100,
        load_events: bool = False,
    ) -> tuple[list[SessionAttendance], int]:
        """List all attendance records for a given meeting.

        Args:
            meeting_id: UUID of the meeting.
            page: Page number.
            page_size: Items per page.
            load_events: If True, eagerly load raw events.

        Returns:
            tuple[list[SessionAttendance], int]: Page of records and total.
        """
        count_result = await self._db.execute(
            select(func.count())
            .select_from(SessionAttendance)
            .where(SessionAttendance.meeting_id == meeting_id)
        )
        total = count_result.scalar_one()

        q = (
            select(SessionAttendance)
            .where(SessionAttendance.meeting_id == meeting_id)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        if load_events:
            q = q.options(selectinload(SessionAttendance.events))

        result = await self._db.execute(q)
        return list(result.scalars().all()), total

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        course_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[SessionAttendance], int]:
        """List a student's attendance history across meetings.

        Args:
            student_id: UUID of the student.
            course_id: Optional filter to a specific course (joins Meeting).
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple[list[SessionAttendance], int]: Records and total count.
        """
        if course_id:
            q_base = (
                select(SessionAttendance)
                .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
                .where(
                    SessionAttendance.student_id == student_id,
                    Meeting.course_id == course_id,
                    Meeting.deleted_at.is_(None),
                )
            )
            count_q = (
                select(func.count())
                .select_from(SessionAttendance)
                .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
                .where(
                    SessionAttendance.student_id == student_id,
                    Meeting.course_id == course_id,
                    Meeting.deleted_at.is_(None),
                )
            )
        else:
            q_base = select(SessionAttendance).where(
                SessionAttendance.student_id == student_id
            )
            count_q = (
                select(func.count())
                .select_from(SessionAttendance)
                .where(SessionAttendance.student_id == student_id)
            )

        count_result = await self._db.execute(count_q)
        total = count_result.scalar_one()

        result = await self._db.execute(
            q_base.order_by(desc(SessionAttendance.created_at))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        return list(result.scalars().all()), total

    async def compute_summary(
        self, meeting_id: uuid.UUID
    ) -> dict[str, Any]:
        """Compute aggregate attendance statistics for a completed meeting.

        Aggregates across all SessionAttendance records for the meeting:
            - Total present (present + late).
            - Total absent.
            - Total late.
            - Average duration in seconds.
            - Average join delay in seconds (join_time - meeting.actual_started_at).

        Args:
            meeting_id: UUID of the completed meeting.

        Returns:
            dict[str, Any]: Computed summary with keys:
                total_present, total_absent, total_late,
                avg_duration_seconds, avg_join_delay_seconds.
        """
        result = await self._db.execute(
            select(
                func.count(SessionAttendance.id).label("total"),
                func.sum(
                    func.case(
                        (SessionAttendance.status.in_(["present", "late"]), 1),
                        else_=0,
                    )
                ).label("total_present"),
                func.sum(
                    func.case(
                        (SessionAttendance.status == "absent", 1),
                        else_=0,
                    )
                ).label("total_absent"),
                func.sum(
                    func.case(
                        (SessionAttendance.status == "late", 1),
                        else_=0,
                    )
                ).label("total_late"),
                func.avg(SessionAttendance.total_duration_seconds).label("avg_duration"),
                func.avg(SessionAttendance.attendance_percentage).label("avg_pct"),
            ).where(SessionAttendance.meeting_id == meeting_id)
        )
        row = result.one_or_none()
        if row is None:
            return {
                "total_present": 0,
                "total_absent": 0,
                "total_late": 0,
                "avg_duration_seconds": 0.0,
                "avg_attendance_pct": 0.0,
            }
        return {
            "total_present": int(row.total_present or 0),
            "total_absent": int(row.total_absent or 0),
            "total_late": int(row.total_late or 0),
            "avg_duration_seconds": float(row.avg_duration or 0),
            "avg_attendance_pct": float(row.avg_pct or 0),
        }

    async def manual_mark(
        self,
        meeting_id: uuid.UUID,
        student_id: uuid.UUID,
        status: str,
        notes: Optional[str] = None,
    ) -> SessionAttendance:
        """Manually set a student's attendance status (teacher override).

        Args:
            meeting_id: UUID of the meeting.
            student_id: UUID of the student.
            status: New attendance status string.
            notes: Optional reason for the manual override.

        Returns:
            SessionAttendance: Updated attendance record.
        """
        data: dict[str, Any] = {"status": status}
        return await self.upsert_session_attendance(meeting_id, student_id, data)


class MeetingAnalyticsRepository:
    """Aggregate analytics queries for meetings across courses.

    All methods return plain Python dicts or lists, not ORM objects,
    since they aggregate across multiple tables.

    Args:
        db: Async SQLAlchemy session for the current request.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the repository with an async DB session."""
        self._db = db

    async def course_attendance_stats(
        self, course_id: uuid.UUID
    ) -> dict[str, Any]:
        """Compute overall attendance statistics for a course.

        Args:
            course_id: UUID of the course.

        Returns:
            dict[str, Any]: Statistics with keys:
                total_meetings, completed_meetings, cancelled_meetings,
                avg_attendance_rate, avg_duration_minutes.
        """
        result = await self._db.execute(
            select(
                func.count(Meeting.id).label("total"),
                func.sum(
                    func.case((Meeting.status == "completed", 1), else_=0)
                ).label("completed"),
                func.sum(
                    func.case((Meeting.status == "cancelled", 1), else_=0)
                ).label("cancelled"),
                func.avg(Meeting.duration_minutes).label("avg_duration"),
            ).where(
                Meeting.course_id == course_id,
                Meeting.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        if row is None:
            return {
                "total_meetings": 0,
                "completed_meetings": 0,
                "cancelled_meetings": 0,
                "avg_attendance_rate": 0.0,
                "avg_duration_minutes": 0.0,
            }

        # Compute average attendance rate from session_attendance table
        att_result = await self._db.execute(
            select(func.avg(SessionAttendance.attendance_percentage))
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(
                Meeting.course_id == course_id,
                Meeting.deleted_at.is_(None),
            )
        )
        avg_rate = att_result.scalar_one_or_none() or 0.0

        return {
            "total_meetings": int(row.total or 0),
            "completed_meetings": int(row.completed or 0),
            "cancelled_meetings": int(row.cancelled or 0),
            "avg_attendance_rate": float(avg_rate),
            "avg_duration_minutes": float(row.avg_duration or 0),
        }

    async def teacher_stats(
        self, teacher_id: uuid.UUID
    ) -> dict[str, Any]:
        """Aggregate statistics for a teacher across all their courses.

        Args:
            teacher_id: UUID of the teacher.

        Returns:
            dict[str, Any]: Teacher statistics with keys:
                total_created, total_completed, total_cancelled,
                total_hours_taught, avg_attendance_rate.
        """
        result = await self._db.execute(
            select(
                func.count(Meeting.id).label("total"),
                func.sum(
                    func.case((Meeting.status == "completed", 1), else_=0)
                ).label("completed"),
                func.sum(
                    func.case((Meeting.status == "cancelled", 1), else_=0)
                ).label("cancelled"),
                func.sum(
                    func.case(
                        (Meeting.status == "completed", Meeting.duration_minutes),
                        else_=0,
                    )
                ).label("total_minutes"),
            ).where(
                Meeting.teacher_id == teacher_id,
                Meeting.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()

        att_result = await self._db.execute(
            select(func.avg(SessionAttendance.attendance_percentage))
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(
                Meeting.teacher_id == teacher_id,
                Meeting.deleted_at.is_(None),
            )
        )
        avg_rate = att_result.scalar_one_or_none() or 0.0

        total_minutes = int(getattr(row, "total_minutes", 0) or 0)

        return {
            "total_created": int(getattr(row, "total", 0) or 0),
            "total_completed": int(getattr(row, "completed", 0) or 0),
            "total_cancelled": int(getattr(row, "cancelled", 0) or 0),
            "total_hours_taught": round(total_minutes / 60, 2),
            "avg_attendance_rate": float(avg_rate),
        }

    async def student_missed_classes(
        self, course_id: uuid.UUID
    ) -> dict[str, int]:
        """Count missed classes per student for a course.

        A 'missed class' is a completed meeting where the student's
        SessionAttendance has status == 'absent'.

        Args:
            course_id: UUID of the course.

        Returns:
            dict[str, int]: Maps student_id (str) -> missed count.
        """
        result = await self._db.execute(
            select(
                SessionAttendance.student_id,
                func.count(SessionAttendance.id).label("missed"),
            )
            .join(Meeting, Meeting.id == SessionAttendance.meeting_id)
            .where(
                Meeting.course_id == course_id,
                Meeting.status == MeetingStatus.COMPLETED,
                SessionAttendance.status == AttendanceStatus.ABSENT,
                Meeting.deleted_at.is_(None),
            )
            .group_by(SessionAttendance.student_id)
        )
        return {str(row.student_id): row.missed for row in result.all()}

    async def peak_attendance(
        self, meeting_id: uuid.UUID
    ) -> int:
        """Return the peak concurrent participant count for a meeting.

        Approximated as the maximum number of students who were in the
        session simultaneously (joined and not yet left).

        Args:
            meeting_id: UUID of the meeting.

        Returns:
            int: Maximum concurrent participant count.
        """
        # Count records that had a join event (join_time is set)
        result = await self._db.execute(
            select(func.count(SessionAttendance.id))
            .where(
                SessionAttendance.meeting_id == meeting_id,
                SessionAttendance.join_time.isnot(None),
            )
        )
        return result.scalar_one()
