"""Teacher module — API router.

All endpoints in this module:
    - Require ``get_current_teacher`` (JWT + teacher role).
    - Are mounted under ``/api/v1/teacher``.
    - Return standardized JSON envelopes via the response helpers.
    - Business logic lives entirely in service.py.
    - Commit is handled by the database session context manager in
      ``get_db_session`` on successful return.

Endpoint groups:
    /teacher/dashboard                  Dashboard stats.
    /teacher/courses                    Course CRUD + lifecycle.
    /teacher/courses/{id}/videos        Video upload pipeline.
    /teacher/courses/{id}/pdfs          PDF upload pipeline.
    /teacher/courses/{id}/announcements Course announcements.
    /teacher/meetings                   Meeting scheduling.
    /teacher/students                   Student management.
    /teacher/attendance                 Attendance read + export.
    /teacher/analytics                  Charts + metrics.
    /teacher/profile                    Teacher profile.
    /teacher/categories                 Category lookup.
"""

from __future__ import annotations

import mimetypes
import traceback
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File as FastAPIFile
from fastapi.responses import JSONResponse, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis.client import get_redis
from app.core.storage import r2
from app.core.utils.response import (
    created_response,
    no_content_response,
    paginated_response,
    success_response,
)
from app.database import get_db_session
from app.models.user import User
from app.modules.teacher.dependencies import get_current_teacher
from app.modules.teacher.schemas import (
    AnalyticsQueryParams,
    BlockStudentRequest,
    ConfirmVideoUploadRequest,
    CourseFilterParams,
    CreateAnnouncementRequest,
    CreateCourseRequest,
    CreateMeetingRequest,
    CreatePDFRequest,
    CreateVideoRequest,
    MeetingFilterParams,
    PresignUploadRequest,
    ReorderRequest,
    StudentSearchParams,
    SuspendStudentRequest,
    UpdateAnnouncementRequest,
    UpdateCourseRequest,
    UpdateMeetingRequest,
    UpdatePDFRequest,
    UpdateTeacherProfileRequest,
    UpdateVideoRequest,
)
from app.modules.teacher.service import (
    AnalyticsService,
    AnnouncementService,
    AttendanceService,
    CourseService,
    DashboardService,
    MeetingService,
    ResourceService,
    StudentManagementService,
    TeacherProfileService,
)
from app.modules.teacher.repository import CourseCategoryRepository

router = APIRouter(prefix="/teacher", tags=["Teacher"])


# ===========================================================================
# DB Patch Diagnostic & Fix
# ===========================================================================

from sqlalchemy import text
from app.database import Base

@router.get("/db-patch", summary="Apply DB Schema Patches")
async def run_db_patches(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Run all missing table creations and column schema patches directly."""
    conn = await db.connection()
    await conn.run_sync(Base.metadata.create_all)
    patches = [
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS promo_video_r2_key VARCHAR(512);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_lectures SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_enrollments INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 50;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS section VARCHAR(200);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS hls_r2_key_prefix VARCHAR(512);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_width SMALLINT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_height SMALLINT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_error TEXT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS section VARCHAR(200);",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512);",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS page_count INTEGER;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS slow_mode_seconds SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS pinned_message_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36) DEFAULT NULL;",
    ]
    results = []
    for sql in patches:
        try:
            await db.execute(text(sql))
            await db.commit()
            results.append({"sql": sql, "status": "SUCCESS"})
        except Exception as e:
            await db.rollback()
            results.append({"sql": sql, "status": "ERROR", "error": str(e)})

    return success_response({"results": results})


# ===========================================================================
# Dashboard
# ===========================================================================


@router.get(
    "/dashboard",
    summary="Get teacher dashboard",
    description="Returns aggregated dashboard statistics including revenue, student count, today's meetings, and recent activity.",
    response_description="Teacher dashboard payload.",
)
async def get_dashboard(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return the full teacher dashboard payload."""
    svc = DashboardService(db, redis, teacher)
    data = await svc.get_dashboard()
    return success_response(data)


# ===========================================================================
# Categories (helper)
# ===========================================================================


@router.get(
    "/categories",
    summary="List all course categories",
    description="Returns all active platform categories for the course category picker.",
)
async def list_categories(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return all active categories."""
    repo = CourseCategoryRepository(db)
    categories = await repo.get_all_categories(active_only=True)
    data = [
        {
            "id": str(c.id),
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "icon": c.icon,
            "sort_order": c.sort_order,
            "is_active": c.is_active,
            "parent_id": str(c.parent_id) if c.parent_id else None,
        }
        for c in categories
    ]
    return success_response(data)


# ===========================================================================
# Courses
# ===========================================================================


@router.get(
    "/courses",
    summary="List teacher's courses",
    description="Returns a paginated list of all courses owned by the teacher. Supports filtering by status, visibility, and search.",
)
async def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List the teacher's courses with filters and pagination."""
    try:
        svc = CourseService(db, teacher)
        courses, total = await svc.list_courses(
            page=page,
            page_size=page_size,
            status=status,
            visibility=visibility,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        items = [
            {
                "id": str(c.id),
                "title": c.title,
                "slug": c.slug,
                "status": c.status,
                "visibility": c.visibility,
                "price": float(c.price),
                "thumbnail_r2_key": c.thumbnail_r2_key,
                "thumbnail_url": r2.get_public_url(c.thumbnail_r2_key),
                "total_enrollments": c.total_enrollments or 0,
                "max_students": c.max_students,
                "total_lectures": c.total_lectures,
                "level": c.level,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in courses
        ]
        return paginated_response(
            items, page=page, page_size=page_size, total=total
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc()})


@router.post(
    "/courses",
    summary="Create a new course",
    description="Creates a new course in DRAFT status. A chat room is automatically created for the course.",
    status_code=201,
)
async def create_course(
    body: CreateCourseRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a new course in draft status."""
    svc = CourseService(db, teacher)
    course = await svc.create_course(body)
    await db.commit()
    return created_response(
        {
            "id": str(course.id),
            "title": course.title,
            "slug": course.slug,
            "status": course.status,
            "visibility": course.visibility,
            "price": float(course.price),
            "created_at": course.created_at.isoformat(),
        },
        message="Course created successfully.",
    )


@router.get(
    "/courses/{course_id}",
    summary="Get course detail",
    description="Returns full course detail including categories, status, and metadata.",
)
async def get_course(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch full course detail."""
    svc = CourseService(db, teacher)
    course = await svc.get_course(course_id)
    cats = [
        {
            "id": str(cc.id),
            "category_id": str(cc.category_id),
            "is_primary": cc.is_primary,
            "category": {
                "id": str(cc.category.id),
                "name": cc.category.name,
                "slug": cc.category.slug,
            }
            if cc.category
            else None,
        }
        for cc in course.course_categories
    ]
    return success_response(
        {
            "id": str(course.id),
            "teacher_id": str(course.teacher_id),
            "title": course.title,
            "slug": course.slug,
            "description": course.description,
            "short_description": course.short_description,
            "thumbnail_r2_key": course.thumbnail_r2_key,
            "thumbnail_url": r2.get_public_url(course.thumbnail_r2_key),
            "price": float(course.price),
            "original_price": float(course.original_price) if course.original_price else None,
            "currency": course.currency,
            "status": course.status,
            "visibility": course.visibility,
            "level": course.level,
            "language": course.language,
            "total_duration_seconds": course.total_duration_seconds,
            "total_lectures": course.total_lectures,
            "total_enrollments": course.total_enrollments or 0,
            "max_students": course.max_students,
            "is_certificate_enabled": course.is_certificate_enabled,
            "metadata": course.metadata_,
            "published_at": course.published_at.isoformat() if course.published_at else None,
            "created_at": course.created_at.isoformat(),
            "updated_at": course.updated_at.isoformat(),
            "course_categories": cats,
        }
    )


@router.patch(
    "/courses/{course_id}",
    summary="Update course",
    description="Partial update of a course. All fields are optional.",
)
async def update_course(
    course_id: uuid.UUID,
    body: UpdateCourseRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Apply partial updates to a course."""
    svc = CourseService(db, teacher)
    course = await svc.update_course(course_id, body)
    await db.commit()
    return success_response(
        {"id": str(course.id), "title": course.title, "slug": course.slug, "status": course.status},
        message="Course updated successfully.",
    )


@router.delete(
    "/courses/{course_id}",
    summary="Delete course",
    description="Soft-deletes a course. Enrollment and payment history is preserved.",
    status_code=204,
)
async def delete_course(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Soft-delete a course."""
    svc = CourseService(db, teacher)
    await svc.delete_course(course_id)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/courses/{course_id}/publish",
    summary="Publish course",
    description="Transitions a course from DRAFT to PUBLISHED. Requires title, price, and at least one video.",
)
async def publish_course(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Publish a course."""
    svc = CourseService(db, teacher)
    course = await svc.publish_course(course_id)
    await db.commit()
    return success_response(
        {"id": str(course.id), "status": course.status, "published_at": course.published_at.isoformat()},
        message="Course published successfully.",
    )


@router.post(
    "/courses/{course_id}/unpublish",
    summary="Unpublish course",
    description="Reverts a published course back to DRAFT status.",
)
async def unpublish_course(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Unpublish a course back to draft."""
    svc = CourseService(db, teacher)
    course = await svc.unpublish_course(course_id)
    await db.commit()
    return success_response(
        {"id": str(course.id), "status": course.status},
        message="Course unpublished.",
    )


@router.post(
    "/courses/{course_id}/archive",
    summary="Archive course",
    description="Moves a course to ARCHIVED status. Hidden from students but data is preserved.",
)
async def archive_course(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Archive a course."""
    svc = CourseService(db, teacher)
    course = await svc.archive_course(course_id)
    await db.commit()
    return success_response(
        {"id": str(course.id), "status": course.status},
        message="Course archived.",
    )


@router.post(
    "/courses/{course_id}/thumbnail",
    summary="Get thumbnail upload URL",
    description="Generates a presigned R2 PUT URL for uploading a course thumbnail. Store the r2_key in the course after upload.",
)
async def get_thumbnail_upload_url(
    course_id: uuid.UUID,
    body: PresignUploadRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Generate a presigned URL for thumbnail upload."""
    svc = CourseService(db, teacher)
    result = await svc.get_thumbnail_presign_url(
        course_id, body.content_type, body.file_name
    )
    await db.commit()
    return success_response(result)


@router.post(
    "/courses/{course_id}/thumbnail/upload",
    summary="Direct thumbnail upload",
    description="Accepts a thumbnail image as multipart/form-data and stores it in R2 via the Cloudflare REST API.",
)
async def upload_thumbnail_direct(
    course_id: uuid.UUID,
    file: UploadFile = FastAPIFile(...),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Upload a course thumbnail to R2 via the Cloudflare REST API.

    Uses https://api.cloudflare.com (not r2.cloudflarestorage.com which has
    TLS handshake issues on Render's Python 3.13 + some network configurations).
    Requires CLOUDFLARE_API_TOKEN env var with R2 write permissions.
    """
    import logging
    import httpx
    _log = logging.getLogger(__name__)

    from app.core.storage.r2 import (
        ALLOWED_IMAGE_MIME_TYPES, make_thumbnail_key, ext_from_mime, get_public_url,
        _get_s3_client, _executor,
    )
    from app.config import get_settings

    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        if file.filename:
            guessed, _ = mimetypes.guess_type(file.filename)
            if guessed and guessed in ALLOWED_IMAGE_MIME_TYPES:
                content_type = guessed
            else:
                content_type = "image/jpeg"
        else:
            content_type = "image/jpeg"

    svc = CourseService(db, teacher)
    course = await svc.get_course(course_id)

    settings = get_settings()
    ext = ext_from_mime(content_type)
    r2_key = make_thumbnail_key(course_id, ext)
    raw_bytes = await file.read()

    _log.info("Uploading thumbnail direct for key=%r size=%d bytes", r2_key, len(raw_bytes))

    upload_success = False

    # Strategy 1: Standard boto3 S3 put_object (with addressing_style="path" and verify=False)
    def _put_boto3() -> None:
        _get_s3_client.cache_clear()
        client = _get_s3_client()
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=r2_key,
            Body=raw_bytes,
            ContentType=content_type,
        )

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _put_boto3)
        _log.info("Thumbnail uploaded successfully via boto3 path-style S3 API key=%r", r2_key)
        upload_success = True
    except Exception as s3_err:
        _log.warning("boto3 S3 upload failed (key=%r): %s. Trying REST API fallback...", r2_key, s3_err)

        # Strategy 2: Cloudflare REST API fallback (api.cloudflare.com)
        auth_headers: dict[str, str] = {}
        api_key = settings.CLOUDFLARE_API_KEY or (settings.CLOUDFLARE_API_TOKEN if settings.CLOUDFLARE_EMAIL else "")
        if api_key and settings.CLOUDFLARE_EMAIL:
            auth_headers = {
                "X-Auth-Key": api_key,
                "X-Auth-Email": settings.CLOUDFLARE_EMAIL,
            }
            _log.info("Using Global API Key auth (X-Auth-Key + X-Auth-Email) for REST API fallback")
        elif settings.CLOUDFLARE_API_TOKEN:
            auth_headers = {
                "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
            }
            _log.info("Using Bearer token auth for REST API fallback")

        if auth_headers:
            cf_api_url = (
                f"https://api.cloudflare.com/client/v4/accounts/{settings.R2_ACCOUNT_ID}"
                f"/r2/buckets/{settings.R2_BUCKET_NAME}/objects/{r2_key}"
            )
            try:
                async with httpx.AsyncClient(timeout=60.0, verify=False) as http:
                    response = await http.put(
                        cf_api_url,
                        content=raw_bytes,
                        headers={**auth_headers, "Content-Type": content_type},
                    )
                if response.status_code in (200, 201, 204):
                    _log.info("Thumbnail uploaded successfully via Cloudflare REST API key=%r", r2_key)
                    upload_success = True
                else:
                    _log.error("Cloudflare REST API upload failed key=%r status=%d body=%r", r2_key, response.status_code, response.text[:300])
            except Exception as rest_err:
                _log.error("Cloudflare REST API call error: %s", rest_err)

    import os, tempfile
    upload_dir = os.path.join(tempfile.gettempdir(), "uploads")
    local_dir = os.path.join(upload_dir, "thumbnails", "courses", str(course_id))
    try:
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, f"thumbnail.{ext}")
        with open(local_path, "wb") as f_out:
            f_out.write(raw_bytes)
        _log.info("Saved local thumbnail fallback to %r", local_path)
    except Exception as err:
        _log.warning("Could not write local thumbnail fallback: %s", err)

    # Record the key in the DB
    from app.modules.teacher.repository import CourseRepository
    repo = CourseRepository(db)
    await repo.update(course, thumbnail_r2_key=r2_key)
    await db.commit()

    if upload_success:
        public_url = get_public_url(r2_key)
    else:
        # Return local static URL until Cloudflare R2 S3 API SSL cert finishes provisioning
        public_url = f"https://speakarena.onrender.com/uploads/thumbnails/courses/{course_id}/thumbnail.{ext}"

    _log.info("Thumbnail upload complete key=%r url=%r", r2_key, public_url)

    return success_response({
        "r2_key": r2_key,
        "thumbnail_url": public_url,
    }, message="Thumbnail uploaded successfully.")


@router.get(
    "/courses/{course_id}/analytics",
    summary="Course analytics",
    description="Returns enrollment, revenue, and completion analytics for a specific course.",
)
async def get_course_analytics(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return analytics for a single course."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_course_analytics(course_id=course_id)
    return success_response(data)


# ===========================================================================
# Videos
# ===========================================================================


@router.get(
    "/courses/{course_id}/videos",
    summary="List course videos",
    description="Returns all active videos for a course, ordered by sort_order.",
)
async def list_videos(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all videos for a course."""
    # Validate course ownership
    svc = CourseService(db, teacher)
    await svc.get_course(course_id)  # raises CourseNotFoundError if not owned

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
            "r2_object_key": v.r2_object_key,
            "duration_seconds": v.duration_seconds,
            "file_size_bytes": v.file_size_bytes,
            "mime_type": v.mime_type,
            "processing_status": v.processing_status,
            "upload_status": v.upload_status,
            "visibility": v.visibility,
            "is_free_preview": v.is_free_preview,
            "created_at": v.created_at.isoformat(),
            "updated_at": v.updated_at.isoformat(),
        }
        for v in videos
    ]
    return success_response(data)


@router.post(
    "/courses/{course_id}/videos",
    summary="Create video + get upload URL",
    description="Creates a video record and returns a presigned R2 PUT URL. Upload the file directly to R2, then call /confirm.",
    status_code=201,
)
async def create_video(
    course_id: uuid.UUID,
    body: CreateVideoRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a video record and return the R2 presigned upload URL."""
    svc = ResourceService(db, teacher)
    result = await svc.create_video(course_id, body)
    await db.commit()
    video = result["video"]
    return created_response(
        {
            "video": {
                "id": str(video.id),
                "title": video.title,
                "r2_object_key": video.r2_object_key,
                "upload_status": video.upload_status,
                "processing_status": video.processing_status,
                "created_at": video.created_at.isoformat(),
            },
            "upload_url": result["upload_url"],
            "r2_key": result["r2_key"],
            "expires_in": result["expires_in"],
        },
        message="Video record created. Upload the file to the provided upload_url.",
    )


@router.get(
    "/courses/{course_id}/videos/{video_id}",
    summary="Get video detail",
)
async def get_video(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch a single video's metadata."""
    from app.modules.teacher.repository import VideoRepository
    from app.core.exceptions.errors import ResourceNotFoundError
    repo = VideoRepository(db)
    # Validate course ownership first
    course_svc = CourseService(db, teacher)
    await course_svc.get_course(course_id)
    video = await repo.get_by_id(video_id, course_id=course_id)
    if video is None:
        raise ResourceNotFoundError()
    return success_response(
        {
            "id": str(video.id),
            "course_id": str(video.course_id),
            "title": video.title,
            "description": video.description,
            "sort_order": video.sort_order,
            "section": video.section,
            "r2_object_key": video.r2_object_key,
            "hls_r2_key_prefix": video.hls_r2_key_prefix,
            "thumbnail_r2_key": video.thumbnail_r2_key,
            "duration_seconds": video.duration_seconds,
            "file_size_bytes": video.file_size_bytes,
            "mime_type": video.mime_type,
            "processing_status": video.processing_status,
            "upload_status": video.upload_status,
            "visibility": video.visibility,
            "is_free_preview": video.is_free_preview,
            "published_at": video.published_at.isoformat() if video.published_at else None,
            "created_at": video.created_at.isoformat(),
            "updated_at": video.updated_at.isoformat(),
        }
    )


@router.patch(
    "/courses/{course_id}/videos/{video_id}",
    summary="Update video metadata",
)
async def update_video(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    body: UpdateVideoRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update a video's metadata (title, visibility, sort order, etc.)."""
    svc = ResourceService(db, teacher)
    video = await svc.update_video(course_id, video_id, body)
    await db.commit()
    return success_response(
        {"id": str(video.id), "title": video.title, "visibility": video.visibility},
        message="Video updated.",
    )


@router.delete(
    "/courses/{course_id}/videos/{video_id}",
    summary="Delete video",
    description="Soft-deletes the video record and best-effort deletes the R2 object.",
    status_code=204,
)
async def delete_video(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete a video."""
    svc = ResourceService(db, teacher)
    await svc.delete_video(course_id, video_id)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/courses/{course_id}/videos/{video_id}/confirm",
    summary="Confirm video upload",
    description="Call this after a successful direct-to-R2 upload to mark the video as ready.",
)
async def confirm_video_upload(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    body: ConfirmVideoUploadRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a video upload as completed."""
    svc = ResourceService(db, teacher)
    video = await svc.confirm_video_upload(
        course_id, video_id, body.file_size_bytes, body.duration_seconds
    )
    await db.commit()
    return success_response(
        {
            "id": str(video.id),
            "upload_status": video.upload_status,
            "processing_status": video.processing_status,
            "file_size_bytes": video.file_size_bytes,
        },
        message="Upload confirmed.",
    )


@router.put(
    "/courses/{course_id}/videos/reorder",
    summary="Reorder videos",
    description="Bulk-update sort_order for all videos in a course.",
)
async def reorder_videos(
    course_id: uuid.UUID,
    body: ReorderRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Reorder videos within a course."""
    svc = ResourceService(db, teacher)
    items = [{"id": item.id, "sort_order": item.sort_order} for item in body.items]
    await svc.reorder_videos(course_id, items)
    await db.commit()
    return success_response(message="Videos reordered.")


# ===========================================================================
# PDFs
# ===========================================================================


@router.get(
    "/courses/{course_id}/pdfs",
    summary="List course PDFs",
)
async def list_pdfs(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all PDFs for a course."""
    course_svc = CourseService(db, teacher)
    await course_svc.get_course(course_id)

    from app.modules.teacher.repository import PDFRepository
    repo = PDFRepository(db)
    pdfs = await repo.list_by_course(course_id)
    data = [
        {
            "id": str(p.id),
            "title": p.title,
            "description": p.description,
            "sort_order": p.sort_order,
            "section": p.section,
            "r2_object_key": p.r2_object_key,
            "file_size_bytes": p.file_size_bytes,
            "page_count": p.page_count,
            "mime_type": p.mime_type,
            "is_downloadable": p.is_downloadable,
            "is_free_preview": p.is_free_preview,
            "visibility": p.visibility,
            "upload_status": p.upload_status,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat(),
        }
        for p in pdfs
    ]
    return success_response(data)


@router.post(
    "/courses/{course_id}/pdfs",
    summary="Create PDF + get upload URL",
    description="Creates a PDF record and returns a presigned R2 PUT URL.",
    status_code=201,
)
async def create_pdf(
    course_id: uuid.UUID,
    body: CreatePDFRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a PDF record and return the R2 presigned upload URL."""
    svc = ResourceService(db, teacher)
    result = await svc.create_pdf(course_id, body)
    await db.commit()
    pdf = result["pdf"]
    return created_response(
        {
            "pdf": {
                "id": str(pdf.id),
                "title": pdf.title,
                "r2_object_key": pdf.r2_object_key,
                "upload_status": pdf.upload_status,
                "file_size_bytes": pdf.file_size_bytes,
                "created_at": pdf.created_at.isoformat(),
            },
            "upload_url": result["upload_url"],
            "r2_key": result["r2_key"],
            "expires_in": result["expires_in"],
        },
        message="PDF record created. Upload the file to the provided upload_url.",
    )


@router.get(
    "/courses/{course_id}/pdfs/{pdf_id}",
    summary="Get PDF detail",
)
async def get_pdf(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch a single PDF record."""
    from app.modules.teacher.repository import PDFRepository
    from app.core.exceptions.errors import ResourceNotFoundError
    course_svc = CourseService(db, teacher)
    await course_svc.get_course(course_id)
    repo = PDFRepository(db)
    pdf = await repo.get_by_id(pdf_id, course_id=course_id)
    if pdf is None:
        raise ResourceNotFoundError()
    return success_response(
        {
            "id": str(pdf.id),
            "course_id": str(pdf.course_id),
            "title": pdf.title,
            "description": pdf.description,
            "sort_order": pdf.sort_order,
            "section": pdf.section,
            "r2_object_key": pdf.r2_object_key,
            "file_size_bytes": pdf.file_size_bytes,
            "page_count": pdf.page_count,
            "mime_type": pdf.mime_type,
            "is_downloadable": pdf.is_downloadable,
            "is_free_preview": pdf.is_free_preview,
            "visibility": pdf.visibility,
            "upload_status": pdf.upload_status,
            "created_at": pdf.created_at.isoformat(),
            "updated_at": pdf.updated_at.isoformat(),
        }
    )


@router.patch(
    "/courses/{course_id}/pdfs/{pdf_id}",
    summary="Update PDF metadata",
)
async def update_pdf(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    body: UpdatePDFRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update PDF metadata."""
    svc = ResourceService(db, teacher)
    pdf = await svc.update_pdf(course_id, pdf_id, body)
    await db.commit()
    return success_response(
        {"id": str(pdf.id), "title": pdf.title, "visibility": pdf.visibility},
        message="PDF updated.",
    )


@router.delete(
    "/courses/{course_id}/pdfs/{pdf_id}",
    summary="Delete PDF",
    status_code=204,
)
async def delete_pdf(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Soft-delete a PDF and delete from R2."""
    svc = ResourceService(db, teacher)
    await svc.delete_pdf(course_id, pdf_id)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/courses/{course_id}/pdfs/{pdf_id}/confirm",
    summary="Confirm PDF upload",
)
async def confirm_pdf_upload(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    page_count: Optional[int] = Query(default=None, ge=1),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a PDF upload as completed."""
    svc = ResourceService(db, teacher)
    pdf = await svc.confirm_pdf_upload(course_id, pdf_id, page_count=page_count)
    await db.commit()
    return success_response(
        {"id": str(pdf.id), "upload_status": pdf.upload_status, "page_count": pdf.page_count},
        message="PDF upload confirmed.",
    )


@router.put(
    "/courses/{course_id}/pdfs/reorder",
    summary="Reorder PDFs",
)
async def reorder_pdfs(
    course_id: uuid.UUID,
    body: ReorderRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Reorder PDFs within a course."""
    svc = ResourceService(db, teacher)
    items = [{"id": item.id, "sort_order": item.sort_order} for item in body.items]
    await svc.reorder_pdfs(course_id, items)
    await db.commit()
    return success_response(message="PDFs reordered.")


# ===========================================================================
# Announcements
# ===========================================================================


@router.get(
    "/courses/{course_id}/announcements",
    summary="List course announcements",
    description="Returns paginated announcements for a course (newest first).",
)
async def list_announcements(
    course_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List announcements for a course."""
    svc = AnnouncementService(db, teacher)
    announcements, total = await svc.list_announcements(course_id, page, page_size)
    items = [
        {
            "id": str(a.id),
            "chat_room_id": str(a.chat_room_id),
            "sender_id": str(a.sender_id),
            "content": a.content,
            "is_pinned": a.is_pinned,
            "is_edited": a.is_edited,
            "edited_at": a.edited_at.isoformat() if a.edited_at else None,
            "pinned_at": a.pinned_at.isoformat() if a.pinned_at else None,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
        }
        for a in announcements
    ]
    return paginated_response(items, page=page, page_size=page_size, total=total)


@router.post(
    "/courses/{course_id}/announcements",
    summary="Create announcement",
    status_code=201,
)
async def create_announcement(
    course_id: uuid.UUID,
    body: CreateAnnouncementRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Post a new announcement in the course chat room."""
    svc = AnnouncementService(db, teacher)
    msg = await svc.create_announcement(course_id, body)
    await db.commit()
    return created_response(
        {
            "id": str(msg.id),
            "content": msg.content,
            "is_pinned": msg.is_pinned,
            "created_at": msg.created_at.isoformat(),
        },
        message="Announcement created.",
    )


@router.patch(
    "/courses/{course_id}/announcements/{announcement_id}",
    summary="Update announcement",
)
async def update_announcement(
    course_id: uuid.UUID,
    announcement_id: uuid.UUID,
    body: UpdateAnnouncementRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update an announcement's content or pin status."""
    svc = AnnouncementService(db, teacher)
    msg = await svc.update_announcement(course_id, announcement_id, body)
    await db.commit()
    return success_response(
        {"id": str(msg.id), "content": msg.content, "is_pinned": msg.is_pinned},
        message="Announcement updated.",
    )


@router.delete(
    "/courses/{course_id}/announcements/{announcement_id}",
    summary="Delete announcement",
    status_code=204,
)
async def delete_announcement(
    course_id: uuid.UUID,
    announcement_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Soft-delete an announcement."""
    svc = AnnouncementService(db, teacher)
    await svc.delete_announcement(course_id, announcement_id)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/courses/{course_id}/announcements/{announcement_id}/pin",
    summary="Pin announcement",
)
async def pin_announcement(
    course_id: uuid.UUID,
    announcement_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Pin an announcement."""
    svc = AnnouncementService(db, teacher)
    msg = await svc.pin_announcement(course_id, announcement_id, pin=True)
    await db.commit()
    return success_response(
        {"id": str(msg.id), "is_pinned": msg.is_pinned},
        message="Announcement pinned.",
    )


@router.post(
    "/courses/{course_id}/announcements/{announcement_id}/unpin",
    summary="Unpin announcement",
)
async def unpin_announcement(
    course_id: uuid.UUID,
    announcement_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Unpin an announcement."""
    svc = AnnouncementService(db, teacher)
    msg = await svc.pin_announcement(course_id, announcement_id, pin=False)
    await db.commit()
    return success_response(
        {"id": str(msg.id), "is_pinned": msg.is_pinned},
        message="Announcement unpinned.",
    )


# ===========================================================================
# Meetings
# ===========================================================================


@router.get(
    "/meetings",
    summary="List meetings",
    description="Returns paginated meetings. Filter by course, status, or upcoming only.",
)
async def list_meetings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    course_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    upcoming_only: bool = Query(False),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List teacher's meetings."""
    try:
        svc = MeetingService(db, teacher)
        meetings, total = await svc.list_meetings(
            page=page,
            page_size=page_size,
            course_id=course_id,
            status=status,
            upcoming_only=upcoming_only,
        )
        items = [
            {
                "id": str(m.id),
                "course_id": str(m.course_id),
                "course_title": (m.course.title if ("course" in m.__dict__ and m.course) else "Course Session"),
                "title": m.title,
                "status": m.status,
                "scheduled_at": m.scheduled_at.isoformat(),
                "duration_minutes": m.duration_minutes,
                "meet_link": m.meet_link,
                "provider": getattr(m, "provider", "google_meet"),
                "created_at": m.created_at.isoformat(),
            }
            for m in meetings
        ]
        return paginated_response(items, page=page, page_size=page_size, total=total)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc()})


@router.post(
    "/meetings",
    summary="Create meeting",
    description="Schedule a new live class meeting.",
    status_code=201,
)
async def create_meeting(
    body: CreateMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a new scheduled meeting."""
    svc = MeetingService(db, teacher)
    meeting = await svc.create_meeting(body)
    await db.commit()
    return created_response(
        {
            "id": str(meeting.id),
            "course_id": str(meeting.course_id),
            "title": meeting.title,
            "status": meeting.status,
            "scheduled_at": meeting.scheduled_at.isoformat(),
            "duration_minutes": meeting.duration_minutes,
            "meet_link": meeting.meet_link,
            "created_at": meeting.created_at.isoformat(),
        },
        message="Meeting created.",
    )


@router.get(
    "/meetings/{meeting_id}",
    summary="Get meeting detail",
)
async def get_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch full meeting detail."""
    svc = MeetingService(db, teacher)
    m = await svc.get_meeting(meeting_id)
    return success_response(
        {
            "id": str(m.id),
            "course_id": str(m.course_id),
            "teacher_id": str(m.teacher_id),
            "title": m.title,
            "description": m.description,
            "meet_link": m.meet_link,
            "provider": getattr(m, "provider", "google_meet"),
            "scheduled_at": m.scheduled_at.isoformat(),
            "duration_minutes": m.duration_minutes,
            "actual_started_at": m.actual_started_at.isoformat() if getattr(m, "actual_started_at", None) else None,
            "actual_ended_at": m.actual_ended_at.isoformat() if getattr(m, "actual_ended_at", None) else None,
            "status": m.status,
            "max_participants": getattr(m, "max_participants", None),
            "recording_r2_key": m.recording_r2_key,
            "reminder_sent": m.reminder_sent,
            "created_at": m.created_at.isoformat(),
            "updated_at": m.updated_at.isoformat(),
        }
    )


@router.patch(
    "/meetings/{meeting_id}",
    summary="Update meeting",
)
async def update_meeting(
    meeting_id: uuid.UUID,
    body: UpdateMeetingRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Apply partial updates to a meeting."""
    svc = MeetingService(db, teacher)
    meeting = await svc.update_meeting(meeting_id, body)
    await db.commit()
    return success_response(
        {"id": str(meeting.id), "title": meeting.title, "status": meeting.status},
        message="Meeting updated.",
    )


@router.delete(
    "/meetings/{meeting_id}",
    summary="Delete meeting",
    status_code=204,
)
async def delete_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Soft-delete a meeting."""
    svc = MeetingService(db, teacher)
    await svc.delete_meeting(meeting_id)
    await db.commit()
    return Response(status_code=204)


@router.post(
    "/meetings/{meeting_id}/cancel",
    summary="Cancel meeting",
)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Cancel a scheduled or live meeting."""
    svc = MeetingService(db, teacher)
    meeting = await svc.cancel_meeting(meeting_id)
    await db.commit()
    return success_response(
        {"id": str(meeting.id), "status": meeting.status},
        message="Meeting cancelled.",
    )


@router.post(
    "/meetings/{meeting_id}/start",
    summary="Start meeting",
    description="Mark a meeting as live.",
)
async def start_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a meeting as live."""
    svc = MeetingService(db, teacher)
    meeting = await svc.start_meeting(meeting_id)
    await db.commit()
    return success_response(
        {
            "id": str(meeting.id),
            "status": meeting.status,
            "actual_started_at": meeting.actual_started_at.isoformat() if meeting.actual_started_at else None,
        },
        message="Meeting started.",
    )


@router.post(
    "/meetings/{meeting_id}/end",
    summary="End meeting",
    description="Mark a live meeting as completed.",
)
async def end_meeting(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a meeting as completed."""
    svc = MeetingService(db, teacher)
    meeting = await svc.end_meeting(meeting_id)
    await db.commit()
    return success_response(
        {
            "id": str(meeting.id),
            "status": meeting.status,
            "actual_ended_at": meeting.actual_ended_at.isoformat() if meeting.actual_ended_at else None,
        },
        message="Meeting ended.",
    )


@router.get(
    "/meetings/{meeting_id}/attendance",
    summary="Meeting attendance",
    description="Returns attendance records for a specific meeting.",
)
async def get_meeting_attendance(
    meeting_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return attendance for a meeting."""
    svc = AttendanceService(db, teacher)
    records = await svc.get_meeting_attendance(meeting_id)
    return success_response(records)


# ===========================================================================
# Students
# ===========================================================================


@router.get(
    "/students",
    summary="List enrolled students",
    description="Returns paginated list of students enrolled in teacher's courses. Supports search by name/email and filtering by course.",
)
async def list_students(
    params: StudentSearchParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List enrolled students."""
    svc = StudentManagementService(db, teacher)
    students, total = await svc.list_students(
        page=params.page,
        page_size=params.page_size,
        search=params.search,
        course_id=params.course_id,
        is_active=params.is_active,
    )
    return paginated_response(students, page=params.page, page_size=params.page_size, total=total)


@router.get(
    "/all-students",
    summary="List all platform students",
    description="Returns directory of all registered students for teacher DMs.",
)
async def list_all_students(
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all platform students for teacher DMs."""
    svc = StudentManagementService(db, teacher)
    students, total = await svc.list_all_students_directory(
        page=page,
        page_size=page_size,
        search=search,
    )
    return paginated_response(students, page=page, page_size=page_size, total=total)



@router.get(
    "/students/{student_id}",
    summary="Student detail",
    description="Returns full student profile with all enrollments in teacher's courses.",
)
async def get_student(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch a student's full profile."""
    svc = StudentManagementService(db, teacher)
    data = await svc.get_student_detail(student_id)
    return success_response(data)


@router.post(
    "/students/{student_id}/suspend",
    summary="Suspend student from course",
)
async def suspend_student(
    student_id: uuid.UUID,
    body: Optional[SuspendStudentRequest] = None,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Suspend a student from a specific course (or all teacher courses if omitted)."""
    svc = StudentManagementService(db, teacher)
    course_id = body.course_id if body else None
    reason = body.reason if body else None
    await svc.suspend_student(student_id, course_id, reason=reason)
    await db.commit()
    return success_response(message="Student suspended successfully.")


@router.post(
    "/students/{student_id}/unsuspend",
    summary="Unsuspend student",
)
async def unsuspend_student(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = Query(default=None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Restore a suspended student's course access."""
    svc = StudentManagementService(db, teacher)
    await svc.unsuspend_student(student_id, course_id)
    await db.commit()
    return success_response(message="Student access restored.")


@router.post(
    "/students/{student_id}/unenroll",
    summary="Unenroll student from course",
    description="Completely unenrolls a student from a specific course.",
)
async def unenroll_student(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = Query(default=None, description="Course ID to unenroll student from."),
    reason: Optional[str] = Query(default=None, description="Optional unenrollment reason."),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Unenroll a student from a course."""
    svc = StudentManagementService(db, teacher)
    await svc.unenroll_student(student_id, course_id, reason=reason)
    await db.commit()
    return success_response(message="Student unenrolled from course successfully.")


@router.post(
    "/students/{student_id}/block",
    summary="Block student",
    description="Deactivates the student's account across all courses.",
)
async def block_student(
    student_id: uuid.UUID,
    body: BlockStudentRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Block a student account."""
    svc = StudentManagementService(db, teacher)
    await svc.block_student(student_id, reason=body.reason)
    await db.commit()
    return success_response(message="Student account blocked.")


@router.post(
    "/students/{student_id}/unblock",
    summary="Unblock student",
    description="Reactivates a blocked student account.",
)
async def unblock_student(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Unblock a student account."""
    svc = StudentManagementService(db, teacher)
    await svc.unblock_student(student_id)
    await db.commit()
    return success_response(message="Student account reactivated.")


@router.get(
    "/students/{student_id}/payments",
    summary="Student payment history",
    description="Returns all payments from a student for the teacher's courses.",
)
async def get_student_payments(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return a student's payment history."""
    svc = StudentManagementService(db, teacher)
    payments = await svc.get_payment_history(student_id)
    data = [
        {
            "id": str(p.id),
            "course_id": str(p.course_id),
            "amount": float(p.amount),
            "currency": p.currency,
            "status": p.status,
            "razorpay_order_id": p.razorpay_order_id,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "created_at": p.created_at.isoformat(),
        }
        for p in payments
    ]
    return success_response(data)


@router.get(
    "/students/{student_id}/attendance",
    summary="Student attendance history",
)
async def get_student_attendance(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = Query(default=None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return attendance history for a student."""
    from app.modules.teacher.repository import AttendanceRepository
    repo = AttendanceRepository(db)
    rows = await repo.get_by_student(student_id, course_id=course_id)
    data = [
        {
            "meeting_id": str(att.meeting_id),
            "meeting_title": meeting.title,
            "scheduled_at": meeting.scheduled_at.isoformat(),
            "status": att.status,
            "join_time": att.join_time.isoformat() if att.join_time else None,
            "leave_time": att.leave_time.isoformat() if att.leave_time else None,
            "total_duration_seconds": att.total_duration_seconds,
            "attendance_percentage": float(att.attendance_percentage),
            "is_late": att.is_late,
        }
        for att, meeting in rows
    ]
    return success_response(data)


# ===========================================================================
# Attendance
# ===========================================================================


@router.get(
    "/attendance/summary",
    summary="Attendance summary",
    description="Returns aggregate attendance statistics across all teacher meetings.",
)
async def get_attendance_summary(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return overall attendance analytics."""
    svc = AttendanceService(db, teacher)
    data = await svc.get_attendance_summary()
    return success_response(data)


@router.get(
    "/attendance/export",
    summary="Export attendance CSV",
    description="Returns a CSV file with attendance data for a specific meeting.",
    response_class=Response,
)
async def export_attendance_csv(
    meeting_id: uuid.UUID = Query(..., description="Meeting ID to export attendance for."),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export attendance as CSV."""
    svc = AttendanceService(db, teacher)
    csv_content = await svc.export_attendance_csv(meeting_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="attendance_{meeting_id}.csv"'
        },
    )


# ===========================================================================
# Analytics
# ===========================================================================


@router.get(
    "/analytics/revenue",
    summary="Revenue analytics",
    description="Returns revenue time-series and totals for the selected period.",
)
async def get_revenue_analytics(
    params: AnalyticsQueryParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return revenue analytics."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_revenue_analytics(params.period, params.course_id)
    return success_response(data)


@router.get(
    "/analytics/enrollments",
    summary="Enrollment analytics",
    description="Returns enrollment time-series for the selected period.",
)
async def get_enrollment_analytics(
    params: AnalyticsQueryParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return enrollment analytics."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_enrollment_analytics(params.period, params.course_id)
    return success_response(data)


@router.get(
    "/analytics/attendance",
    summary="Attendance analytics",
    description="Returns aggregate attendance rates across all meetings.",
)
async def get_attendance_analytics(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return attendance analytics."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_attendance_analytics()
    return success_response(data)


@router.get(
    "/analytics/courses",
    summary="Course performance analytics",
    description="Returns per-course analytics: enrollments, revenue, average progress, and completion rate.",
)
async def get_course_performance_analytics(
    params: AnalyticsQueryParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return per-course performance analytics."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_course_analytics(params.course_id)
    return success_response(data)


# ===========================================================================
# Teacher Profile
# ===========================================================================


@router.get(
    "/profile",
    summary="Get teacher profile",
    description="Returns the teacher's profile including bio, social links, and aggregated stats.",
)
async def get_teacher_profile(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Fetch the teacher's own profile."""
    svc = TeacherProfileService(db, teacher)
    data = await svc.get_profile()
    return success_response(data)


@router.patch(
    "/profile",
    summary="Update teacher profile",
    description="Partial update of teacher profile fields.",
)
async def update_teacher_profile(
    body: UpdateTeacherProfileRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update the teacher's profile."""
    svc = TeacherProfileService(db, teacher)
    data = await svc.update_profile(body)
    await db.commit()
    return success_response(data, message="Profile updated.")


@router.post(
    "/profile/avatar",
    summary="Get avatar upload URL",
    description="Generates a presigned R2 PUT URL for uploading a profile avatar image.",
)
async def get_avatar_upload_url(
    body: PresignUploadRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Generate a presigned URL for avatar upload."""
    svc = TeacherProfileService(db, teacher)
    result = await svc.get_avatar_presign_url(body.content_type, body.file_name)
    await db.commit()
    return success_response(result)
