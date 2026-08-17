"""Meeting module — Pydantic request/response schemas.

All schemas use strict typing with Google-style docstrings.
The ``meet_link`` field is intentionally ABSENT from all response
schemas — it is only revealed through the controlled join endpoint.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ===========================================================================
# Query Parameter Schemas
# ===========================================================================


class MeetingListParams(BaseModel):
    """Query parameters for listing meetings.

    Attributes:
        course_id: Filter by course UUID.
        status: Filter by meeting status.
        page: Page number (1-indexed).
        page_size: Items per page.
        sort_by: Field to sort by.
        sort_order: 'asc' or 'desc'.
    """

    course_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="scheduled_at")
    sort_order: str = Field(default="asc")

    model_config = {"extra": "ignore"}


class AttendanceListParams(BaseModel):
    """Query parameters for listing attendance records.

    Attributes:
        page: Page number (1-indexed).
        page_size: Items per page.
    """

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)

    model_config = {"extra": "ignore"}


class CalendarParams(BaseModel):
    """Query parameters for calendar views.

    Attributes:
        course_id: Optional course filter.
        year: Year for monthly view.
        month: Month for monthly view (1–12).
        start_date: ISO date string for weekly view start.
        timezone: IANA timezone name (default UTC).
    """

    course_id: Optional[uuid.UUID] = None
    year: Optional[int] = Field(default=None, ge=2020, le=2100)
    month: Optional[int] = Field(default=None, ge=1, le=12)
    start_date: Optional[str] = None
    timezone: str = Field(default="UTC", max_length=50)

    model_config = {"extra": "ignore"}


# ===========================================================================
# Request Schemas
# ===========================================================================


class CreateMeetingRequest(BaseModel):
    """Request body for creating a new meeting.

    Attributes:
        course_id: UUID of the course this meeting belongs to.
        title: Meeting title shown to students.
        description: Optional detailed description.
        instructions: Optional pre-meeting instructions for students.
        meet_link: Google Meet URL provided by the teacher.
        scheduled_at: Absolute UTC start datetime.
        duration_minutes: Expected session length in minutes.
        max_participants: Optional participant cap.
        visibility: Who can see this meeting.
        notes: Optional teacher notes (not shown to students).
        metadata: Optional arbitrary key-value metadata.
    """

    course_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    meet_link: str = Field(min_length=10, max_length=512)
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=5, le=480)
    max_participants: Optional[int] = Field(default=None, ge=1, le=1000)
    visibility: str = Field(default="public")
    notes: Optional[str] = Field(default=None, max_length=5000)
    metadata: Optional[dict[str, Any]] = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        """Validate visibility is a known value."""
        allowed = {"public", "private", "unlisted"}
        if v not in allowed:
            raise ValueError(f"visibility must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("scheduled_at", mode="before")
    @classmethod
    def parse_scheduled_at(cls, v: Any) -> Any:
        """Accept both ISO strings and datetime objects."""
        return v

    @field_validator("meet_link")
    @classmethod
    def strip_meet_link(cls, v: str) -> str:
        """Strip whitespace from meet link."""
        return v.strip()


class UpdateMeetingRequest(BaseModel):
    """Partial update request for an existing meeting.

    All fields are optional — only provided fields are updated.

    Attributes:
        title: New meeting title.
        description: New description.
        instructions: New student-facing instructions.
        meet_link: New Google Meet URL.
        scheduled_at: New start datetime.
        duration_minutes: New expected duration.
        max_participants: New participant cap (None to remove cap).
        visibility: New visibility setting.
        notes: Updated teacher notes.
        metadata: Merged metadata dict.
    """

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    meet_link: Optional[str] = Field(default=None, min_length=10, max_length=512)
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=480)
    max_participants: Optional[int] = Field(default=None, ge=1, le=1000)
    visibility: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    metadata: Optional[dict[str, Any]] = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str | None) -> str | None:
        """Validate visibility when provided."""
        if v is None:
            return v
        allowed = {"public", "private", "unlisted"}
        if v not in allowed:
            raise ValueError(f"visibility must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("meet_link")
    @classmethod
    def strip_meet_link(cls, v: str | None) -> str | None:
        """Strip whitespace from meet link when provided."""
        return v.strip() if v else v


class CancelMeetingRequest(BaseModel):
    """Request body for cancelling a meeting.

    Attributes:
        reason: Human-readable cancellation reason sent to students.
        notify_students: Whether to send cancellation notifications.
    """

    reason: str = Field(min_length=5, max_length=500)
    notify_students: bool = Field(default=True)


class DuplicateMeetingRequest(BaseModel):
    """Request body for duplicating an existing meeting.

    Attributes:
        scheduled_at: New start datetime for the duplicate.
        title: Optional new title. Defaults to original + ' (Copy)'.
        meet_link: New Google Meet URL for the duplicate.
    """

    scheduled_at: datetime
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    meet_link: str = Field(min_length=10, max_length=512)


class RecurringMeetingRequest(BaseModel):
    """Request body for scheduling a recurring meeting series.

    Attributes:
        course_id: UUID of the course.
        title: Series title (individual meetings append ' #N').
        description: Optional description applied to all sessions.
        instructions: Optional instructions applied to all sessions.
        meet_link: Single Google Meet URL or a list of rotating links.
        first_session_at: Start datetime of the first session.
        duration_minutes: Duration of each session.
        frequency: Recurrence frequency.
        occurrences: Total number of sessions to create (max 52).
        max_participants: Optional participant cap per session.
        visibility: Visibility applied to all sessions.
    """

    course_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    meet_link: str = Field(min_length=10, max_length=512)
    first_session_at: datetime
    duration_minutes: int = Field(default=60, ge=5, le=480)
    frequency: str = Field(default="weekly")
    occurrences: int = Field(default=8, ge=2, le=52)
    max_participants: Optional[int] = Field(default=None, ge=1, le=1000)
    visibility: str = Field(default="public")

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        """Validate frequency is a known recurrence type."""
        allowed = {"daily", "weekly", "biweekly", "monthly"}
        if v not in allowed:
            raise ValueError(f"frequency must be one of: {', '.join(sorted(allowed))}")
        return v


class GoLiveRequest(BaseModel):
    """Request body for marking a meeting as live.

    Attributes:
        actual_start_override: Optional override for the actual start time.
            Defaults to server UTC now if not provided.
    """

    actual_start_override: Optional[datetime] = None


class EndMeetingRequest(BaseModel):
    """Request body for ending a live meeting.

    Attributes:
        actual_end_override: Optional override for the actual end time.
            Defaults to server UTC now.
    """

    actual_end_override: Optional[datetime] = None


class AttendanceMarkRequest(BaseModel):
    """Request body for manually marking a student's attendance.

    Used by teachers to override attendance for students who attended
    outside the normal tracking system (e.g. via phone).

    Attributes:
        student_id: UUID of the student.
        meeting_id: UUID of the meeting.
        status: Attendance status override.
        notes: Optional reason for the manual override.
    """

    student_id: uuid.UUID
    meeting_id: uuid.UUID
    status: str = Field(default="present")
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status is a known attendance value."""
        allowed = {"present", "absent", "late", "partial"}
        if v not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v


# ===========================================================================
# Response Schemas
# ===========================================================================


class MeetingResponse(BaseModel):
    """Summary meeting response — safe for student-facing lists.

    IMPORTANT: meet_link is intentionally omitted.

    Attributes:
        id: Meeting UUID.
        course_id: Parent course UUID.
        teacher_id: Owner teacher UUID.
        title: Meeting title.
        description: Optional description.
        instructions: Optional student-facing instructions.
        scheduled_at: Planned start datetime (UTC).
        duration_minutes: Expected duration in minutes.
        actual_started_at: When the meeting went live.
        actual_ended_at: When the meeting ended.
        status: Current lifecycle status.
        provider: Meeting platform identifier.
        max_participants: Optional participant cap.
        visibility: Visibility setting.
        is_live: Convenience flag (status == 'live').
        can_join: Whether the current time is within the join window.
        created_at: Record creation timestamp.
    """

    id: uuid.UUID
    course_id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    description: Optional[str]
    instructions: Optional[str]
    scheduled_at: datetime
    duration_minutes: int
    actual_started_at: Optional[datetime]
    actual_ended_at: Optional[datetime]
    status: str
    provider: str
    max_participants: Optional[int]
    visibility: str
    is_live: bool
    can_join: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MeetingDetailResponse(MeetingResponse):
    """Extended meeting response — additional fields for detail view.

    Extends MeetingResponse with fields only shown in the detail endpoint.
    meet_link is still intentionally omitted.

    Attributes:
        notes: Teacher-facing session notes (shown to teacher only).
        recording_r2_key: R2 key for the recording (if available).
        metadata: Arbitrary metadata dict.
        attendance_count: Number of students who joined (post-meeting).
    """

    notes: Optional[str]
    recording_r2_key: Optional[str]
    metadata: Optional[dict[str, Any]]
    attendance_count: int = 0


class JoinResponse(BaseModel):
    """Secure join response returned to an authenticated, verified student.

    Contains the join payload from the provider. The actual meeting
    link is embedded in provider_data.join_url.

    Attributes:
        meeting_id: UUID of the meeting being joined.
        meeting_title: Human-readable meeting title.
        provider: Meeting platform identifier.
        provider_data: Provider-specific join payload (includes join_url).
        join_recorded_at: Server timestamp when this join was recorded.
        attendance_id: UUID of the created SessionAttendance record.
    """

    meeting_id: uuid.UUID
    meeting_title: str
    provider: str
    provider_data: dict[str, Any]
    join_recorded_at: datetime
    attendance_id: uuid.UUID


class AttendanceEventResponse(BaseModel):
    """Single raw attendance event (join or leave).

    Attributes:
        id: Event UUID.
        event_type: 'join' or 'leave'.
        occurred_at: Event timestamp (UTC).
    """

    id: uuid.UUID
    event_type: str
    occurred_at: datetime

    model_config = {"from_attributes": True}


class AttendanceResponse(BaseModel):
    """Aggregate attendance record for one student in one meeting.

    Attributes:
        id: SessionAttendance UUID.
        meeting_id: Parent meeting UUID.
        student_id: Student UUID.
        status: Computed attendance status.
        join_time: First join timestamp.
        leave_time: Last leave timestamp.
        total_duration_seconds: Total time in session.
        attendance_percentage: Percentage of meeting duration attended.
        is_late: Whether the student joined late.
        events: Ordered list of raw join/leave events.
    """

    id: uuid.UUID
    meeting_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    join_time: Optional[datetime]
    leave_time: Optional[datetime]
    total_duration_seconds: int
    attendance_percentage: float
    is_late: bool
    events: list[AttendanceEventResponse] = []

    model_config = {"from_attributes": True}


class AttendanceSummaryResponse(BaseModel):
    """Attendance summary for an entire meeting session.

    Attributes:
        meeting_id: Meeting UUID.
        meeting_title: Meeting title.
        scheduled_at: Planned start time.
        total_enrolled: Total enrolled students in the course.
        total_present: Students marked present or late.
        total_absent: Students marked absent.
        total_late: Students marked late.
        attendance_rate: Percentage of enrolled students who attended.
        average_duration_seconds: Mean time students spent in session.
        average_join_delay_seconds: Mean delay from meeting start to join.
        peak_concurrent: Maximum simultaneous participants.
        records: Per-student attendance records.
    """

    meeting_id: uuid.UUID
    meeting_title: str
    scheduled_at: datetime
    total_enrolled: int
    total_present: int
    total_absent: int
    total_late: int
    attendance_rate: float
    average_duration_seconds: float
    average_join_delay_seconds: float
    peak_concurrent: int
    records: list[AttendanceResponse] = []


class MeetingAnalyticsResponse(BaseModel):
    """Course-wide meeting analytics for a teacher.

    Attributes:
        course_id: Course UUID.
        total_meetings: Total meetings in the course.
        completed_meetings: Meetings that have ended.
        cancelled_meetings: Meetings that were cancelled.
        average_attendance_rate: Mean attendance rate across completed meetings.
        average_meeting_duration_minutes: Mean actual duration.
        top_attended_meeting_id: UUID of the highest-attendance meeting.
        lowest_attended_meeting_id: UUID of the lowest-attendance meeting.
        student_missed_class_counts: Dict of student_id -> missed count.
        monthly_breakdown: List of monthly attendance stats.
    """

    course_id: uuid.UUID
    total_meetings: int
    completed_meetings: int
    cancelled_meetings: int
    average_attendance_rate: float
    average_meeting_duration_minutes: float
    top_attended_meeting_id: Optional[uuid.UUID]
    lowest_attended_meeting_id: Optional[uuid.UUID]
    student_missed_class_counts: dict[str, int] = {}
    monthly_breakdown: list[dict[str, Any]] = []


class CalendarMeetingItem(BaseModel):
    """Compact meeting representation for calendar views.

    Attributes:
        id: Meeting UUID.
        course_id: Parent course UUID.
        title: Meeting title.
        scheduled_at: Start datetime.
        duration_minutes: Duration in minutes.
        status: Lifecycle status.
        is_live: Convenience flag.
        provider: Meeting platform identifier.
    """

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    is_live: bool
    provider: str


class CalendarDayResponse(BaseModel):
    """Meetings grouped by a single calendar day.

    Attributes:
        date: ISO date string (YYYY-MM-DD).
        meetings: Ordered list of meetings for this day.
    """

    date: str
    meetings: list[CalendarMeetingItem] = []


class TeacherStatsResponse(BaseModel):
    """Teacher-level statistics across all their courses.

    Attributes:
        teacher_id: Teacher UUID.
        total_meetings_created: Total meetings ever created.
        total_meetings_completed: Meetings that ended.
        total_meetings_cancelled: Meetings cancelled.
        total_hours_taught: Sum of completed meeting durations in hours.
        average_attendance_rate: Mean attendance rate across all courses.
        most_active_course_id: Course with the most meetings.
    """

    teacher_id: uuid.UUID
    total_meetings_created: int
    total_meetings_completed: int
    total_meetings_cancelled: int
    total_hours_taught: float
    average_attendance_rate: float
    most_active_course_id: Optional[uuid.UUID]
