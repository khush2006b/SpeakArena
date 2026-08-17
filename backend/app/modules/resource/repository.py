"""Resource module — repository layer.

All database I/O for the resource module. No business logic.

Repositories:
    VideoRepository         CRUD for Video records.
    PDFRepository           CRUD for PDF records.
    EnrollmentGateRepository Enrollment verification for content access.
    ContentProgressRepository Upsert for ContentProgress (progress tracking).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import ContentProgress, Course, CourseEnrollment
from app.models.enums import (
    ContentVisibility,
    EnrollmentStatus,
    UploadStatus,
    VideoProcessingStatus,
)
from app.models.pdf import PDF
from app.models.video import Video


# ===========================================================================
# VideoRepository
# ===========================================================================


class VideoRepository:
    """CRUD for Video metadata records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        course_id: uuid.UUID,
        title: str,
        r2_object_key: str,
        mime_type: str,
        file_size_bytes: int,
        description: Optional[str] = None,
        section: Optional[str] = None,
        sort_order: int = 0,
    ) -> Video:
        """Create a new Video metadata record.

        Args:
            course_id: The course UUID.
            title: Video display title.
            r2_object_key: R2 storage key for the video file.
            mime_type: MIME type of the video.
            file_size_bytes: File size in bytes.
            description: Optional description.
            section: Optional curriculum section label.
            sort_order: Display ordering.

        Returns:
            Video: The newly created video record.
        """
        video = Video(
            course_id=course_id,
            title=title,
            r2_object_key=r2_object_key,
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            description=description,
            section=section,
            sort_order=sort_order,
            processing_status=VideoProcessingStatus.UPLOADING,
            upload_status=UploadStatus.PENDING,
            visibility=ContentVisibility.PRIVATE,
        )
        self._db.add(video)
        await self._db.flush()
        return video

    async def get_by_id(
        self,
        video_id: uuid.UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[Video]:
        """Fetch a video by primary key.

        Args:
            video_id: The video UUID.
            include_deleted: If True, include soft-deleted records.

        Returns:
            Video | None: The video or None.
        """
        cond = [Video.id == video_id]
        if not include_deleted:
            cond.append(Video.deleted_at.is_(None))
        return (
            await self._db.execute(select(Video).where(and_(*cond)))
        ).scalar_one_or_none()

    async def list_for_course(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 50,
        section: Optional[str] = None,
        visibility: Optional[str] = None,
        processing_status: Optional[str] = None,
        search: Optional[str] = None,
        published_only: bool = False,
    ) -> tuple[list[Video], int]:
        """Return paginated videos for a course.

        Args:
            course_id: The course UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            section: Optional section filter.
            visibility: Optional visibility filter.
            processing_status: Optional processing status filter.
            search: Optional title search.
            published_only: If True, only return published videos.

        Returns:
            tuple: (list of Video ORM objects, total count).
        """
        conditions = [
            Video.course_id == course_id,
            Video.deleted_at.is_(None),
        ]
        if section:
            conditions.append(Video.section == section)
        if visibility:
            conditions.append(Video.visibility == visibility)
        if processing_status:
            conditions.append(Video.processing_status == processing_status)
        if published_only:
            conditions.append(
                Video.processing_status == VideoProcessingStatus.PUBLISHED
            )
        if search:
            conditions.append(Video.title.ilike(f"%{search}%"))

        count_stmt = select(func.count(Video.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Video)
            .where(and_(*conditions))
            .order_by(Video.sort_order.asc(), Video.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self._db.execute(data_stmt)).scalars().all())
        return rows, total

    async def update(
        self,
        video: Video,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        section: Optional[str] = None,
        sort_order: Optional[int] = None,
        visibility: Optional[str] = None,
        is_free_preview: Optional[bool] = None,
        processing_status: Optional[str] = None,
        upload_status: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        file_size_bytes: Optional[int] = None,
        thumbnail_r2_key: Optional[str] = None,
        resolution_width: Optional[int] = None,
        resolution_height: Optional[int] = None,
        published_at: Optional[datetime] = None,
        processing_error: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Video:
        """Update mutable fields on a Video record.

        Args:
            video: The Video ORM instance.
            title: New title.
            description: New description.
            section: New section label.
            sort_order: New sort position.
            visibility: New visibility string.
            is_free_preview: New free preview flag.
            processing_status: New processing status.
            upload_status: New upload status.
            duration_seconds: Video duration in seconds.
            file_size_bytes: File size in bytes.
            thumbnail_r2_key: R2 key for the thumbnail.
            resolution_width: Horizontal resolution.
            resolution_height: Vertical resolution.
            published_at: Publication timestamp.
            processing_error: Error message from processing job.
            metadata: Technical metadata dict from ffprobe.

        Returns:
            Video: The updated Video instance.
        """
        if title is not None:
            video.title = title
        if description is not None:
            video.description = description
        if section is not None:
            video.section = section
        if sort_order is not None:
            video.sort_order = sort_order
        if visibility is not None:
            video.visibility = visibility
        if is_free_preview is not None:
            video.is_free_preview = is_free_preview
        if processing_status is not None:
            video.processing_status = processing_status
        if upload_status is not None:
            video.upload_status = upload_status
        if duration_seconds is not None:
            video.duration_seconds = duration_seconds
        if file_size_bytes is not None:
            video.file_size_bytes = file_size_bytes
        if thumbnail_r2_key is not None:
            video.thumbnail_r2_key = thumbnail_r2_key
        if resolution_width is not None:
            video.resolution_width = resolution_width
        if resolution_height is not None:
            video.resolution_height = resolution_height
        if published_at is not None:
            video.published_at = published_at
        if processing_error is not None:
            video.processing_error = processing_error
        if metadata is not None:
            video.metadata_ = metadata
        await self._db.flush()
        return video

    async def soft_delete(
        self,
        video: Video,
    ) -> None:
        """Soft-delete a video record.

        Args:
            video: The Video ORM instance.
        """
        video.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def bulk_update_sort_order(
        self,
        items: list[dict[str, Any]],
    ) -> None:
        """Bulk update sort_order for a list of videos.

        Args:
            items: List of {id: UUID, sort_order: int}.
        """
        for item in items:
            await self._db.execute(
                update(Video)
                .where(Video.id == item["id"])
                .values(sort_order=item["sort_order"])
            )
        await self._db.flush()

    async def get_course_video_stats(
        self,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return aggregate video statistics for a course.

        Args:
            course_id: The course UUID.

        Returns:
            dict: total_videos, total_size_bytes, published_videos.
        """
        stmt = select(
            func.count(Video.id).label("total"),
            func.coalesce(func.sum(Video.file_size_bytes), 0).label("total_size"),
            func.count(
                Video.id.where(Video.processing_status == VideoProcessingStatus.PUBLISHED)
            ).label("published"),
        ).where(
            Video.course_id == course_id,
            Video.deleted_at.is_(None),
        )
        row = (await self._db.execute(stmt)).one()
        return {
            "total_videos": row.total,
            "total_size_bytes": int(row.total_size),
            "published_videos": row.published,
        }

    async def mark_published(
        self,
        video_id: uuid.UUID,
    ) -> None:
        """Set processing_status to 'published' and record published_at.

        Args:
            video_id: The video UUID.
        """
        await self._db.execute(
            update(Video)
            .where(Video.id == video_id)
            .values(
                processing_status=VideoProcessingStatus.PUBLISHED,
                published_at=datetime.now(timezone.utc),
            )
        )
        await self._db.flush()


# ===========================================================================
# PDFRepository
# ===========================================================================


class PDFRepository:
    """CRUD for PDF metadata records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        course_id: uuid.UUID,
        title: str,
        r2_object_key: str,
        file_size_bytes: int,
        description: Optional[str] = None,
        section: Optional[str] = None,
        sort_order: int = 0,
        is_downloadable: bool = True,
    ) -> PDF:
        """Create a new PDF metadata record.

        Args:
            course_id: The course UUID.
            title: PDF display title.
            r2_object_key: R2 storage key.
            file_size_bytes: File size in bytes.
            description: Optional description.
            section: Optional section label.
            sort_order: Display ordering.
            is_downloadable: Whether students can download the PDF.

        Returns:
            PDF: The newly created record.
        """
        pdf = PDF(
            course_id=course_id,
            title=title,
            r2_object_key=r2_object_key,
            file_size_bytes=file_size_bytes,
            description=description,
            section=section,
            sort_order=sort_order,
            is_downloadable=is_downloadable,
            upload_status=UploadStatus.PENDING,
            visibility=ContentVisibility.PRIVATE,
        )
        self._db.add(pdf)
        await self._db.flush()
        return pdf

    async def get_by_id(
        self,
        pdf_id: uuid.UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PDF]:
        """Fetch a PDF by primary key.

        Args:
            pdf_id: The PDF UUID.
            include_deleted: If True, include soft-deleted records.

        Returns:
            PDF | None: The PDF or None.
        """
        cond = [PDF.id == pdf_id]
        if not include_deleted:
            cond.append(PDF.deleted_at.is_(None))
        return (
            await self._db.execute(select(PDF).where(and_(*cond)))
        ).scalar_one_or_none()

    async def list_for_course(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 50,
        section: Optional[str] = None,
        search: Optional[str] = None,
        published_only: bool = False,
    ) -> tuple[list[PDF], int]:
        """Return paginated PDFs for a course.

        Args:
            course_id: The course UUID.
            page: 1-indexed page.
            page_size: Items per page.
            section: Optional section filter.
            search: Optional title search.
            published_only: If True, only return completed uploads.

        Returns:
            tuple: (list of PDF ORM objects, total count).
        """
        conditions = [
            PDF.course_id == course_id,
            PDF.deleted_at.is_(None),
        ]
        if section:
            conditions.append(PDF.section == section)
        if published_only:
            conditions.append(PDF.upload_status == UploadStatus.COMPLETED)
        if search:
            conditions.append(PDF.title.ilike(f"%{search}%"))

        count_stmt = select(func.count(PDF.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(PDF)
            .where(and_(*conditions))
            .order_by(PDF.sort_order.asc(), PDF.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self._db.execute(data_stmt)).scalars().all())
        return rows, total

    async def update(
        self,
        pdf: PDF,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        section: Optional[str] = None,
        sort_order: Optional[int] = None,
        visibility: Optional[str] = None,
        is_downloadable: Optional[bool] = None,
        is_free_preview: Optional[bool] = None,
        upload_status: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        page_count: Optional[int] = None,
    ) -> PDF:
        """Update mutable fields on a PDF record.

        Args:
            pdf: The PDF ORM instance.
            title: New title.
            description: New description.
            section: New section.
            sort_order: New sort position.
            visibility: New visibility.
            is_downloadable: New download permission flag.
            is_free_preview: New free preview flag.
            upload_status: New upload status.
            file_size_bytes: Actual file size.
            page_count: PDF page count.

        Returns:
            PDF: The updated PDF instance.
        """
        if title is not None:
            pdf.title = title
        if description is not None:
            pdf.description = description
        if section is not None:
            pdf.section = section
        if sort_order is not None:
            pdf.sort_order = sort_order
        if visibility is not None:
            pdf.visibility = visibility
        if is_downloadable is not None:
            pdf.is_downloadable = is_downloadable
        if is_free_preview is not None:
            pdf.is_free_preview = is_free_preview
        if upload_status is not None:
            pdf.upload_status = upload_status
        if file_size_bytes is not None:
            pdf.file_size_bytes = file_size_bytes
        if page_count is not None:
            pdf.page_count = page_count
        await self._db.flush()
        return pdf

    async def soft_delete(self, pdf: PDF) -> None:
        """Soft-delete a PDF record.

        Args:
            pdf: The PDF ORM instance.
        """
        pdf.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def bulk_update_sort_order(
        self,
        items: list[dict[str, Any]],
    ) -> None:
        """Bulk update sort_order for a list of PDFs.

        Args:
            items: List of {id: UUID, sort_order: int}.
        """
        for item in items:
            await self._db.execute(
                update(PDF)
                .where(PDF.id == item["id"])
                .values(sort_order=item["sort_order"])
            )
        await self._db.flush()

    async def get_course_pdf_stats(
        self,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return aggregate PDF statistics for a course.

        Args:
            course_id: The course UUID.

        Returns:
            dict: total_pdfs, total_size_bytes.
        """
        stmt = select(
            func.count(PDF.id).label("total"),
            func.coalesce(func.sum(PDF.file_size_bytes), 0).label("total_size"),
        ).where(
            PDF.course_id == course_id,
            PDF.deleted_at.is_(None),
        )
        row = (await self._db.execute(stmt)).one()
        return {
            "total_pdfs": row.total,
            "total_size_bytes": int(row.total_size),
        }


# ===========================================================================
# EnrollmentGateRepository
# ===========================================================================


class EnrollmentGateRepository:
    """Centralized enrollment verification for content access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def is_enrolled(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> bool:
        """Check active enrollment for a student in a course.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            bool: True if the student has an active enrollment.
        """
        count = (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == course_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
            )
        ).scalar_one()
        return count > 0

    async def get_course_id_for_video(
        self,
        video_id: uuid.UUID,
    ) -> Optional[uuid.UUID]:
        """Return the course_id of the course that owns a video.

        Args:
            video_id: The video UUID.

        Returns:
            uuid.UUID | None: The course UUID, or None if not found.
        """
        return (
            await self._db.execute(
                select(Video.course_id).where(
                    Video.id == video_id,
                    Video.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def get_course_id_for_pdf(
        self,
        pdf_id: uuid.UUID,
    ) -> Optional[uuid.UUID]:
        """Return the course_id of the course that owns a PDF.

        Args:
            pdf_id: The PDF UUID.

        Returns:
            uuid.UUID | None: The course UUID, or None if not found.
        """
        return (
            await self._db.execute(
                select(PDF.course_id).where(
                    PDF.id == pdf_id,
                    PDF.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def get_course_owner(
        self,
        course_id: uuid.UUID,
    ) -> Optional[uuid.UUID]:
        """Return the teacher_id (owner) of a course.

        Args:
            course_id: The course UUID.

        Returns:
            uuid.UUID | None: The teacher user UUID.
        """
        return (
            await self._db.execute(
                select(Course.teacher_id).where(Course.id == course_id)
            )
        ).scalar_one_or_none()


# ===========================================================================
# ContentProgressRepository
# ===========================================================================


class ContentProgressRepository:
    """Upsert for ContentProgress (video watch position and PDF completion)."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def upsert_video_progress(
        self,
        student_id: uuid.UUID,
        video_id: uuid.UUID,
        watch_position_seconds: int,
        watch_duration_seconds: int,
        is_completed: bool,
    ) -> ContentProgress:
        """Upsert a video ContentProgress record.

        Creates the record if it does not exist, updates it otherwise.

        Args:
            student_id: The student UUID.
            video_id: The video UUID.
            watch_position_seconds: Current resume point.
            watch_duration_seconds: Total watch time.
            is_completed: Whether the student has finished the video.

        Returns:
            ContentProgress: The upserted record.
        """
        existing = (
            await self._db.execute(
                select(ContentProgress).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.video_id == video_id,
                )
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if existing is None:
            existing = ContentProgress(
                student_id=student_id,
                video_id=video_id,
                watch_position_seconds=watch_position_seconds,
                watch_duration_seconds=watch_duration_seconds,
                is_completed=is_completed,
                last_accessed_at=now,
            )
            if is_completed:
                existing.completed_at = now
            self._db.add(existing)
        else:
            existing.watch_position_seconds = watch_position_seconds
            existing.watch_duration_seconds = max(
                existing.watch_duration_seconds, watch_duration_seconds
            )
            existing.last_accessed_at = now
            if is_completed and not existing.is_completed:
                existing.is_completed = True
                existing.completed_at = now

        await self._db.flush()
        return existing

    async def get_video_progress(
        self,
        student_id: uuid.UUID,
        video_id: uuid.UUID,
    ) -> Optional[ContentProgress]:
        """Fetch the progress record for a student + video.

        Args:
            student_id: The student UUID.
            video_id: The video UUID.

        Returns:
            ContentProgress | None: The record or None.
        """
        return (
            await self._db.execute(
                select(ContentProgress).where(
                    ContentProgress.student_id == student_id,
                    ContentProgress.video_id == video_id,
                )
            )
        ).scalar_one_or_none()

    async def get_recently_watched(
        self,
        student_id: uuid.UUID,
        limit: int = 5,
    ) -> list[ContentProgress]:
        """Return the most recently accessed video progress records.

        Args:
            student_id: The student UUID.
            limit: Maximum records to return.

        Returns:
            list[ContentProgress]: Progress records, most recent first.
        """
        return list(
            (
                await self._db.execute(
                    select(ContentProgress)
                    .where(
                        ContentProgress.student_id == student_id,
                        ContentProgress.video_id.is_not(None),
                    )
                    .order_by(desc(ContentProgress.last_accessed_at))
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
