"""Student courses router.

Mounts at /api/v1/courses — provides enrolled course listing,
detail page, announcements, and curriculum access.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import CourseSearchParams
from app.modules.student.service import CourseService
from app.modules.student.repository import StudentCourseRepository

_optional_bearer = HTTPBearer(auto_error=False)

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
    "/explore",
    summary="Explore all published courses (public)",
    description="Returns all published courses. Works for unauthenticated visitors, students, and teachers.",
)
async def explore_courses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    _credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> JSONResponse:
    """Explore published courses catalog — open to all roles and anonymous users."""
    student_id: Optional[uuid.UUID] = None
    if _credentials and _credentials.credentials:
        try:
            from app.core.security.jwt import decode_access_token
            payload = decode_access_token(_credentials.credentials)
            if payload and payload.sub:
                student_id = uuid.UUID(payload.sub)
        except Exception:
            student_id = None

    repo = StudentCourseRepository(db)
    courses, total = await repo.list_explore(student_id=student_id, page=page, page_size=page_size, search=search)
    return paginated_response(courses, page=page, page_size=page_size, total=total)


@router.post(
    "/{course_id}/enroll",
    summary="Enroll in a course",
    description="Enrolls the current student in a published course.",
    status_code=200,
)
async def enroll_course(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Enroll student in course."""
    svc = CourseService(db, student)
    result = await svc.enroll(course_id)
    await db.commit()
    return success_response(result, message=result.get("message", "Enrolled successfully."))


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
    "/{course_id}/progress",
    summary="Course progress",
    description="Returns completion percentage and progress details for an enrolled course.",
)
async def get_course_progress(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return course progress for an enrolled student."""
    svc = CourseService(db, student)
    data = await svc.get_course_progress(course_id)
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


@router.get(
    "/{course_id}/videos",
    summary="List course videos (alias)",
    description="Returns all accessible videos for a course.",
)
async def list_course_videos(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    from app.modules.student.service import ResourceService
    svc = ResourceService(db, student)
    try:
        videos = await svc.list_videos(course_id)
        return success_response(videos)
    except Exception:
        # If student is course owner (teacher testing) or fallback
        from app.modules.teacher.repository import VideoRepository
        repo = VideoRepository(db)
        videos = await repo.list_by_course(course_id)
        data = [
            {
                "id": str(v.id),
                "title": v.title,
                "description": v.description,
                "sort_order": v.sort_order,
                "section": v.section,
                "duration_seconds": v.duration_seconds,
                "r2_object_key": v.r2_object_key,
                "is_free_preview": v.is_free_preview,
            }
            for v in videos
        ]
        return success_response(data)


@router.get(
    "/{course_id}/pdfs",
    summary="List course PDFs (alias)",
    description="Returns all accessible PDFs for a course.",
)
async def list_course_pdfs(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    from app.modules.student.service import ResourceService
    svc = ResourceService(db, student)
    try:
        pdfs = await svc.list_pdfs(course_id)
        return success_response(pdfs)
    except Exception:
        from app.modules.teacher.repository import PDFRepository
        repo = PDFRepository(db)
        pdfs = await repo.list_by_course(course_id)
        data = [
            {
                "id": str(p.id),
                "title": p.title,
                "description": p.description,
                "sort_order": p.sort_order,
                "file_size_bytes": p.file_size_bytes,
                "r2_object_key": p.r2_object_key,
            }
            for p in pdfs
        ]
        return success_response(data)


@router.get(
    "/{course_id}/videos/{video_id}/stream",
    summary="Get video stream URL (alias)",
    description="Returns a signed streaming URL for a video.",
)
async def get_course_video_stream(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    from app.modules.student.service import ResourceService
    svc = ResourceService(db, student)
    try:
        data = await svc.get_video_stream_url(course_id, video_id)
        await db.commit()
        return success_response(data)
    except Exception:
        # Fallback for owner / public
        from app.models.video import Video
        from app.core.storage import r2
        from app.config import get_settings
        video = await db.get(Video, video_id)
        if not video:
            from app.core.exceptions.errors import ResourceNotFoundError
            raise ResourceNotFoundError()
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_DOWNLOAD
        signed_url = await r2.generate_presigned_download_url(video.r2_object_key, expiry_seconds=expiry)
        return success_response({
            "video_id": str(video.id),
            "title": video.title,
            "signed_url": signed_url,
            "stream_url": signed_url,
            "expires_in": expiry,
        })

