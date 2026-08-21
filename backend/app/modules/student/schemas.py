"""Student module — Pydantic schemas.

All request bodies and response models for the student portal.
Used by routers for input validation and response serialization.

Schema naming:
    XxxRequest   : Validated request body.
    XxxResponse  : Single-item response payload.
    XxxListItem  : Lightweight list item shape.
    XxxParams    : FastAPI Depends() query parameter class.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Query
from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Shared / Pagination
# ===========================================================================


class PaginationParams(BaseModel):
    """Shared pagination query parameters."""

    page: int = Field(default=1, ge=1, description="1-indexed page number.")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page.")

    model_config = {"populate_by_name": True}


class CourseSearchParams:
    """Query parameters for enrolled course listing."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        search: Optional[str] = Query(default=None, max_length=200),
        status: Optional[str] = Query(default=None, description="Filter by enrollment status."),
        sort_by: str = Query(default="enrolled_at", pattern="^(enrolled_at|progress|title|completed_at)$"),
        sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
        only_favorites: bool = Query(default=False),
        only_in_progress: bool = Query(default=False),
        only_completed: bool = Query(default=False),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.search = search
        self.status = status
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.only_favorites = only_favorites
        self.only_in_progress = only_in_progress
        self.only_completed = only_completed


class MeetingFilterParams:
    """Query parameters for student meeting listing."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        course_id: Optional[uuid.UUID] = Query(default=None),
        upcoming_only: bool = Query(default=False),
        history_only: bool = Query(default=False),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.course_id = course_id
        self.upcoming_only = upcoming_only
        self.history_only = history_only


class NotificationFilterParams:
    """Query parameters for notification listing."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        unread_only: bool = Query(default=False),
        notification_type: Optional[str] = Query(default=None),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.unread_only = unread_only
        self.notification_type = notification_type


class AttendanceFilterParams:
    """Query parameters for attendance listing."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        course_id: Optional[uuid.UUID] = Query(default=None),
        status: Optional[str] = Query(default=None, description="present|absent|late|partial"),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.course_id = course_id
        self.status = status


class SearchParams:
    """Query parameters for global search."""

    def __init__(
        self,
        q: str = Query(..., min_length=2, max_length=200, description="Search query."),
        entity: Optional[str] = Query(
            default=None,
            description="Limit to entity type: course|video|pdf|meeting",
            pattern="^(course|video|pdf|meeting)$",
        ),
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=50),
    ) -> None:
        self.q = q
        self.entity = entity
        self.page = page
        self.page_size = page_size


# ===========================================================================
# Course Schemas
# ===========================================================================


class EnrolledCourseListItem(BaseModel):
    """Lightweight enrolled course row for list views."""

    enrollment_id: uuid.UUID
    course_id: uuid.UUID
    title: str
    slug: str
    thumbnail_r2_key: Optional[str] = None
    level: Optional[str] = None
    language: Optional[str] = None
    total_lectures: int
    total_duration_seconds: int
    teacher_name: str
    teacher_avatar_r2_key: Optional[str] = None
    progress_percentage: float
    enrollment_status: str
    enrolled_at: datetime
    completed_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None
    is_favorite: bool = False

    model_config = {"from_attributes": True}


class TeacherSummary(BaseModel):
    """Minimal teacher info for course detail."""

    user_id: uuid.UUID
    full_name: str
    avatar_r2_key: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    total_students: int = 0
    total_courses: int = 0


class CourseDetailResponse(BaseModel):
    """Full course detail for the enrolled student course page."""

    course_id: uuid.UUID
    title: str
    slug: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    thumbnail_r2_key: Optional[str] = None
    level: Optional[str] = None
    language: Optional[str] = None
    total_lectures: int
    total_duration_seconds: int
    total_enrollments: int
    max_students: int = 50
    is_certificate_enabled: bool
    teacher: TeacherSummary
    enrollment_id: uuid.UUID
    enrollment_status: str
    progress_percentage: float
    enrolled_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Video Schemas
# ===========================================================================


class VideoListItem(BaseModel):
    """Video list item for the course curriculum view."""

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    section: Optional[str] = None
    sort_order: int
    duration_seconds: Optional[int] = None
    is_free_preview: bool
    visibility: str
    processing_status: str
    is_completed: bool = False
    watch_position_seconds: int = 0
    last_accessed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VideoStreamResponse(BaseModel):
    """Signed streaming URL response for video playback."""

    video_id: uuid.UUID
    title: str
    signed_url: str
    expires_in: int
    duration_seconds: Optional[int] = None
    watch_position_seconds: int
    is_completed: bool


# ===========================================================================
# PDF Schemas
# ===========================================================================


class PDFListItem(BaseModel):
    """PDF list item for the course curriculum view."""

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    section: Optional[str] = None
    sort_order: int
    file_size_bytes: Optional[int] = None
    page_count: Optional[int] = None
    is_free_preview: bool
    is_downloadable: bool
    visibility: str
    is_completed: bool = False
    last_accessed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PDFAccessResponse(BaseModel):
    """Signed download URL response for PDF access."""

    pdf_id: uuid.UUID
    title: str
    signed_url: str
    expires_in: int
    file_size_bytes: Optional[int] = None
    page_count: Optional[int] = None
    is_downloadable: bool


# ===========================================================================
# Progress Schemas
# ===========================================================================


class UpdateProgressRequest(BaseModel):
    """Heartbeat payload to update video watch position."""

    video_id: Optional[uuid.UUID] = None
    pdf_id: Optional[uuid.UUID] = None
    watch_position_seconds: int = Field(default=0, ge=0)
    watch_duration_seconds: int = Field(default=0, ge=0)
    is_completed: bool = False

    @field_validator("video_id", "pdf_id", mode="before")
    @classmethod
    def at_least_one_content_id(cls, v: Any) -> Any:  # noqa: ANN401
        return v


class ContentProgressItem(BaseModel):
    """Progress record for a single content item."""

    content_id: uuid.UUID
    content_type: str  # "video" | "pdf"
    title: str
    watch_position_seconds: int
    watch_duration_seconds: int
    is_completed: bool
    completed_at: Optional[datetime] = None
    last_accessed_at: datetime


class CourseProgressResponse(BaseModel):
    """Aggregated progress summary for an enrolled course."""

    course_id: uuid.UUID
    enrollment_id: uuid.UUID
    progress_percentage: float
    total_lectures: int
    completed_lectures: int
    total_watch_time_seconds: int
    last_activity_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_video_id: Optional[uuid.UUID] = None
    next_video_title: Optional[str] = None


# ===========================================================================
# Meeting Schemas
# ===========================================================================


class MeetingListItem(BaseModel):
    """Meeting row for list views."""

    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    title: str
    status: str
    scheduled_at: datetime
    duration_minutes: int
    provider: Optional[str] = None
    # meet_link only populated when status is SCHEDULED or LIVE and enrolled
    meet_link: Optional[str] = None
    attendance_status: Optional[str] = None

    model_config = {"from_attributes": True}


class MeetingDetailResponse(BaseModel):
    """Full meeting detail for the student."""

    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    title: str
    description: Optional[str] = None
    status: str
    scheduled_at: datetime
    duration_minutes: int
    provider: Optional[str] = None
    meet_link: Optional[str] = None  # Gated by enrollment + status
    max_participants: Optional[int] = None
    recording_r2_key: Optional[str] = None
    actual_started_at: Optional[datetime] = None
    actual_ended_at: Optional[datetime] = None
    attendance_status: Optional[str] = None
    reminder_sent: bool


# ===========================================================================
# Attendance Schemas
# ===========================================================================


class AttendanceRecord(BaseModel):
    """Single meeting attendance record."""

    meeting_id: uuid.UUID
    meeting_title: str
    course_id: uuid.UUID
    course_title: str
    scheduled_at: datetime
    status: str
    join_time: Optional[datetime] = None
    leave_time: Optional[datetime] = None
    total_duration_seconds: Optional[int] = None
    attendance_percentage: float
    is_late: bool


class AttendanceSummary(BaseModel):
    """Aggregate attendance stats for the student."""

    total_meetings: int
    attended_meetings: int
    absent_meetings: int
    late_meetings: int
    overall_attendance_percentage: float
    by_course: list[dict[str, Any]] = Field(default_factory=list)


# ===========================================================================
# Notification Schemas
# ===========================================================================


class NotificationItem(BaseModel):
    """Single notification record."""

    id: uuid.UUID
    type: str
    title: str
    body: str
    action_url: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    """Unread notification count."""

    unread_count: int


# ===========================================================================
# Payment Schemas
# ===========================================================================


class PaymentHistoryItem(BaseModel):
    """Single payment record for the student."""

    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    amount: float
    currency: str
    status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    refund_status: str
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# Profile Schemas
# ===========================================================================


class UpdateProfileRequest(BaseModel):
    """Partial student profile update."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    college: Optional[str] = Field(default=None, max_length=200)
    graduation_year: Optional[int] = Field(default=None, ge=1990, le=2035)
    preferred_language: Optional[str] = Field(default=None, max_length=10)
    date_of_birth: Optional[datetime] = None


class UpdatePasswordRequest(BaseModel):
    """Password change request."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class PresignUploadRequest(BaseModel):
    """Request body for generating a presigned R2 upload URL."""

    content_type: str = Field(
        ...,
        description="MIME type of the file to upload.",
        examples=["image/jpeg", "image/png", "image/webp"],
    )
    file_name: str = Field(..., max_length=255)


class StudentProfileResponse(BaseModel):
    """Full student profile payload."""

    user_id: uuid.UUID
    full_name: str
    email: str
    phone: Optional[str] = None
    avatar_r2_key: Optional[str] = None
    college: Optional[str] = None
    graduation_year: Optional[int] = None
    preferred_language: str
    date_of_birth: Optional[datetime] = None
    total_courses_enrolled: int
    total_courses_completed: int
    is_email_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


# ===========================================================================
# Dashboard Schemas
# ===========================================================================


class ContinueLearningItem(BaseModel):
    """Continue-watching card for the dashboard."""

    course_id: uuid.UUID
    course_title: str
    thumbnail_r2_key: Optional[str] = None
    video_id: uuid.UUID
    video_title: str
    watch_position_seconds: int
    duration_seconds: Optional[int] = None
    progress_percentage: float
    last_accessed_at: datetime


class DashboardResponse(BaseModel):
    """Full student dashboard payload."""

    welcome_name: str
    total_enrolled_courses: int
    total_completed_courses: int
    overall_progress_percentage: float
    continue_learning: list[ContinueLearningItem] = Field(default_factory=list)
    upcoming_meetings: list[MeetingListItem] = Field(default_factory=list)
    recent_announcements: list[dict[str, Any]] = Field(default_factory=list)
    recent_notifications: list[NotificationItem] = Field(default_factory=list)
    attendance_summary: dict[str, Any] = Field(default_factory=dict)
    recent_payments: list[PaymentHistoryItem] = Field(default_factory=list)


# ===========================================================================
# Search Schemas
# ===========================================================================


class SearchResultItem(BaseModel):
    """Single search result entity."""

    entity_type: str  # "course" | "video" | "pdf" | "meeting"
    entity_id: uuid.UUID
    title: str
    description: Optional[str] = None
    course_id: Optional[uuid.UUID] = None
    course_title: Optional[str] = None
    thumbnail_r2_key: Optional[str] = None
    score: float = 1.0


class SearchResponse(BaseModel):
    """Global search response."""

    query: str
    total: int
    results: list[SearchResultItem]
    by_type: dict[str, int] = Field(default_factory=dict)
