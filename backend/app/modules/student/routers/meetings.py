"""Student meetings router.

Mounts at /api/v1/meetings — provides meeting list and detail.

Critical security constraint:
    Google Meet links are ONLY returned when:
    1. Student has an active enrollment in the course.
    2. Meeting status is SCHEDULED or LIVE.
    All other cases return meet_link: null.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import MeetingFilterParams
from app.modules.student.service import MeetingService

router = APIRouter(prefix="/meetings", tags=["Student - Meetings"])


@router.get(
    "",
    summary="List meetings",
    description=(
        "Returns paginated meetings for all enrolled courses. "
        "Filter by course, upcoming only, or history only. "
        "Meet links are only returned for SCHEDULED and LIVE meetings."
    ),
)
async def list_meetings(
    filters: MeetingFilterParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List meetings for enrolled courses with meet link gating."""
    svc = MeetingService(db, student)
    meetings, total = await svc.list_meetings(
        page=filters.page,
        page_size=filters.page_size,
        course_id=filters.course_id,
        upcoming_only=filters.upcoming_only,
        history_only=filters.history_only,
    )
    return paginated_response(
        meetings, page=filters.page, page_size=filters.page_size, total=total
    )


@router.get(
    "/{meeting_id}",
    summary="Meeting detail",
    description=(
        "Returns full meeting detail. The meet_link field is ONLY populated "
        "when the student is actively enrolled AND the meeting status is SCHEDULED or LIVE. "
        "Accessing an active meet link is logged in the audit trail."
    ),
)
async def get_meeting(
    meeting_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return full meeting detail with meet link gating."""
    svc = MeetingService(db, student)
    data = await svc.get_meeting_detail(meeting_id)
    await db.commit()  # Flush audit log if meet link was accessed
    return success_response(data)
