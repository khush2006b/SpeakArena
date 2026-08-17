"""Video lecture metadata model.

Stores only metadata. Binary video files live in Cloudflare R2.
The processing_status column implements a state machine that prevents
students from accessing partially processed or failed videos.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, SmallInteger, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ContentVisibility, UploadStatus, VideoProcessingStatus

if TYPE_CHECKING:
    from app.models.course import ContentProgress, Course


class Video(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Video lecture metadata record.

    State machine:  uploading -> processing -> ready -> published
                                          -> failed

    Students can only access a video when processing_status = 'published'
    AND deleted_at IS NULL. The service layer enforces this gate.
    HLS segments are stored under hls_r2_key_prefix in R2.
    """

    __tablename__ = "videos"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    sort_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    section: Mapped[Optional[str]] = mapped_column(
        String(150), nullable=True, default=None,
        comment="Chapter/Section label for curriculum grouping.",
    )
    r2_object_key: Mapped[str] = mapped_column(
        String(512), nullable=False,
        comment="R2 storage key for the original uploaded video file.",
    )
    hls_r2_key_prefix: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None,
        comment="R2 key prefix for HLS segments, e.g. videos/{id}/hls/",
    )
    thumbnail_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    duration_seconds: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, default=None,
        comment="Set by the transcoding job after processing.",
    )
    file_size_bytes: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="video/mp4", server_default="video/mp4"
    )
    resolution_width: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True, default=None
    )
    resolution_height: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True, default=None
    )
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=VideoProcessingStatus.UPLOADING,
        server_default="uploading",
    )
    processing_error: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None,
        comment="Human-readable error from the transcoding job.",
    )
    upload_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UploadStatus.PENDING,
        server_default="pending",
    )
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ContentVisibility.PRIVATE,
        server_default="private",
    )
    is_free_preview: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment="Codec, bitrate, fps, and other technical metadata from ffprobe.",
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship("Course", back_populates="videos")
    progress_records: Mapped[list[ContentProgress]] = relationship(
        "ContentProgress",
        back_populates="video",
        foreign_keys="ContentProgress.video_id",
        cascade="all, delete-orphan",
    )

    @property
    def is_accessible(self) -> bool:
        """Return True when the video can be served to enrolled students.

        A video must be published and not soft-deleted to be accessible.

        Returns:
            bool: True when students can stream the video.
        """
        return (
            self.processing_status == VideoProcessingStatus.PUBLISHED
            and self.deleted_at is None
        )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Video id={self.id} title={self.title!r} status={self.processing_status}>"
