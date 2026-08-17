"""Assignment and AssignmentSubmission models.

Fully schema-defined and future-ready. The feature is hidden from
students via is_published=False until the teacher activates it.
No application-layer feature flags are required.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String, Text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Assignment(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Course assignment definition created by the teacher.

    Assignments are hidden from students until is_published=True.
    The due_at field is optional; NULL means no deadline enforced.
    allow_late_submission controls whether submissions are accepted
    after the due_at timestamp.
    """

    __tablename__ = "assignments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None,
        comment="Markdown-formatted assignment instructions.",
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    max_score: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=100, server_default="100"
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    allow_late_submission: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship("Course", back_populates="assignments")
    submissions: Mapped[list[AssignmentSubmission]] = relationship(
        "AssignmentSubmission",
        back_populates="assignment",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Assignment id={self.id} title={self.title!r}>"


class AssignmentSubmission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Student submission for an assignment.

    One submission per student per assignment (UNIQUE constraint).
    The submitted file is stored in R2 (r2_object_key) or provided
    inline as text (text_response). Score and feedback are filled by
    the teacher during review.
    """

    __tablename__ = "assignment_submissions"

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    r2_object_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    text_response: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    score: Mapped[Optional[int]] = mapped_column(
        SmallInteger, nullable=True, default=None
    )
    feedback: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    is_late: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    submitted_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )

    # --- Relationships ---
    assignment: Mapped[Assignment] = relationship(
        "Assignment", back_populates="submissions"
    )
    student: Mapped[User] = relationship("User", foreign_keys=[student_id])

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<AssignmentSubmission assignment={self.assignment_id}"
            f" student={self.student_id}>"
        )
