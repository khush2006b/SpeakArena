"""PDF resource metadata model.

Stores only file metadata. Binary PDF files live in Cloudflare R2.
Presigned download URLs are generated per-request by the storage service.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ContentVisibility, UploadStatus

if TYPE_CHECKING:
    from app.models.course import ContentProgress, Course


class PDF(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """PDF resource metadata record.

    Stores only the R2 object key and file metadata. The actual binary
    is stored in Cloudflare R2. The storage service generates a time-limited
    presigned download URL per request, verified against enrollment status.
    is_downloadable controls whether the student can download the file
    or can only view it in the browser-based PDF viewer.
    """

    __tablename__ = "pdfs"

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
        String(150), nullable=True, default=None
    )
    r2_object_key: Mapped[str] = mapped_column(
        String(512), nullable=False,
        comment="R2 storage key for the PDF file.",
    )
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True, default=None,
        comment="Populated by the upload completion webhook.",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="application/pdf",
        server_default="application/pdf",
    )
    is_downloadable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true",
        comment="False prevents the browser download button from working.",
    )
    is_free_preview: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ContentVisibility.PRIVATE,
        server_default="private",
    )
    upload_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UploadStatus.PENDING,
        server_default="pending",
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship("Course", back_populates="pdfs")
    progress_records: Mapped[list[ContentProgress]] = relationship(
        "ContentProgress",
        back_populates="pdf",
        foreign_keys="ContentProgress.pdf_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<PDF id={self.id} title={self.title!r}>"
