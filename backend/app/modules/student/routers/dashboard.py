"""Student dashboard router.

Mounts at /api/v1/student — provides the single dashboard endpoint
that aggregates all student portal sections.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis.client import get_redis
from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.service import DashboardService, SearchService
from app.modules.student.schemas import SearchParams

router = APIRouter(prefix="/student", tags=["Student - Dashboard"])


@router.get(
    "/dashboard",
    summary="Student dashboard",
    description=(
        "Returns all dashboard sections: welcome, enrolled courses, continue learning, "
        "upcoming meetings, recent announcements, notifications, attendance summary, "
        "and recent payments."
    ),
)
async def get_dashboard(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return the full student dashboard payload."""
    svc = DashboardService(db, redis, student)
    data = await svc.get_dashboard()
    return success_response(data)


@router.get(
    "/search",
    summary="Global search",
    description=(
        "Search across all enrolled courses, videos, PDFs, and meetings. "
        "Results are strictly scoped to the student's active enrollments."
    ),
)
async def global_search(
    params: SearchParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Search across all enrolled content."""
    svc = SearchService(db, student)
    data = await svc.search(
        query=params.q,
        entity=params.entity,
        page=params.page,
        page_size=params.page_size,
    )
    return success_response(data)
