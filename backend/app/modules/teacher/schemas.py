"""Pydantic request and response schemas for the Teacher Module.

All schemas validate input strictly (extra fields are forbidden) and
serialize output using model_dump(mode='json') for JSON-safe responses.

Naming conventions:
    *Request  : Incoming request body schemas.
    *Response : Outgoing response schemas (read models).
    *Params   : Query parameter schemas.
    *Schema   : Nested data shapes used by both request and response.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.models.enums import (
    AttendanceStatus,
    ContentVisibility,
    CourseLevel,
    CourseStatus,
    CourseVisibility,
    MeetingStatus,
    UploadStatus,
    VideoProcessingStatus,
)


# ===========================================================================
# Shared base
# ===========================================================================


class _StrictBase(BaseModel):
    """Base for all schemas: forbid extra fields, validate on assignment."""

    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class _ReadBase(BaseModel):
    """Base for all response schemas: ignore unknown fields from ORM."""

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# Pagination & filtering
# ===========================================================================


class PaginationParams(_StrictBase):
    """Common pagination query parameters."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed).")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page.")


class CourseFilterParams(BaseModel):
    """Query parameters for filtering/searching the teacher's course list."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    status: Optional[CourseStatus] = None
    visibility: Optional[CourseVisibility] = None
    search: Optional[str] = Field(default=None, max_length=200)
    sort_by: str = Field(default="created_at")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class MeetingFilterParams(BaseModel):
    """Query parameters for filtering meetings."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    course_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    upcoming_only: bool = False


class StudentSearchParams(BaseModel):
    """Query parameters for searching enrolled students."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    search: Optional[str] = Field(default=None, max_length=200)
    course_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class AnalyticsQueryParams(BaseModel):
    """Query parameters for analytics endpoints."""

    model_config = ConfigDict(extra="ignore")

    period: str = Field(
        default="30d",
        pattern="^(7d|30d|90d|1y|all|DAILY|WEEKLY|MONTHLY|YEARLY|ALL|daily|weekly|monthly|yearly)$",
        description="Time window: 7d, 30d, 90d, 1y, all, DAILY, WEEKLY, MONTHLY, YEARLY.",
    )
    course_id: Optional[uuid.UUID] = Field(
        default=None, description="Filter analytics to a single course."
    )


# ===========================================================================
# Category
# ===========================================================================


class CategoryResponse(_ReadBase):
    """Category response schema."""

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    icon: Optional[str]
    sort_order: int
    is_active: bool
    parent_id: Optional[uuid.UUID]


# ===========================================================================
# Course schemas
# ===========================================================================


class CreateCourseRequest(_StrictBase):
    """Request body for creating a new course."""

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    short_description: Optional[str] = Field(default=None, max_length=500)
    price: float = Field(default=0.00, ge=0)
    original_price: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="INR", max_length=3)
    level: CourseLevel = Field(default=CourseLevel.BEGINNER)
    language: str = Field(default="en", max_length=10)
    visibility: CourseVisibility = CourseVisibility.PRIVATE
    status: CourseStatus = Field(default=CourseStatus.DRAFT)
    max_students: int = Field(default=50, ge=1, le=100000, description="Seat limit for student enrollments.")
    category_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)
    primary_category_id: Optional[uuid.UUID] = None
    is_certificate_enabled: bool = False
    thumbnail_r2_key: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_categories(self) -> "CreateCourseRequest":
        """Ensure primary_category_id is in category_ids when provided."""
        if (
            self.primary_category_id is not None
            and self.primary_category_id not in self.category_ids
        ):
            raise ValueError("primary_category_id must be one of the category_ids.")
        return self


class UpdateCourseRequest(_StrictBase):
    """Request body for partial course updates. All fields optional."""

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    short_description: Optional[str] = Field(default=None, max_length=500)
    price: Optional[float] = Field(default=None, ge=0)
    original_price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=3)
    level: Optional[CourseLevel] = None
    language: Optional[str] = Field(default=None, max_length=10)
    visibility: Optional[CourseVisibility] = None
    max_students: Optional[int] = Field(default=None, ge=1, le=100000)
    category_ids: Optional[list[uuid.UUID]] = Field(default=None, max_length=5)
    primary_category_id: Optional[uuid.UUID] = None
    is_certificate_enabled: Optional[bool] = None
    thumbnail_r2_key: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class CourseCategorySchema(_ReadBase):
    """Nested category in a course response."""

    id: uuid.UUID
    category_id: uuid.UUID
    is_primary: bool
    category: Optional[CategoryResponse] = None


class CourseResponse(_ReadBase):
    """Full course detail response."""

    id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    slug: str
    description: Optional[str]
    short_description: Optional[str]
    thumbnail_r2_key: Optional[str]
    promo_video_r2_key: Optional[str]
    price: float
    original_price: Optional[float]
    currency: str
    status: str
    visibility: str
    level: Optional[str]
    language: str
    total_duration_seconds: int
    total_lectures: int
    total_enrollments: int
    max_students: int = 50
    is_certificate_enabled: bool
    metadata: dict = Field(alias="metadata_", default_factory=dict)
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    course_categories: list[CourseCategorySchema] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class CourseSummaryResponse(_ReadBase):
    """Lightweight course response for list views."""

    id: uuid.UUID
    title: str
    slug: str
    status: str
    visibility: str
    price: float
    thumbnail_r2_key: Optional[str]
    total_enrollments: int
    max_students: int = 50
    total_lectures: int
    level: Optional[str]
    created_at: datetime
    updated_at: datetime


class ThumbnailPresignResponse(_ReadBase):
    """Response for thumbnail upload presign request."""

    upload_url: str
    r2_key: str
    expires_in: int


# ===========================================================================
# Meeting schemas
# ===========================================================================


class CreateMeetingRequest(_StrictBase):
    """Request body for creating a new meeting."""

    course_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    meet_link: Optional[str] = Field(default=None, max_length=512)
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    max_participants: Optional[int] = Field(default=None, ge=1, le=10000)
    provider: str = Field(default="google_meet", max_length=50)

    @field_validator("scheduled_at", mode="after")
    @classmethod
    def must_be_in_future(cls, v: datetime) -> datetime:
        """Validate that the meeting is not scheduled in the past."""
        from datetime import timezone
        now = datetime.now(timezone.utc)
        v_utc = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if v_utc <= now:
            raise ValueError("Meeting must be scheduled in the future.")
        return v

    @field_validator("meet_link")
    @classmethod
    def validate_meet_link(cls, v: Optional[str]) -> Optional[str]:
        """Basic validation that meet_link starts with http if provided."""
        if v and not v.startswith("http"):
            raise ValueError("meet_link must be a valid URL.")
        return v


class UpdateMeetingRequest(_StrictBase):
    """Request body for partial meeting updates."""

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    meet_link: Optional[str] = Field(default=None, max_length=512)
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=480)
    max_participants: Optional[int] = Field(default=None, ge=1, le=10000)
    status: Optional[str] = Field(default=None, max_length=20)


class MeetingResponse(_ReadBase):
    """Full meeting detail response."""

    id: uuid.UUID
    course_id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    description: Optional[str]
    meet_link: str
    provider: str
    scheduled_at: datetime
    duration_minutes: int
    actual_started_at: Optional[datetime]
    actual_ended_at: Optional[datetime]
    status: str
    max_participants: Optional[int]
    recording_r2_key: Optional[str]
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime


class MeetingSummaryResponse(_ReadBase):
    """Lightweight meeting response for list views."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    status: str
    scheduled_at: datetime
    duration_minutes: int
    meet_link: str
    created_at: datetime


# ===========================================================================
# Video schemas
# ===========================================================================


class CreateVideoRequest(_StrictBase):
    """Request body to create a video record and obtain an R2 upload URL."""

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: int = Field(default=0, ge=0)
    visibility: ContentVisibility = ContentVisibility.PRIVATE
    is_free_preview: bool = False
    mime_type: str = Field(default="video/mp4", max_length=100)

    @field_validator("mime_type")
    @classmethod
    def validate_video_mime(cls, v: str) -> str:
        """Validate MIME type is in the allowed video list."""
        from app.core.storage.r2 import ALLOWED_VIDEO_MIME_TYPES
        if v not in ALLOWED_VIDEO_MIME_TYPES:
            raise ValueError(f"Unsupported video MIME type: {v}")
        return v


class UpdateVideoRequest(_StrictBase):
    """Request body for partial video metadata update."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: Optional[int] = Field(default=None, ge=0)
    visibility: Optional[ContentVisibility] = None
    is_free_preview: Optional[bool] = None


class ConfirmVideoUploadRequest(_StrictBase):
    """Request body to mark a video upload as completed."""

    file_size_bytes: int = Field(..., ge=1)
    duration_seconds: Optional[int] = Field(default=None, ge=0)


class ReorderItem(_StrictBase):
    """Single item in a reorder request."""

    id: uuid.UUID
    sort_order: int = Field(..., ge=0)


class ReorderRequest(_StrictBase):
    """Request body for reordering videos or PDFs."""

    items: list[ReorderItem] = Field(..., min_length=1, max_length=200)


class VideoResponse(_ReadBase):
    """Full video response."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str]
    sort_order: int
    section: Optional[str]
    r2_object_key: str
    hls_r2_key_prefix: Optional[str]
    thumbnail_r2_key: Optional[str]
    duration_seconds: Optional[int]
    file_size_bytes: Optional[int]
    mime_type: str
    processing_status: str
    upload_status: str
    visibility: str
    is_free_preview: bool
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class VideoUploadInitResponse(_ReadBase):
    """Response after creating a video record (includes R2 presign URL)."""

    video: VideoResponse
    upload_url: str
    r2_key: str
    expires_in: int


# ===========================================================================
# PDF schemas
# ===========================================================================


class CreatePDFRequest(_StrictBase):
    """Request body to create a PDF record and get an R2 upload URL."""

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: int = Field(default=0, ge=0)
    visibility: ContentVisibility = ContentVisibility.PRIVATE
    is_downloadable: bool = True
    is_free_preview: bool = False
    file_size_bytes: int = Field(..., ge=1, description="File size in bytes.")
    mime_type: str = Field(default="application/pdf", max_length=100)

    @field_validator("mime_type")
    @classmethod
    def validate_pdf_mime(cls, v: str) -> str:
        """Validate MIME type is PDF."""
        from app.core.storage.r2 import ALLOWED_PDF_MIME_TYPES
        if v not in ALLOWED_PDF_MIME_TYPES:
            raise ValueError("Only PDF files are supported.")
        return v


class UpdatePDFRequest(_StrictBase):
    """Request body for partial PDF metadata update."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    section: Optional[str] = Field(default=None, max_length=150)
    sort_order: Optional[int] = Field(default=None, ge=0)
    visibility: Optional[ContentVisibility] = None
    is_downloadable: Optional[bool] = None
    is_free_preview: Optional[bool] = None
    page_count: Optional[int] = Field(default=None, ge=1)


class PDFResponse(_ReadBase):
    """Full PDF resource response."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str]
    sort_order: int
    section: Optional[str]
    r2_object_key: str
    file_size_bytes: int
    page_count: Optional[int]
    mime_type: str
    is_downloadable: bool
    is_free_preview: bool
    visibility: str
    upload_status: str
    created_at: datetime
    updated_at: datetime


class PDFUploadInitResponse(_ReadBase):
    """Response after creating a PDF record (includes R2 presign URL)."""

    pdf: PDFResponse
    upload_url: str
    r2_key: str
    expires_in: int


# ===========================================================================
# Announcement (pinned message) schemas
# ===========================================================================


class CreateAnnouncementRequest(_StrictBase):
    """Request body for creating an announcement."""

    content: str = Field(..., min_length=1, max_length=10000)
    is_pinned: bool = True


class UpdateAnnouncementRequest(_StrictBase):
    """Request body for updating an announcement."""

    content: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    is_pinned: Optional[bool] = None


class AnnouncementResponse(_ReadBase):
    """Announcement response (backed by Message with is_announcement=True)."""

    id: uuid.UUID
    chat_room_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    is_pinned: bool
    is_edited: bool
    edited_at: Optional[datetime]
    pinned_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ===========================================================================
# Attendance schemas
# ===========================================================================


class AttendanceRecordResponse(_ReadBase):
    """Single student attendance record for a meeting."""

    id: uuid.UUID
    meeting_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    join_time: Optional[datetime]
    leave_time: Optional[datetime]
    total_duration_seconds: int
    attendance_percentage: float
    is_late: bool
    student_name: Optional[str] = None
    student_email: Optional[str] = None


class AttendanceSummaryResponse(BaseModel):
    """Aggregated attendance summary for analytics."""

    total_meetings: int
    total_students_enrolled: int
    average_attendance_rate: float
    present_count: int
    absent_count: int
    late_count: int


# ===========================================================================
# Student management schemas
# ===========================================================================


class StudentEnrollmentResponse(_ReadBase):
    """Student enrollment card shown on the teacher's student list."""

    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    student_avatar_r2_key: Optional[str]
    course_id: uuid.UUID
    course_title: str
    enrollment_status: str
    enrolled_at: datetime
    progress_percent: int
    completed_at: Optional[datetime]
    payment_amount: Optional[float]


class StudentDetailResponse(BaseModel):
    """Detailed student profile visible to the teacher."""

    student_id: uuid.UUID
    full_name: str
    email: str
    avatar_r2_key: Optional[str]
    phone: Optional[str]
    is_active: bool
    college: Optional[str]
    graduation_year: Optional[int]
    preferred_language: str
    total_courses_enrolled: int
    total_courses_completed: int
    enrollments: list[StudentEnrollmentResponse] = []


class SuspendStudentRequest(_StrictBase):
    """Request body to suspend a student from a specific course (or all courses if omitted)."""

    course_id: Optional[uuid.UUID] = Field(default=None)
    reason: Optional[str] = Field(default=None, max_length=500)


class BlockStudentRequest(_StrictBase):
    """Request body to block a student from all courses."""

    reason: Optional[str] = Field(default=None, max_length=500)


# ===========================================================================
# Teacher profile schemas
# ===========================================================================


class UpdateTeacherProfileRequest(_StrictBase):
    """Request body for updating teacher profile fields."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    bio: Optional[str] = Field(default=None, max_length=5000)
    headline: Optional[str] = Field(default=None, max_length=200)
    website_url: Optional[str] = Field(default=None, max_length=512)
    social_links: Optional[dict[str, str]] = None


class TeacherProfileResponse(BaseModel):
    """Teacher profile response."""

    user_id: uuid.UUID
    full_name: str
    email: str
    avatar_r2_key: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    headline: Optional[str]
    website_url: Optional[str]
    social_links: dict
    total_students: int
    total_courses: int
    total_revenue: float


class AvatarPresignResponse(BaseModel):
    """Response for avatar presign upload request."""

    upload_url: str
    r2_key: str
    expires_in: int


class PresignUploadRequest(_StrictBase):
    """Generic presign upload request (thumbnail, avatar)."""

    content_type: str = Field(..., max_length=100)
    file_name: str = Field(..., max_length=255)


# ===========================================================================
# Dashboard schemas
# ===========================================================================


class TodayRevenueSchema(BaseModel):
    """Revenue summary for the dashboard."""

    today: float
    this_month: float
    total: float
    currency: str = "INR"


class TodayMeetingSchema(BaseModel):
    """Upcoming meeting shown on the dashboard."""

    id: uuid.UUID
    title: str
    course_title: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    meet_link: str


class RecentEnrollmentSchema(BaseModel):
    """Recent enrollment shown on the dashboard."""

    student_name: str
    student_email: str
    course_title: str
    enrolled_at: datetime
    amount_paid: float


class RecentPaymentSchema(BaseModel):
    """Recent payment shown on the dashboard."""

    student_name: str
    course_title: str
    amount: float
    status: str
    paid_at: Optional[datetime]


class DashboardResponse(BaseModel):
    """Full teacher dashboard data."""

    revenue: TodayRevenueSchema
    total_students: int
    total_courses: int
    total_published_courses: int
    today_meetings: list[TodayMeetingSchema]
    upcoming_meetings: list[TodayMeetingSchema]
    recent_enrollments: list[RecentEnrollmentSchema]
    recent_payments: list[RecentPaymentSchema]
    course_count_by_status: dict[str, int]


# ===========================================================================
# Analytics schemas
# ===========================================================================


class RevenueDataPoint(BaseModel):
    """Single revenue data point for charts."""

    date: str
    amount: float
    currency: str = "INR"


class EnrollmentDataPoint(BaseModel):
    """Single enrollment data point for charts."""

    date: str
    count: int


class CoursePerformanceSchema(BaseModel):
    """Per-course analytics row."""

    course_id: uuid.UUID
    title: str
    total_enrollments: int
    total_revenue: float
    average_progress: float
    completion_rate: float


class RevenueAnalyticsResponse(BaseModel):
    """Revenue analytics response."""

    period: str
    total_revenue: float
    currency: str
    data_points: list[RevenueDataPoint]


class EnrollmentAnalyticsResponse(BaseModel):
    """Enrollment analytics response."""

    period: str
    total_enrollments: int
    data_points: list[EnrollmentDataPoint]


class AttendanceAnalyticsResponse(BaseModel):
    """Attendance analytics response."""

    total_meetings: int
    average_attendance_rate: float
    present_rate: float
    absent_rate: float
    late_rate: float


class CourseAnalyticsResponse(BaseModel):
    """Course-level analytics response."""

    courses: list[CoursePerformanceSchema]
    top_course_id: Optional[uuid.UUID]
    top_course_title: Optional[str]
