"""Course test and student grading models.

CourseTest : Test created by a teacher for a course with a Google Form URL & time window.
TestGrade  : Grade and feedback given by a teacher to an enrolled student for a test.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    String,
    Text,
    TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class CourseTest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A test created by a teacher for a specific course."""

    __tablename__ = "course_tests"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_form_url: Mapped[str] = mapped_column(String(512), nullable=False)
    start_time: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False, index=True)
    max_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    course: Mapped[Course] = relationship("Course", lazy="selectin")
    teacher: Mapped[User] = relationship("User", foreign_keys=[teacher_id], lazy="selectin")
    grades: Mapped[list[TestGrade]] = relationship(
        "TestGrade", back_populates="test", cascade="all, delete-orphan", lazy="selectin"
    )


class TestGrade(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Student test grade and teacher feedback."""

    __tablename__ = "test_grades"

    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    graded_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False)

    # Relationships
    test: Mapped[CourseTest] = relationship("CourseTest", back_populates="grades")
    student: Mapped[User] = relationship("User", foreign_keys=[student_id], lazy="selectin")
