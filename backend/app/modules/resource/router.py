"""Resource module — router.

Mounts at /api/v1/videos, /api/v1/pdfs, /api/v1/storage.

Video Endpoints (Teacher):
    POST /videos/initiate-upload          Initiate video upload presign.
    POST /videos/confirm-upload           Confirm video uploaded to R2.
    GET  /videos/{course_id}              List videos for a course.
    GET  /videos/{course_id}/{video_id}   Video metadata.
    PATCH /videos/{video_id}              Update video metadata.
    POST /videos/{video_id}/publish       Publish a video.
    DELETE /videos/{video_id}             Soft-delete a video.
    POST /videos/{course_id}/reorder      Bulk reorder videos.

Video Endpoints (Student):
    GET  /videos/{course_id}/{video_id}/stream  Get streaming URL.
    POST /videos/{video_id}/progress            Update watch progress.
    GET  /videos/recently-watched               Continue watching list.

PDF Endpoints (Teacher):
    POST /pdfs/initiate-upload            Initiate PDF upload presign.
    POST /pdfs/confirm-upload             Confirm PDF uploaded.
    GET  /pdfs/{course_id}               List PDFs for a course.
    PATCH /pdfs/{pdf_id}                 Update PDF metadata.
    DELETE /pdfs/{pdf_id}                Soft-delete a PDF.
    POST /pdfs/{course_id}/reorder        Bulk reorder PDFs.

PDF Endpoints (Student):
    GET  /pdfs/{pdf_id}/access            Get presigned download/view URL.

Storage Endpoints (Teacher):
    GET  /storage/{course_id}/stats       Storage statistics.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis.client import get_redis
from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import (
    get_current_student,
    get_current_teacher,
    get_current_user,
)
from app.modules.resource.schemas import (
    ConfirmPDFUploadRequest,
    ConfirmVideoUploadRequest,
    InitiatePDFUploadRequest,
    InitiateVideoUploadRequest,
    PDFListParams,
    ReorderRequest,
    UpdatePDFRequest,
    UpdateVideoRequest,
    VideoListParams,
    MultipartPresignPartsRequest,
    MultipartCompleteRequest,
)
from app.modules.resource.service import (
    PDFService,
    StorageService,
    StreamingService,
    UploadService,
    VideoService,
)

video_router = APIRouter(prefix="/videos", tags=["Videos"])
pdf_router = APIRouter(prefix="/pdfs", tags=["PDFs"])
storage_router = APIRouter(prefix="/storage", tags=["Storage"])


# ===========================================================================
# VIDEO ENDPOINTS — Teacher Upload
# ===========================================================================


@video_router.post(
    "/initiate-upload",
    summary="Initiate video upload (teacher)",
    description=(
        "Creates a Video metadata record and returns a presigned PUT URL. "
        "The frontend uploads the video directly to R2 using this URL. "
        "Validates MIME type (mp4, webm, mov, avi, mkv) and file size (≤5 GB)."
    ),
    status_code=201,
)
async def initiate_video_upload(
    body: InitiateVideoUploadRequest,
    background_tasks: BackgroundTasks,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Initiate the presigned video upload flow."""
    svc = UploadService(db, teacher)
    data = await svc.initiate_video_upload(body)
    await db.commit()
    return success_response(data, status_code=201)


@video_router.post(
    "/confirm-upload",
    summary="Confirm video upload (teacher)",
    description=(
        "Called after the frontend has successfully PUT the video to R2. "
        "Verifies the object exists in R2, updates upload_status to 'completed', "
        "and triggers background post-processing tasks."
    ),
)
async def confirm_video_upload(
    body: ConfirmVideoUploadRequest,
    background_tasks: BackgroundTasks,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Confirm video upload and trigger background processing."""
    svc = UploadService(db, teacher)
    data = await svc.confirm_video_upload(body, background_tasks)
    await db.commit()
    return success_response(data)


@video_router.post(
    "/multipart/initiate",
    summary="Initiate multipart video upload (teacher)",
    description="Creates a Video metadata record and initiates a multipart upload in R2.",
    status_code=201,
)
async def initiate_multipart_video_upload(
    body: InitiateVideoUploadRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Initiate the multipart video upload flow."""
    svc = UploadService(db, teacher)
    data = await svc.initiate_multipart_video_upload(body)
    await db.commit()
    return success_response(data, status_code=201)


@video_router.post(
    "/multipart/{upload_id}/presign-parts",
    summary="Presign video upload parts (teacher)",
    description="Generate presigned PUT URLs for specific parts of a multipart upload.",
)
async def presign_video_parts(
    video_id: uuid.UUID = Query(..., description="The video resource ID"),
    upload_id: str = ...,
    body: MultipartPresignPartsRequest = ...,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Generate presigned URLs for multipart video upload parts."""
    svc = UploadService(db, teacher)
    data = await svc.presign_video_parts(video_id, upload_id, body.part_numbers)
    return success_response(data)


@video_router.post(
    "/multipart/{upload_id}/complete",
    summary="Complete multipart video upload (teacher)",
    description="Complete a multipart upload and trigger background processing.",
)
async def complete_multipart_video_upload(
    video_id: uuid.UUID = Query(..., description="The video resource ID"),
    upload_id: str = ...,
    body: MultipartCompleteRequest = ...,
    background_tasks: BackgroundTasks = ...,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Complete a multipart video upload."""
    svc = UploadService(db, teacher)
    data = await svc.complete_multipart_video_upload(
        video_id, upload_id, [p.model_dump() for p in body.parts], body.file_size_bytes, background_tasks
    )
    await db.commit()
    return success_response(data)


@video_router.delete(
    "/multipart/{upload_id}",
    summary="Abort multipart video upload (teacher)",
    description="Abort an in-progress multipart upload.",
    status_code=204,
)
async def abort_multipart_video_upload(
    video_id: uuid.UUID = Query(..., description="The video resource ID"),
    upload_id: str = ...,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Abort a multipart video upload."""
    svc = UploadService(db, teacher)
    await svc.abort_multipart_video_upload(video_id, upload_id)
    await db.commit()
    return Response(status_code=204)



# ===========================================================================
# VIDEO ENDPOINTS — Listing and Metadata
# ===========================================================================


@video_router.get(
    "/{course_id}",
    summary="List course videos",
    description=(
        "Returns paginated videos for a course. "
        "Teachers see all videos with all statuses. "
        "Students see only published videos and must be enrolled."
    ),
)
async def list_videos(
    course_id: uuid.UUID,
    params: VideoListParams = Depends(),
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List videos for a course."""
    svc = VideoService(db, actor)
    videos, total = await svc.list_videos(
        course_id,
        page=params.page,
        page_size=params.page_size,
        section=params.section,
        visibility=params.visibility,
        processing_status=params.processing_status,
        search=params.search,
    )
    return paginated_response(
        videos, page=params.page, page_size=params.page_size, total=total
    )


@video_router.get(
    "/{course_id}/{video_id}",
    summary="Video metadata",
    description="Returns video metadata. Students see only published videos.",
)
async def get_video(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return video metadata."""
    svc = VideoService(db, actor)
    data = await svc.get_video(video_id)
    return success_response(data)


@video_router.patch(
    "/{video_id}",
    summary="Update video metadata (teacher)",
    description="Partial update of video title, description, section, sort_order, visibility.",
)
async def update_video(
    video_id: uuid.UUID,
    body: UpdateVideoRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update video metadata."""
    svc = VideoService(db, teacher)
    data = await svc.update_video(video_id, body)
    await db.commit()
    return success_response(data)


@video_router.post(
    "/{video_id}/publish",
    summary="Publish video (teacher)",
    description=(
        "Set processing_status to 'published', making the video accessible to enrolled students. "
        "Upload must be confirmed first."
    ),
)
async def publish_video(
    video_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Publish a video."""
    svc = VideoService(db, teacher)
    data = await svc.publish_video(video_id)
    await db.commit()
    return success_response(data, message="Video published.")


@video_router.delete(
    "/{video_id}",
    summary="Delete video (teacher)",
    description="Soft-delete a video and schedule R2 object deletion.",
    status_code=204,
)
async def delete_video(
    video_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete a video."""
    svc = VideoService(db, teacher)
    await svc.delete_video(video_id)
    await db.commit()
    return Response(status_code=204)


@video_router.post(
    "/{course_id}/reorder",
    summary="Reorder videos (teacher)",
    description="Bulk update sort_order for videos in a course.",
)
async def reorder_videos(
    course_id: uuid.UUID,
    body: ReorderRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Bulk reorder videos."""
    svc = VideoService(db, teacher)
    await svc.reorder_videos(course_id, body)
    await db.commit()
    return success_response(message="Videos reordered.")


# ===========================================================================
# VIDEO ENDPOINTS — Student Streaming
# ===========================================================================


@video_router.get(
    "/{course_id}/{video_id}/stream",
    summary="Get video stream URL (student)",
    description=(
        "Returns a time-limited presigned R2 URL for in-browser video streaming. "
        "Verifies enrollment, checks Redis cache, and includes the student's resume position. "
        "Student must be enrolled and video must be published."
    ),
)
async def get_stream_url(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return presigned streaming URL with resume position."""
    svc = StreamingService(db, redis, student)
    data = await svc.get_stream_url(video_id)
    await db.commit()
    return success_response(data)


@video_router.post(
    "/{video_id}/progress",
    summary="Update video watch progress (student)",
    description=(
        "Upsert the student's watch position. Called every 30 seconds by the video player. "
        "Also accepts is_completed=true when the student finishes."
    ),
)
async def update_video_progress(
    video_id: uuid.UUID,
    watch_position_seconds: int = Query(..., ge=0),
    watch_duration_seconds: int = Query(..., ge=0),
    is_completed: bool = Query(default=False),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Update video watch progress."""
    svc = StreamingService(db, redis, student)
    data = await svc.update_progress(
        video_id=video_id,
        watch_position_seconds=watch_position_seconds,
        watch_duration_seconds=watch_duration_seconds,
        is_completed=is_completed,
    )
    await db.commit()
    return success_response(data)


@video_router.get(
    "/recently-watched",
    summary="Continue watching (student)",
    description="Returns the student's most recently accessed videos for the continue-watching row.",
)
async def get_recently_watched(
    limit: int = Query(default=5, ge=1, le=20),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return recently watched videos."""
    svc = StreamingService(db, redis, student)
    data = await svc.get_recently_watched(limit=limit)
    return success_response(data)


# ===========================================================================
# PDF ENDPOINTS — Teacher
# ===========================================================================


@pdf_router.post(
    "/initiate-upload",
    summary="Initiate PDF upload (teacher)",
    description=(
        "Creates a PDF metadata record and returns a presigned PUT URL. "
        "Maximum file size: 100 MB. MIME type must be application/pdf."
    ),
    status_code=201,
)
async def initiate_pdf_upload(
    body: InitiatePDFUploadRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Initiate the presigned PDF upload flow."""
    svc = UploadService(db, teacher)
    data = await svc.initiate_pdf_upload(body)
    await db.commit()
    return success_response(data, status_code=201)


@pdf_router.post(
    "/confirm-upload",
    summary="Confirm PDF upload (teacher)",
    description="Verify the PDF landed in R2 and update upload_status to 'completed'.",
)
async def confirm_pdf_upload(
    body: ConfirmPDFUploadRequest,
    background_tasks: BackgroundTasks,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Confirm PDF upload."""
    svc = UploadService(db, teacher)
    data = await svc.confirm_pdf_upload(body, background_tasks)
    await db.commit()
    return success_response(data)


@pdf_router.get(
    "/{course_id}",
    summary="List course PDFs",
    description="Returns paginated PDFs for a course.",
)
async def list_pdfs(
    course_id: uuid.UUID,
    params: PDFListParams = Depends(),
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List PDFs for a course."""
    svc = PDFService(db, actor)
    pdfs, total = await svc.list_pdfs(
        course_id,
        page=params.page,
        page_size=params.page_size,
        section=params.section,
        search=params.search,
    )
    return paginated_response(
        pdfs, page=params.page, page_size=params.page_size, total=total
    )


@pdf_router.patch(
    "/{pdf_id}",
    summary="Update PDF metadata (teacher)",
    description="Partial update of PDF title, description, section, sort_order.",
)
async def update_pdf(
    pdf_id: uuid.UUID,
    body: UpdatePDFRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update PDF metadata."""
    svc = PDFService(db, teacher)
    data = await svc.update_pdf(pdf_id, body)
    await db.commit()
    return success_response(data)


@pdf_router.delete(
    "/{pdf_id}",
    summary="Delete PDF (teacher)",
    description="Soft-delete a PDF and schedule R2 object deletion.",
    status_code=204,
)
async def delete_pdf(
    pdf_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete a PDF."""
    svc = PDFService(db, teacher)
    await svc.delete_pdf(pdf_id)
    await db.commit()
    return Response(status_code=204)


@pdf_router.post(
    "/{course_id}/reorder",
    summary="Reorder PDFs (teacher)",
    description="Bulk update sort_order for PDFs in a course.",
)
async def reorder_pdfs(
    course_id: uuid.UUID,
    body: ReorderRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Bulk reorder PDFs."""
    svc = PDFService(db, teacher)
    await svc.reorder_pdfs(course_id, body)
    await db.commit()
    return success_response(message="PDFs reordered.")


# ===========================================================================
# PDF ENDPOINTS — Student
# ===========================================================================


@pdf_router.get(
    "/{pdf_id}/access",
    summary="Get PDF access URL (student)",
    description=(
        "Returns a time-limited presigned R2 GET URL for PDF viewing or download. "
        "is_downloadable controls the Content-Disposition header. "
        "URL is cached in Redis for (expiry - 60s) to avoid regeneration."
    ),
)
async def get_pdf_access_url(
    pdf_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return presigned PDF access URL."""
    svc = PDFService(db, student)
    data = await svc.get_pdf_access_url(pdf_id, redis)
    await db.commit()
    return success_response(data)


# ===========================================================================
# STORAGE ENDPOINTS — Teacher
# ===========================================================================


@storage_router.get(
    "/{course_id}/stats",
    summary="Storage statistics (teacher)",
    description=(
        "Returns total video count, PDF count, combined storage size, "
        "and published video count for a course."
    ),
)
async def get_storage_stats(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return storage statistics for a course."""
    svc = StorageService(db, teacher)
    data = await svc.get_stats(course_id)
    return success_response(data)
