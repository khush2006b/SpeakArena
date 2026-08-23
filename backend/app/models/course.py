"""Course module models.

Category       : Hierarchical taxonomy (max 2 levels).
Course         : Core course entity owned by the teacher.
CourseCategory : M2M junction with primary-flag support.
CourseEnrollment: Student access gate created on payment capture.
ContentProgress: Per-student, per-content-item watch progress.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CourseLevel, CourseStatus, CourseVisibility, EnrollmentStatus

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.chat import ChatRoom
    from app.models.meeting import Meeting
    from app.models.payment import Payment
    from app.models.pdf import PDF
    from app.models.user import User
    from app.models.video import Video


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Course category with optional parent for two-level hierarchy.

    Pre-seeded by the teacher. Admin-only write access enforced at the
    API layer. Courses link to categories via the CourseCategory junction.
    Maximum nesting depth of 2 is enforced at the application layer.
    """

    __tablename__ = "categories"

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    icon: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default=None,
        comment="Lucide icon name, e.g. 'code-2'",
    )
    sort_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # --- Relationships ---
    parent: Mapped[Optional[Category]] = relationship(
        "Category",
        remote_side="Category.id",
        back_populates="children",
        foreign_keys=[parent_id],
    )
    children: Mapped[list[Category]] = relationship(
        "Category",
        back_populates="parent",
        foreign_keys=[parent_id],
        lazy="selectin",
    )
    course_categories: Mapped[list[CourseCategory]] = relationship(
        "CourseCategory", back_populates="category"
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Category slug={self.slug!r}>"


class Course(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Core course entity. Owned by a single teacher user.

    Status controls the publication lifecycle (draft -> published -> archived).
    Visibility controls catalog discoverability (public / private / unlisted).
    Soft delete preserves enrollment and payment history after archival.

    Denormalized counters (total_lectures, total_enrollments, total_duration_seconds)
    are updated transactionally by their respective service methods.
    They avoid expensive aggregation queries on the teacher dashboard.
    """

    __tablename__ = "courses"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(220), nullable=False, unique=True, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    short_description: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        default=None,
        comment="Displayed on course cards. 1-2 sentence summary.",
    )
    thumbnail_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    thumbnail_data: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True, default=None
    )
    thumbnail_mime: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, default=None
    )
    promo_video_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    price: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0.00,
        server_default="0.00",
        comment="Course price in INR. 0.00 means free.",
    )
    original_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        default=None,
        comment="Strike-through price for discount display.",
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CourseStatus.DRAFT,
        server_default="draft",
    )
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CourseVisibility.PRIVATE,
        server_default="private",
    )
    level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )
    language: Mapped[str] = mapped_column(
        String(10), nullable=False, default="en", server_default="en"
    )
    total_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    total_lectures: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    total_enrollments: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    max_students: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=50,
        server_default="50",
        comment="Maximum allowed student enrollments (seat limit).",
    )
    total_reviews: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    average_rating: Mapped[Optional[float]] = mapped_column(
        Numeric(3, 2), nullable=True, default=None
    )
    is_certificate_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment="Tags, prerequisites, learning outcomes, etc.",
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )

    # --- Relationships ---
    teacher: Mapped[User] = relationship(
        "User", foreign_keys=[teacher_id]
    )
    course_categories: Mapped[list[CourseCategory]] = relationship(
        "CourseCategory",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    enrollments: Mapped[list[CourseEnrollment]] = relationship(
        "CourseEnrollment",
        back_populates="course",
        lazy="raise",
    )
    videos: Mapped[list[Video]] = relationship(
        "Video",
        back_populates="course",
        order_by="Video.sort_order",
        lazy="raise",
    )
    pdfs: Mapped[list[PDF]] = relationship(
        "PDF",
        back_populates="course",
        order_by="PDF.sort_order",
        lazy="raise",
    )
    meetings: Mapped[list[Meeting]] = relationship(
        "Meeting", back_populates="course", lazy="raise"
    )
    assignments: Mapped[list[Assignment]] = relationship(
        "Assignment", back_populates="course", lazy="raise"
    )
    chat_room: Mapped[Optional[ChatRoom]] = relationship(
        "ChatRoom", back_populates="course", uselist=False, lazy="selectin"
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Course slug={self.slug!r} status={self.status}>"

    @property
    def is_published(self) -> bool:
        """Return True when the course is published and not soft-deleted.

        Returns:
            bool: True when students can enroll.
        """
        return self.status == CourseStatus.PUBLISHED and self.deleted_at is None


class CourseCategory(Base):
    """Many-to-many junction between Course and Category.

    A course can belong to multiple categories. Exactly one entry
    per course must have is_primary=True, enforced by a partial
    unique index in the migration: UNIQUE (course_id) WHERE is_primary.
    """

    __tablename__ = "course_categories"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship(
        "Course", back_populates="course_categories"
    )
    category: Mapped[Category] = relationship(
        "Category", back_populates="course_categories"
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<CourseCategory course={self.course_id} category={self.category_id}"
            f" primary={self.is_primary}>"
        )


class CourseEnrollment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Student enrollment record. The authorization gate for course content.

    Created on successful Razorpay payment webhook verification
    (or immediately for free courses). The service layer checks
    enrollment status and expiry before serving any content.

    progress_percentage is updated by the content progress service
    whenever a content_progress record is marked complete.
    """

    __tablename__ = "course_enrollments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="NULL for free courses.",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
        server_default="active",
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ,
        nullable=True,
        default=None,
        comment="NULL means lifetime access.",
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    progress_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0.00, server_default="0.00"
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship(
        "Course", back_populates="enrollments"
    )
    student: Mapped[User] = relationship(
        "User",
        back_populates="enrollments",
        foreign_keys=[student_id],
    )
    payment: Mapped[Optional[Payment]] = relationship(
        "Payment",
        back_populates="enrollment",
        foreign_keys=[payment_id],
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<CourseEnrollment course={self.course_id}"
            f" student={self.student_id} status={self.status}>"
        )


class ContentProgress(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-student, per-content-item progress tracking record.

    Exactly one of video_id or pdf_id must be non-null per row,
    enforced by a database CHECK constraint in the migration.
    Upserted every 30 seconds by the video player heartbeat endpoint.
    Used for resume-from-last-position and course progress calculation.
    """

    __tablename__ = "content_progress"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=True,
        default=None,
    )
    pdf_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pdfs.id", ondelete="CASCADE"),
        nullable=True,
        default=None,
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    watch_position_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
        comment="Video resume point in seconds.",
    )
    watch_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
        comment="Total seconds watched, including replays.",
    )
    last_accessed_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    student: Mapped[User] = relationship("User", foreign_keys=[student_id])
    video: Mapped[Optional[Video]] = relationship(
        "Video",
        back_populates="progress_records",
        foreign_keys=[video_id],
    )
    pdf: Mapped[Optional[PDF]] = relationship(
        "PDF",
        back_populates="progress_records",
        foreign_keys=[pdf_id],
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<ContentProgress student={self.student_id}"
            f" completed={self.is_completed}>"
        )
