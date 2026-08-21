"""SQLAlchemy ORM models package.

All model modules are imported here so that:
1. Alembic autogenerate discovers all tables via Base.metadata.
2. SQLAlchemy relationship back-references resolve at import time.
3. A single import (from app.models import User) works everywhere.

Import order matters: base models must be imported before
any model that declares a relationship pointing to them.
"""

# --- Mixins & utilities ---
from app.models.base import (  # noqa: F401
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

# --- Enumerations ---
from app.models.enums import (  # noqa: F401
    AttendanceEventType,
    AttendanceStatus,
    AuditSeverity,
    ContentVisibility,
    CourseLevel,
    CourseStatus,
    CourseVisibility,
    EnrollmentStatus,
    MessageContentType,
    MeetingStatus,
    NotificationChannel,
    NotificationType,
    PaymentStatus,
    RefundStatus,
    UploadStatus,
    UserRole,
    VideoProcessingStatus,
)

# --- Identity & auth (no cross-model dependencies) ---
from app.models.user import StudentProfile, TeacherProfile, User  # noqa: F401
from app.models.auth import (  # noqa: F401
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    UserSession,
)

# --- Payments (imported before enrollments to resolve FK) ---
from app.models.payment import Payment, PaymentHistory  # noqa: F401

# --- Course module ---
from app.models.course import (  # noqa: F401
    Category,
    ContentProgress,
    Course,
    CourseCategory,
    CourseEnrollment,
)

# --- Content module ---
from app.models.video import Video  # noqa: F401
from app.models.pdf import PDF  # noqa: F401
from app.models.assignment import Assignment, AssignmentSubmission  # noqa: F401

# --- Meeting & attendance module ---
from app.models.meeting import (  # noqa: F401
    AttendanceEvent,
    Meeting,
    SessionAttendance,
)

# --- Chat module (messages after chat_rooms due to circular FK) ---
from app.models.chat import ChatRoom, Message, MessageReaction  # noqa: F401

# --- Notifications ---
from app.models.notification import (  # noqa: F401
    Notification,
    NotificationPreference,
)

# --- Tests & Grading module ---
from app.models.test import CourseTest, TestGrade  # noqa: F401

# --- Audit (last; references all other models via actor_id) ---
from app.models.audit import AuditLog  # noqa: F401

__all__: list[str] = [
    # Mixins
    "UUIDPrimaryKeyMixin",
    "TimestampMixin",
    "SoftDeleteMixin",
    # Enums
    "UserRole",
    "CourseStatus",
    "CourseVisibility",
    "CourseLevel",
    "EnrollmentStatus",
    "VideoProcessingStatus",
    "UploadStatus",
    "ContentVisibility",
    "MeetingStatus",
    "AttendanceStatus",
    "AttendanceEventType",
    "MessageContentType",
    "PaymentStatus",
    "RefundStatus",
    "NotificationType",
    "NotificationChannel",
    "AuditSeverity",
    # Models
    "User",
    "TeacherProfile",
    "StudentProfile",
    "RefreshToken",
    "UserSession",
    "PasswordResetToken",
    "EmailVerificationToken",
    "Payment",
    "PaymentHistory",
    "Category",
    "Course",
    "CourseCategory",
    "CourseEnrollment",
    "ContentProgress",
    "Video",
    "PDF",
    "Assignment",
    "AssignmentSubmission",
    "Meeting",
    "SessionAttendance",
    "AttendanceEvent",
    "ChatRoom",
    "Message",
    "MessageReaction",
    "Notification",
    "NotificationPreference",
    "CourseTest",
    "TestGrade",
    "AuditLog",
]
