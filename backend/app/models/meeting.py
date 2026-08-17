"""Meeting, SessionAttendance, and AttendanceEvent models.

Meeting         : Scheduled live class session with Google Meet link.
SessionAttendance: Aggregate attendance record per student per meeting.
AttendanceEvent : Event-sourced raw join/leave timestamps.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, SmallInteger, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AttendanceEventType, AttendanceStatus, MeetingStatus

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Meeting(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Scheduled live class session."""

    __tablename__ = "meetings"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Denormalized from course.teacher_id for fast session-only queries.",
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    meeting_url: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None,
        comment="Google Meet URL.",
    )
    scheduled_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=60, server_default="60"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=MeetingStatus.SCHEDULED,
        server_default="scheduled",
    )
    recording_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship("Course", back_populates="meetings")
    teacher: Mapped[User] = relationship("User", foreign_keys=[teacher_id])
    attendance_records: Mapped[list[SessionAttendance]] = relationship(
        "SessionAttendance",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Meeting id={self.id} status={self.status}>"


class SessionAttendance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Aggregate attendance record: one row per student per meeting.

    Computed from AttendanceEvent records after the session ends.
    The total_duration_seconds and attendance_percentage fields are
    derived by summing join-leave intervals from attendance_events.
    is_late=True when the student joined more than 10 minutes after
    meeting.actual_started_at.
    """

    __tablename__ = "session_attendance"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=AttendanceStatus.ABSENT,
        server_default="absent",
    )
    join_time: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    leave_time: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    total_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    attendance_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0.00, server_default="0.00"
    )
    is_late: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # --- Relationships ---
    meeting: Mapped[Meeting] = relationship(
        "Meeting", back_populates="attendance_records"
    )
    student: Mapped[User] = relationship(
        "User",
        back_populates="attendance_records",
        foreign_keys=[student_id],
    )
    events: Mapped[list[AttendanceEvent]] = relationship(
        "AttendanceEvent",
        back_populates="session_attendance",
        cascade="all, delete-orphan",
        order_by="AttendanceEvent.occurred_at",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<SessionAttendance meeting={self.meeting_id}"
            f" student={self.student_id} status={self.status}>"
        )


class AttendanceEvent(UUIDPrimaryKeyMixin, Base):
    """Raw join or leave event for event-sourced attendance tracking.

    These events are the authoritative source of truth. The
    SessionAttendance summary is computed by pairing join/leave events
    in chronological order and summing the resulting durations.
    Stored as an immutable event log: never updated after insertion.
    """

    __tablename__ = "attendance_events"

    session_attendance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_attendance.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(10), nullable=False,
        comment="join | leave",
    )
    occurred_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    session_attendance: Mapped[SessionAttendance] = relationship(
        "SessionAttendance", back_populates="events"
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<AttendanceEvent type={self.event_type} at={self.occurred_at}>"
