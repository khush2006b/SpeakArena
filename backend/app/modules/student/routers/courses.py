"""Student courses router.

Mounts at /api/v1/courses — provides enrolled course listing,
detail page, announcements, and curriculum access.
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
from app.modules.student.schemas import CourseSearchParams
from app.modules.student.service import CourseService

router = APIRouter(prefix="/courses", tags=["Student - Courses"])


@router.get(
    "",
    summary="List enrolled courses",
    description=(
        "Returns paginated list of all courses the student is enrolled in. "
        "Supports search by title, filtering by status, progress, and sorting."
    ),
)
async def list_courses(
    params: CourseSearchParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List enrolled courses with filters and pagination."""
    svc = CourseService(db, student)
    courses, total = await svc.list_courses(
        page=params.page,
        page_size=params.page_size,
        search=params.search,
        status=params.status,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
        only_in_progress=params.only_in_progress,
        only_completed=params.only_completed,
    )
    return paginated_response(courses, page=params.page, page_size=params.page_size, total=total)


@router.get(
    "/recently-viewed",
    summary="Recently viewed courses",
    description="Returns the last 5 courses the student accessed content from.",
)
async def recently_viewed(
    limit: int = Query(default=5, ge=1, le=20),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return recently viewed courses."""
    svc = CourseService(db, student)
    data = await svc.get_recently_viewed(limit=limit)
    return success_response(data)


@router.get(
    "/{course_id}",
    summary="Course detail",
    description=(
        "Returns full course detail including teacher info, curriculum overview, "
        "and the student's enrollment and progress data."
    ),
)
async def get_course(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return full course detail for an enrolled student."""
    svc = CourseService(db, student)
    data = await svc.get_course_detail(course_id)
    await db.commit()
    return success_response(data)


@router.get(
    "/{course_id}/announcements",
    summary="Course announcements",
    description="Returns paginated pinned announcements from the course chat room.",
)
async def list_announcements(
    course_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List announcements for a course."""
    from app.modules.student.repository import StudentEnrollmentRepository
    from app.core.exceptions.errors import EnrollmentNotFoundError
    from sqlalchemy import select, and_, func
    from app.models.chat import ChatRoom, Message
    from app.models.course import Course
    from app.models.user import User as UserModel

    # Validate enrollment
    enroll_repo = StudentEnrollmentRepository(db)
    enrollment = await enroll_repo.get_active_enrollment(student.id, course_id)
    if enrollment is None:
        raise EnrollmentNotFoundError()

    # Get announcements
    cond = and_(
        Message.chat_room_id.in_(
            select(ChatRoom.id).where(ChatRoom.course_id == course_id)
        ),
        Message.is_announcement.is_(True),
        Message.deleted_at.is_(None),
    )
    from sqlalchemy import desc
    total_stmt = select(func.count(Message.id)).where(cond)
    total: int = (await db.execute(total_stmt)).scalar_one()

    data_stmt = (
        select(
            Message.id,
            Message.content,
            Message.is_pinned,
            Message.created_at,
            UserModel.full_name.label("sender_name"),
        )
        .join(UserModel, UserModel.id == Message.sender_id)
        .where(cond)
        .order_by(desc(Message.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(data_stmt)).all()
    items = [
        {
            "id": r.id,
            "content": r.content,
            "is_pinned": r.is_pinned,
            "created_at": r.created_at,
            "sender_name": r.sender_name,
        }
        for r in rows
    ]
    return paginated_response(items, page=page, page_size=page_size, total=total)
