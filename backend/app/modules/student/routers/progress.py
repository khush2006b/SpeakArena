"""Student progress router.

Mounts at /api/v1/progress — exposes course-level and content-level
progress data for the learning page and course detail page.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.course import Course
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.service import ProgressService

router = APIRouter(prefix="/progress", tags=["Student - Progress"])


@router.get(
    "/{course_id}",
    summary="Course progress",
    description=(
        "Returns aggregated progress summary for the student in a specific course: "
        "completion percentage, completed lecture count, total watch time, "
        "last activity, and the next recommended video."
    ),
)
async def get_course_progress(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return course-level progress summary."""
    svc = ProgressService(db, student)
    data = await svc.get_course_progress(course_id)

    # Enrich with total_lectures from Course
    course_row = await db.execute(
        select(Course.total_lectures).where(Course.id == course_id)
    )
    total_lectures = course_row.scalar_one_or_none() or 0
    data["total_lectures"] = total_lectures

    return success_response(data)
