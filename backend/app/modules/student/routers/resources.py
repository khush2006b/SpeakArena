"""Student resources router.

Mounts at /api/v1/resources — provides access to course videos and PDFs.
All endpoints are gated by enrollment verification in the service layer.
Signed URLs are generated per-request and never stored in the database.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import UpdateProgressRequest
from app.modules.student.service import ProgressService, ResourceService

router = APIRouter(prefix="/resources", tags=["Student - Resources"])


# ===========================================================================
# Videos
# ===========================================================================


@router.get(
    "/{course_id}/videos",
    summary="List course videos",
    description=(
        "Returns all accessible videos for an enrolled student, ordered by sort_order. "
        "Includes watch progress injected from ContentProgress records."
    ),
)
async def list_videos(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all videos for an enrolled course."""
    svc = ResourceService(db, student)
    videos = await svc.list_videos(course_id)
    return success_response(videos)


@router.get(
    "/{course_id}/videos/{video_id}/stream",
    summary="Get video stream URL",
    description=(
        "Generates a time-limited R2 presigned GET URL for video streaming. "
        "The URL is generated on-demand per request and expires based on R2_PRESIGNED_URL_EXPIRY_DOWNLOAD. "
        "Student must be actively enrolled to access this endpoint."
    ),
)
async def get_video_stream_url(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return a signed streaming URL for a video."""
    svc = ResourceService(db, student)
    data = await svc.get_video_stream_url(course_id, video_id)
    await db.commit()  # Flush audit log
    return success_response(data)


@router.post(
    "/{course_id}/videos/{video_id}/progress",
    summary="Update video progress (heartbeat)",
    description=(
        "Called every 30 seconds by the video player to save watch position. "
        "Also accepts is_completed=true when the student finishes watching. "
        "Automatically recomputes course completion percentage."
    ),
)
async def update_video_progress(
    course_id: uuid.UUID,
    video_id: uuid.UUID,
    body: UpdateProgressRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Upsert video watch progress."""
    svc = ProgressService(db, student)
    data = await svc.update_video_progress(
        course_id=course_id,
        video_id=video_id,
        watch_position_seconds=body.watch_position_seconds,
        watch_duration_seconds=body.watch_duration_seconds,
        is_completed=body.is_completed,
    )
    await db.commit()
    return success_response(data)


# ===========================================================================
# PDFs
# ===========================================================================


@router.get(
    "/{course_id}/pdfs",
    summary="List course PDFs",
    description=(
        "Returns all accessible PDFs for an enrolled student, ordered by sort_order. "
        "Includes read/completion status from ContentProgress records."
    ),
)
async def list_pdfs(
    course_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all PDFs for an enrolled course."""
    svc = ResourceService(db, student)
    pdfs = await svc.list_pdfs(course_id)
    return success_response(pdfs)


@router.get(
    "/{course_id}/pdfs/{pdf_id}/access",
    summary="Get PDF access URL",
    description=(
        "Generates a time-limited R2 presigned GET URL for PDF download or viewing. "
        "Student must be actively enrolled. Logs PDF access in the audit trail."
    ),
)
async def get_pdf_access_url(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return a signed access URL for a PDF."""
    svc = ResourceService(db, student)
    data = await svc.get_pdf_access_url(course_id, pdf_id)
    await db.commit()  # Flush audit log
    return success_response(data)


@router.post(
    "/{course_id}/pdfs/{pdf_id}/complete",
    summary="Mark PDF as completed",
    description="Marks a PDF as completed and recomputes course progress percentage.",
)
async def mark_pdf_complete(
    course_id: uuid.UUID,
    pdf_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a PDF as completed."""
    svc = ProgressService(db, student)
    data = await svc.update_pdf_progress(
        course_id=course_id,
        pdf_id=pdf_id,
        is_completed=True,
    )
    await db.commit()
    return success_response(data, message="PDF marked as completed.")
