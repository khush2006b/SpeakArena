"""Resource module — Pydantic schemas.

All request bodies, response models, and query parameter classes
for video, PDF, and storage management.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Query
from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Allowed MIME type constants
# ===========================================================================

ALLOWED_VIDEO_MIME_TYPES: frozenset[str] = frozenset({
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
})

ALLOWED_PDF_MIME_TYPES: frozenset[str] = frozenset({
    "application/pdf",
})

ALLOWED_IMAGE_MIME_TYPES: frozenset[str] = frozenset({
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
})

MAX_VIDEO_SIZE_BYTES: int = 5 * 1024 * 1024 * 1024   # 5 GB
MAX_PDF_SIZE_BYTES: int = 100 * 1024 * 1024           # 100 MB
MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024          # 10 MB


# ===========================================================================
# Upload Request Schemas
# ===========================================================================


class InitiateVideoUploadRequest(BaseModel):
    """Request body to initiate a video upload presign flow."""

    course_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    mime_type: str = Field(..., description="e.g. video/mp4")
    file_size_bytes: int = Field(..., gt=0, le=MAX_VIDEO_SIZE_BYTES)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: int = Field(default=0, ge=0)

    @field_validator("mime_type")
    @classmethod
    def validate_mime_type(cls, v: str) -> str:
        """Ensure MIME type is an allowed video type."""
        if v not in ALLOWED_VIDEO_MIME_TYPES:
            raise ValueError(
                f"Unsupported video MIME type: {v!r}. "
                f"Allowed: {sorted(ALLOWED_VIDEO_MIME_TYPES)}"
            )
        return v


class ConfirmVideoUploadRequest(BaseModel):
    """Request body to confirm that the frontend has finished uploading."""

    video_id: uuid.UUID
    file_size_bytes: Optional[int] = Field(
        default=None, description="Actual size reported by the client."
    )


class InitiatePDFUploadRequest(BaseModel):
    """Request body to initiate a PDF upload presign flow."""

    course_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    file_size_bytes: int = Field(..., gt=0, le=MAX_PDF_SIZE_BYTES)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: int = Field(default=0, ge=0)
    is_downloadable: bool = Field(default=True)

    @field_validator("file_size_bytes")
    @classmethod
    def validate_size(cls, v: int) -> int:
        """Validate PDF size does not exceed 100 MB."""
        if v > MAX_PDF_SIZE_BYTES:
            raise ValueError("PDF file size must not exceed 100 MB.")
        return v


class ConfirmPDFUploadRequest(BaseModel):
    """Request body to confirm that the frontend has finished uploading."""

    pdf_id: uuid.UUID
    file_size_bytes: Optional[int] = Field(default=None)
    page_count: Optional[int] = Field(default=None, ge=1)


class UpdateVideoRequest(BaseModel):
    """Request body for updating video metadata."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: Optional[int] = Field(default=None, ge=0)
    visibility: Optional[str] = Field(default=None)
    is_free_preview: Optional[bool] = Field(default=None)

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: Optional[str]) -> Optional[str]:
        """Validate visibility string."""
        if v is not None and v not in {"public", "private"}:
            raise ValueError("visibility must be 'public' or 'private'.")
        return v


class UpdatePDFRequest(BaseModel):
    """Request body for updating PDF metadata."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: Optional[int] = Field(default=None, ge=0)
    visibility: Optional[str] = Field(default=None)
    is_downloadable: Optional[bool] = Field(default=None)
    is_free_preview: Optional[bool] = Field(default=None)


class ReorderRequest(BaseModel):
    """Request body for bulk reordering of videos or PDFs."""

    items: list[dict[str, Any]] = Field(
        ...,
        description="List of {id: UUID, sort_order: int}.",
        min_length=1,
    )


# ===========================================================================
# Multipart Upload Schemas
# ===========================================================================


class MultipartInitiateResponse(BaseModel):
    """Response after initiating a multipart upload."""

    upload_id: str
    resource_id: uuid.UUID
    r2_key: str


class MultipartPresignPartsRequest(BaseModel):
    """Request body to get presigned URLs for specific parts."""

    upload_id: str
    part_numbers: list[int] = Field(..., min_length=1, max_length=100)


class MultipartPresignPartsResponse(BaseModel):
    """Response containing presigned URLs for requested parts."""

    presigned_urls: dict[int, str]


class MultipartPart(BaseModel):
    """Represents a completed part in a multipart upload."""

    PartNumber: int
    ETag: str


class MultipartCompleteRequest(BaseModel):
    """Request body to complete a multipart upload."""

    upload_id: str
    parts: list[MultipartPart] = Field(..., min_length=1)
    file_size_bytes: int = Field(..., gt=0)



# ===========================================================================
# Response Schemas
# ===========================================================================


class PresignedUploadResponse(BaseModel):
    """Response after initiating an upload."""

    resource_id: uuid.UUID
    upload_url: str
    r2_key: str
    expires_in_seconds: int
    method: str = "PUT"


class VideoResponse(BaseModel):
    """Video metadata response."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    sort_order: int
    section: Optional[str] = None
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    mime_type: str
    resolution_width: Optional[int] = None
    resolution_height: Optional[int] = None
    processing_status: str
    upload_status: str
    visibility: str
    is_free_preview: bool
    thumbnail_url: Optional[str] = None
    created_at: datetime
    published_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VideoStreamResponse(BaseModel):
    """Streaming URL response for a video."""

    video_id: uuid.UUID
    stream_url: str
    expires_in_seconds: int
    duration_seconds: Optional[int] = None
    resume_position_seconds: int = 0
    mime_type: str


class PDFResponse(BaseModel):
    """PDF metadata response."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    sort_order: int
    section: Optional[str] = None
    file_size_bytes: int
    page_count: Optional[int] = None
    mime_type: str
    is_downloadable: bool
    is_free_preview: bool
    upload_status: str
    visibility: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PDFAccessResponse(BaseModel):
    """Presigned access URL response for a PDF."""

    pdf_id: uuid.UUID
    access_url: str
    expires_in_seconds: int
    is_downloadable: bool


class StorageStatsResponse(BaseModel):
    """Storage statistics for a course."""

    course_id: uuid.UUID
    total_videos: int
    total_pdfs: int
    total_size_bytes: int
    published_videos: int


# ===========================================================================
# Query Parameter Classes
# ===========================================================================


class VideoListParams:
    """Query parameters for listing videos."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=50, ge=1, le=200),
        section: Optional[str] = Query(default=None),
        visibility: Optional[str] = Query(default=None),
        processing_status: Optional[str] = Query(default=None),
        search: Optional[str] = Query(default=None, max_length=200),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.section = section
        self.visibility = visibility
        self.processing_status = processing_status
        self.search = search


class PDFListParams:
    """Query parameters for listing PDFs."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=50, ge=1, le=200),
        section: Optional[str] = Query(default=None),
        search: Optional[str] = Query(default=None, max_length=200),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.section = section
        self.search = search
