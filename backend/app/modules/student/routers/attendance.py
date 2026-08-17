"""Student attendance router.

Mounts at /api/v1/attendance — provides the student's own
attendance history, summary stats, and per-course analytics.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import AttendanceFilterParams
from app.modules.student.service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Student - Attendance"])


@router.get(
    "",
    summary="List attendance records",
    description=(
        "Returns the student's attendance records across all enrolled courses. "
        "Filter by course or attendance status (present|absent|late|partial)."
    ),
)
async def list_attendance(
    filters: AttendanceFilterParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return paginated attendance records."""
    svc = AttendanceService(db, student)
    records, total = await svc.list_attendance(
        page=filters.page,
        page_size=filters.page_size,
        course_id=filters.course_id,
        status=filters.status,
    )
    return paginated_response(
        records, page=filters.page, page_size=filters.page_size, total=total
    )


@router.get(
    "/summary",
    summary="Attendance summary",
    description=(
        "Returns aggregate attendance stats: total meetings, attended, absent, late, "
        "and overall attendance percentage. Optionally filter by course."
    ),
)
async def get_attendance_summary(
    course_id: Optional[uuid.UUID] = Query(default=None),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return attendance summary statistics."""
    svc = AttendanceService(db, student)
    data = await svc.get_summary(course_id=course_id)
    return success_response(data)
