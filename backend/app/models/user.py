"""User, TeacherProfile, and StudentProfile models.

The users table is the single identity store for all platform accounts.
Role-specific data is separated into profile tables (SRP). This keeps
the users table lean for authentication middleware and JWT generation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, SmallInteger, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.assignment import AssignmentSubmission
    from app.models.audit import AuditLog
    from app.models.auth import RefreshToken, UserSession
    from app.models.chat import Message
    from app.models.course import CourseEnrollment
    from app.models.meeting import Meeting, SessionAttendance
    from app.models.notification import Notification, NotificationPreference
    from app.models.payment import Payment
    from app.models.video import Video


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Core identity record for all platform users.

    Both Teacher and Student accounts are stored here, differentiated
    by the role column. JWT access tokens embed the user id and role.
    Authentication middleware rejects tokens for inactive or soft-deleted
    users without hitting the database.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        comment="Stored as-is. Unique index is on LOWER(email).",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Argon2id hash. Never bcrypt.",
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.STUDENT,
        server_default="student",
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    avatar_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="Cloudflare R2 object key for the user avatar image.",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        default=None,
        comment="E.164 format: +919876543210",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    failed_login_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )

    # --- Relationships ---
    teacher_profile: Mapped[Optional[TeacherProfile]] = relationship(
        "TeacherProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    student_profile: Mapped[Optional[StudentProfile]] = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    sessions: Mapped[list[UserSession]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    enrollments: Mapped[list[CourseEnrollment]] = relationship(
        "CourseEnrollment",
        back_populates="student",
        foreign_keys="CourseEnrollment.student_id",
        lazy="raise",
    )
    payments: Mapped[list[Payment]] = relationship(
        "Payment",
        back_populates="student",
        foreign_keys="Payment.student_id",
        lazy="raise",
    )
    notifications: Mapped[list[Notification]] = relationship(
        "Notification",
        back_populates="recipient",
        foreign_keys="Notification.recipient_id",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    notification_preferences: Mapped[list[NotificationPreference]] = relationship(
        "NotificationPreference",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(
        "AuditLog",
        back_populates="actor",
        foreign_keys="AuditLog.actor_id",
        lazy="raise",
    )
    sent_messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="sender",
        foreign_keys="Message.sender_id",
        lazy="raise",
    )
    attendance_records: Mapped[list[SessionAttendance]] = relationship(
        "SessionAttendance",
        back_populates="student",
        foreign_keys="SessionAttendance.student_id",
        lazy="raise",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<User id={self.id} email={self.email!r} role={self.role}>"

    @property
    def is_teacher(self) -> bool:
        """Return True when this user holds the teacher role.

        Returns:
            bool: True if role is 'teacher'.
        """
        return self.role == UserRole.TEACHER

    @property
    def is_student(self) -> bool:
        """Return True when this user holds the student role.

        Returns:
            bool: True if role is 'student'.
        """
        return self.role == UserRole.STUDENT

    @property
    def is_locked(self) -> bool:
        """Return True when the account is temporarily locked.

        A locked account is unlocked automatically when locked_until
        passes. The auth service checks this before processing credentials.

        Returns:
            bool: True if locked_until is in the future.
        """
        from datetime import timezone
        if self.locked_until is None:
            return False
        return self.locked_until > datetime.now(timezone.utc)


class TeacherProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Teacher-specific profile data separated from the core users table.

    SRP: users stays lean for auth queries. This table carries bio,
    social links, and denormalized analytics counters that would bloat
    every auth query if stored on users directly.

    Denormalized counters (total_students, total_courses, total_revenue)
    are updated transactionally by the relevant service layers. They
    exist to avoid COUNT/SUM aggregations on the teacher dashboard.
    """

    __tablename__ = "teacher_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    headline: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
        default=None,
        comment='Short subtitle shown on profile: "DSA & Java Expert"',
    )
    website_url: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    social_links: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment='{"youtube":"...", "linkedin":"...", "twitter":"..."}',
    )
    total_students: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Denormalized counter. Incremented by enrollment service.",
    )
    total_courses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="Denormalized counter. Incremented by course service.",
    )
    total_revenue: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0.00,
        server_default="0.00",
        comment="Lifetime earnings in INR. Updated by payment service on capture.",
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User", back_populates="teacher_profile")

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<TeacherProfile user_id={self.user_id}>"


class StudentProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Student-specific profile data separated from the core users table.

    Mirrors the SRP pattern of TeacherProfile. Carries enrollment
    counters and optional demographic data for future segmentation.
    """

    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    college: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, default=None
    )
    graduation_year: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True, default=None
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10), nullable=False, default="en", server_default="en"
    )
    total_courses_enrolled: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    total_courses_completed: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment="Extensible bag: UTM source, referral code, intake batch.",
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User", back_populates="student_profile")

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<StudentProfile user_id={self.user_id}>"
