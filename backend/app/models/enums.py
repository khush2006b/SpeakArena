"""Platform-wide enumeration types.

All enums inherit from (str, enum.Enum) so that:
1. Values serialize to plain strings in JSON responses.
2. SQLAlchemy can compare enum members with database string values.
3. Pydantic schemas accept both the enum member and its string value.

Naming: All names match the exact string values stored in the database.
This avoids any mismatch between Python enums and database column values.
"""

import enum


class UserRole(str, enum.Enum):
    """Role of a user within the platform."""

    TEACHER = "teacher"
    STUDENT = "student"


class CourseStatus(str, enum.Enum):
    """Publication lifecycle state of a course."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class CourseVisibility(str, enum.Enum):
    """Controls who can discover the course in the catalog."""

    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"


class CourseLevel(str, enum.Enum):
    """Difficulty level indicator for the course."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class EnrollmentStatus(str, enum.Enum):
    """Status of a student enrollment record."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    REFUNDED = "refunded"


class VideoProcessingStatus(str, enum.Enum):
    """Video lifecycle state machine.

    Transitions:
        uploading -> processing -> ready -> published
                              -> failed
    """

    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    PUBLISHED = "published"
    FAILED = "failed"


class UploadStatus(str, enum.Enum):
    """Raw upload completion state for binary assets."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class ContentVisibility(str, enum.Enum):
    """Visibility of a single content item (video, PDF)."""

    PUBLIC = "public"
    PRIVATE = "private"


class MeetingStatus(str, enum.Enum):
    """Lifecycle state of a scheduled live session.

    Transitions:
        draft      -> scheduled
        scheduled  -> live | cancelled | expired
        live       -> completed | cancelled
        completed  -> archived
        cancelled  -> (terminal)
        expired    -> (terminal, set by scheduler when scheduled_at + duration passes)
        archived   -> (terminal)
    """

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    LIVE = "live"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class AttendanceStatus(str, enum.Enum):
    """Aggregate attendance outcome for a student in a session."""

    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    PARTIAL = "partial"


class AttendanceEventType(str, enum.Enum):
    """Raw event type for event-sourced attendance tracking."""

    JOIN = "join"
    LEAVE = "leave"


class MeetingVisibility(str, enum.Enum):
    """Controls who can see a scheduled meeting."""

    PUBLIC = "public"      # Visible to all enrolled students
    PRIVATE = "private"    # Visible only to teacher until explicitly shared
    UNLISTED = "unlisted"  # Not shown in course calendar, direct link only


class RecurrenceFrequency(str, enum.Enum):
    """Frequency for recurring meeting series."""

    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class MessageContentType(str, enum.Enum):
    """Type of content carried by a chat message."""

    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    VIDEO = "video"
    AUDIO = "audio"
    SYSTEM = "system"


class PaymentStatus(str, enum.Enum):
    """Razorpay payment state machine.

    Transitions:
        created -> attempted -> captured
                            -> failed
        captured -> refunded
        captured -> dispute
    """

    CREATED = "created"
    ATTEMPTED = "attempted"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    DISPUTE = "dispute"


class RefundStatus(str, enum.Enum):
    """State of a Razorpay refund request."""

    NONE = "none"
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class NotificationType(str, enum.Enum):
    """Category of platform notification event."""

    COURSE_PUBLISHED = "course_published"
    NEW_ENROLLMENT = "new_enrollment"
    MEETING_SCHEDULED = "meeting_scheduled"
    MEETING_REMINDER = "meeting_reminder"
    MEETING_STARTED = "meeting_started"
    MEETING_CANCELLED = "meeting_cancelled"
    NEW_MESSAGE = "new_message"
    MESSAGE_PINNED = "message_pinned"
    ASSIGNMENT_PUBLISHED = "assignment_published"
    ASSIGNMENT_GRADED = "assignment_graded"
    PAYMENT_SUCCESSFUL = "payment_successful"
    PAYMENT_FAILED = "payment_failed"
    REFUND_PROCESSED = "refund_processed"
    ANNOUNCEMENT = "announcement"
    ACCOUNT_WARNING = "account_warning"
    SYSTEM = "system"


class NotificationChannel(str, enum.Enum):
    """Delivery channel for a notification."""

    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    BOTH = "both"


class AuditSeverity(str, enum.Enum):
    """Severity classification of an audit event."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
