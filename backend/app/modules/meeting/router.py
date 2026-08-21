"""Meeting module — API Router.

Four route groups mounted under /api/v1:
    /meetings   Teacher meeting management (CRUD, lifecycle).
    /live       Student join/leave endpoints (security pipeline).
    /attendance Teacher attendance read + manual override.
    /calendar   Calendar views (today, upcoming, weekly, monthly, past).

All endpoints:
    - Require JWT authentication via get_current_teacher or get_current_student.
    - Contain zero business logic (all logic in service layer).
    - Use success_response / created_response / paginated_response helpers.
    - Commit is the responsibility of the get_db_session context manager.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import (
    created_response,
    paginated_response,
    success_response,
)
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import get_current_student, get_current_teacher, get_current_user
from app.modules.meeting.schemas import (
    AttendanceMarkRequest,
    CancelMeetingRequest,
    CreateMeetingRequest,
    DuplicateMeetingRequest,
    EndMeetingRequest,
    GoLiveRequest,
    RecurringMeetingRequest,
    UpdateMeetingRequest,
)
from app.modules.meeting.service import (
    AttendanceService,
    CalendarService,
    MeetingAnalyticsService,
    MeetingService,
)

# ---------------------------------------------------------------------------
# Sub-routers
# ---------------------------------------------------------------------------

meeting_router = APIRouter(prefix="/meetings", tags=["Meetings"])
live_router = APIRouter(prefix="/live", tags=["Live Meeting"])
attendance_router = APIRouter(prefix="/attendance", tags=["Attendance"])
calendar_router = APIRouter(prefix="/calendar", tags=["Calendar"])


# ===========================================================================
# /meetings — Teacher meeting management
# ===========================================================================


@meeting_router.post(
    "",
    summary="Create a meeting",
    description=(
        "Create a new scheduled live session. Validates the Google Meet link, "
        "checks for duplicates, verifies course ownership, and notifies enrolled students."
    ),
    status_code=201,
)
async def create_meeting(
    body: CreateMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a new meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.create_meeting(body)
    await db.commit()
    return created_response(meeting, message="Meeting created successfully.")


@meeting_router.get(
    "",
    summary="List meetings",
    description="List meetings for a course with pagination and optional filters.",
)
async def list_meetings(
    course_id: Optional[uuid.UUID] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="scheduled_at"),
    sort_order: str = Query(default="asc"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List meetings with pagination (teacher or student)."""
    svc = MeetingService(db, user)
    meetings, total = await svc.list_meetings(
        course_id=course_id,
        page=page,
        page_size=page_size,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return paginated_response(meetings, page=page, page_size=page_size, total=total)


@meeting_router.get(
    "/{meeting_id}",
    summary="Get meeting detail",
    description="Fetch full meeting detail. meet_link is never included in the response.",
)
async def get_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get meeting detail (any authenticated user)."""
    svc = MeetingService(db, user)
    meeting = await svc.get_meeting(meeting_id)
    return success_response(meeting)


@meeting_router.patch(
    "/{meeting_id}",
    summary="Update meeting",
    description="Partial update. Validates new meet link and checks for duplicates.",
)
async def update_meeting(
    meeting_id: uuid.UUID,
    body: UpdateMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Partial update a meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.update_meeting(meeting_id, body)
    await db.commit()
    return success_response(meeting, message="Meeting updated.")


@meeting_router.delete(
    "/{meeting_id}",
    summary="Delete meeting",
    description="Soft-delete a draft or cancelled meeting.",
    status_code=204,
)
async def delete_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Soft-delete a meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    await svc.delete_meeting(meeting_id)
    await db.commit()
    return Response(status_code=204)


@meeting_router.post(
    "/{meeting_id}/cancel",
    summary="Cancel meeting",
    description="Cancel a meeting and notify enrolled students with a reason.",
)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    body: CancelMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Cancel a meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.cancel_meeting(meeting_id, body)
    await db.commit()
    return success_response(meeting, message="Meeting cancelled.")


@meeting_router.post(
    "/{meeting_id}/duplicate",
    summary="Duplicate meeting",
    description="Create a copy of an existing meeting with a new time and meet link.",
    status_code=201,
)
async def duplicate_meeting(
    meeting_id: uuid.UUID,
    body: DuplicateMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Duplicate a meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.duplicate_meeting(meeting_id, body)
    await db.commit()
    return created_response(meeting, message="Meeting duplicated.")


@meeting_router.post(
    "/recurring",
    summary="Schedule recurring series",
    description=(
        "Create a series of recurring meetings (daily, weekly, biweekly, monthly). "
        "All sessions share the same meet link and are suffixed with #N."
    ),
    status_code=201,
)
async def create_recurring(
    body: RecurringMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a recurring meeting series (teacher only)."""
    svc = MeetingService(db, teacher)
    meetings = await svc.create_recurring(body)
    await db.commit()
    return created_response(
        meetings,
        message=f"Created {len(meetings)} recurring sessions.",
    )


@meeting_router.post(
    "/{meeting_id}/go-live",
    summary="Start meeting (go live)",
    description="Transition meeting from 'scheduled' to 'live'. Notifies all enrolled students.",
)
async def go_live(
    meeting_id: uuid.UUID,
    body: GoLiveRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark meeting as live (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.go_live(meeting_id, body)
    await db.commit()
    return success_response(meeting, message="Meeting is now live.")


@meeting_router.post(
    "/{meeting_id}/end",
    summary="End meeting",
    description="Transition meeting from 'live' to 'completed'. Finalizes all attendance records.",
)
async def end_meeting(
    meeting_id: uuid.UUID,
    body: EndMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """End a live meeting (teacher only)."""
    svc = MeetingService(db, teacher)
    meeting = await svc.end_meeting(meeting_id, body)
    await db.commit()
    return success_response(meeting, message="Meeting ended.")


@meeting_router.get(
    "/analytics/course/{course_id}",
    summary="Course meeting analytics",
    description="Comprehensive attendance and engagement analytics for a course.",
)
async def course_analytics(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get course meeting analytics (teacher only)."""
    svc = MeetingAnalyticsService(db, teacher)
    data = await svc.course_analytics(course_id)
    return success_response(data)


@meeting_router.get(
    "/analytics/me",
    summary="Teacher statistics",
    description="Aggregate statistics for the authenticated teacher across all courses.",
)
async def teacher_stats(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get teacher aggregate statistics."""
    svc = MeetingAnalyticsService(db, teacher)
    data = await svc.teacher_stats()
    return success_response(data)


# ===========================================================================
# /live — Student join/leave (security pipeline)
# ===========================================================================


@live_router.post(
    "/{meeting_id}/join",
    summary="Join a meeting",
    description=(
        "Full security pipeline: JWT → enrollment → status → time window → capacity → "
        "audit log → return join payload. The Google Meet link is ONLY revealed here."
    ),
)
@meeting_router.post(
    "/{meeting_id}/join",
    summary="Join a meeting (alias)",
)
async def join_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Join a meeting (any authenticated user — enrollment verified in service)."""
    svc = AttendanceService(db, user)
    join_response = await svc.join_meeting(meeting_id)
    await db.commit()
    return success_response(join_response)


@live_router.post(
    "/{meeting_id}/leave",
    summary="Leave a meeting",
    description=(
        "Record a leave event. Computes total duration, attendance percentage, "
        "and updates the student's attendance status."
    ),
)
async def leave_meeting(
    meeting_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Record leave event (any authenticated user)."""
    svc = AttendanceService(db, user)
    result = await svc.leave_meeting(meeting_id)
    await db.commit()
    return success_response(result, message="Left meeting. Attendance recorded.")


# ===========================================================================
# /attendance — Teacher attendance management
# ===========================================================================


@attendance_router.get(
    "/{meeting_id}",
    summary="List meeting attendance",
    description="List all attendance records for a meeting (teacher only).",
)
async def list_attendance(
    meeting_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List attendance records for a meeting (teacher only)."""
    svc = AttendanceService(db, teacher)
    records, total = await svc.list_meeting_attendance(
        meeting_id, page=page, page_size=page_size
    )
    return paginated_response(records, page=page, page_size=page_size, total=total)


@attendance_router.get(
    "/summary/{meeting_id}",
    summary="Attendance summary",
    description="Aggregate attendance analytics for a single meeting (teacher only).",
)
async def attendance_summary(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get attendance analytics summary (teacher only)."""
    svc = AttendanceService(db, teacher)
    summary = await svc.get_attendance_summary(meeting_id)
    return success_response(summary)


@attendance_router.get(
    "/my/{course_id}",
    summary="My attendance history",
    description="Retrieve the authenticated student's attendance history for a course.",
)
async def my_attendance(
    course_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get student's own attendance history for a course."""
    svc = AttendanceService(db, student)
    records, total = await svc.my_attendance(
        course_id=course_id, page=page, page_size=page_size
    )
    return paginated_response(records, page=page, page_size=page_size, total=total)


@attendance_router.post(
    "/mark",
    summary="Manual attendance override",
    description="Teacher manually sets a student's attendance status for a meeting.",
)
async def manual_attendance(
    body: AttendanceMarkRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Manually mark a student's attendance (teacher only)."""
    svc = AttendanceService(db, teacher)
    record = await svc.manual_mark(body)
    await db.commit()
    return success_response(record, message="Attendance updated.")


# ===========================================================================
# /calendar — Calendar views
# ===========================================================================


@calendar_router.get(
    "/today",
    summary="Today's meetings",
    description="All meetings scheduled for today (UTC), for the authenticated user.",
)
async def calendar_today(
    course_id: Optional[uuid.UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get today's meetings."""
    svc = CalendarService(db, user)
    meetings = await svc.today(course_id=course_id)
    return success_response(meetings)


@calendar_router.get(
    "/upcoming",
    summary="Upcoming meetings",
    description="Meetings scheduled in the next N days (default 7).",
)
async def calendar_upcoming(
    days: int = Query(default=7, ge=1, le=30),
    course_id: Optional[uuid.UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get upcoming meetings."""
    svc = CalendarService(db, user)
    meetings = await svc.upcoming(days=days, course_id=course_id)
    return success_response(meetings)


@calendar_router.get(
    "/weekly",
    summary="Weekly calendar",
    description="Meetings grouped by day for a 7-day window starting at start_date.",
)
async def calendar_weekly(
    start_date: str = Query(
        default=None,
        description="ISO date string for week start (e.g. 2026-08-04). Defaults to current week Monday.",
    ),
    course_id: Optional[uuid.UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get weekly calendar view."""
    if start_date:
        dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    else:
        today = datetime.now(timezone.utc)
        dt = today - __import__("datetime").timedelta(days=today.weekday())
        dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)

    svc = CalendarService(db, user)
    days_data = await svc.weekly(start_date=dt, course_id=course_id)
    return success_response(days_data)


@calendar_router.get(
    "/monthly",
    summary="Monthly calendar",
    description="Meetings grouped by day for an entire calendar month.",
)
async def calendar_monthly(
    year: int = Query(default=None, ge=2020, le=2100),
    month: int = Query(default=None, ge=1, le=12),
    course_id: Optional[uuid.UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get monthly calendar view."""
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month

    svc = CalendarService(db, user)
    days_data = await svc.monthly(year=y, month=m, course_id=course_id)
    return success_response(days_data)


@calendar_router.get(
    "/past",
    summary="Past meetings",
    description="Completed and expired meetings, newest first, with pagination.",
)
async def calendar_past(
    course_id: Optional[uuid.UUID] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get past meetings list."""
    svc = CalendarService(db, user)
    meetings, total = await svc.past(
        course_id=course_id, page=page, page_size=page_size
    )
    return paginated_response(meetings, page=page, page_size=page_size, total=total)
