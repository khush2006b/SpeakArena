"""Assignment module — repository layer.

All database I/O for the assignment module. No business logic.

Repositories:
    AssignmentRepository    CRUD for Assignment records.
    SubmissionRepository    CRUD for AssignmentSubmission records.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.course import Course, CourseEnrollment
from app.models.enums import EnrollmentStatus


# ===========================================================================
# AssignmentRepository
# ===========================================================================


class AssignmentRepository:
    """CRUD for Assignment records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        course_id: uuid.UUID,
        title: str,
        description: Optional[str],
        due_at: Optional[datetime],
        max_score: int,
        allow_late_submission: bool,
    ) -> Assignment:
        """Create and persist a new assignment.

        Args:
            course_id: The course UUID.
            title: Assignment title.
            description: Markdown instructions.
            due_at: Optional deadline.
            max_score: Maximum achievable score.
            allow_late_submission: Whether late submissions are accepted.

        Returns:
            Assignment: The persisted record.
        """
        assignment = Assignment(
            course_id=course_id,
            title=title,
            description=description,
            due_at=due_at,
            max_score=max_score,
            allow_late_submission=allow_late_submission,
            is_published=False,
        )
        self._db.add(assignment)
        await self._db.flush()
        return assignment

    async def get_by_id(
        self,
        assignment_id: uuid.UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[Assignment]:
        """Fetch an assignment by primary key.

        Args:
            assignment_id: The assignment UUID.
            include_deleted: If True, include soft-deleted records.

        Returns:
            Assignment | None: The record or None.
        """
        cond = [Assignment.id == assignment_id]
        if not include_deleted:
            cond.append(Assignment.deleted_at.is_(None))
        return (
            await self._db.execute(select(Assignment).where(and_(*cond)))
        ).scalar_one_or_none()

    async def list_for_course(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        published_only: bool = False,
    ) -> tuple[list[Assignment], int]:
        """Return paginated assignments for a course.

        Args:
            course_id: The course UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            published_only: If True, return only published assignments.

        Returns:
            tuple: (list of Assignment records, total count).
        """
        conditions = [
            Assignment.course_id == course_id,
            Assignment.deleted_at.is_(None),
        ]
        if published_only:
            conditions.append(Assignment.is_published.is_(True))

        count_stmt = select(func.count(Assignment.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Assignment)
            .where(and_(*conditions))
            .order_by(Assignment.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self._db.execute(data_stmt)).scalars().all())
        return rows, total

    async def update(
        self,
        assignment: Assignment,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        due_at: Optional[datetime] = None,
        max_score: Optional[int] = None,
        allow_late_submission: Optional[bool] = None,
        is_published: Optional[bool] = None,
    ) -> Assignment:
        """Update mutable fields on an assignment.

        Args:
            assignment: The Assignment ORM instance.
            title: New title.
            description: New markdown description.
            due_at: New deadline.
            max_score: New max score.
            allow_late_submission: New late submission policy.
            is_published: New publication state.

        Returns:
            Assignment: The updated record.
        """
        if title is not None:
            assignment.title = title
        if description is not None:
            assignment.description = description
        if due_at is not None:
            assignment.due_at = due_at
        if max_score is not None:
            assignment.max_score = max_score
        if allow_late_submission is not None:
            assignment.allow_late_submission = allow_late_submission
        if is_published is not None:
            assignment.is_published = is_published
        await self._db.flush()
        return assignment

    async def soft_delete(self, assignment: Assignment) -> None:
        """Soft-delete an assignment.

        Args:
            assignment: The Assignment ORM instance.
        """
        assignment.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def count_submissions(self, assignment_id: uuid.UUID) -> int:
        """Return the total submission count for an assignment.

        Args:
            assignment_id: The assignment UUID.

        Returns:
            int: Total submission count.
        """
        return (
            await self._db.execute(
                select(func.count(AssignmentSubmission.id)).where(
                    AssignmentSubmission.assignment_id == assignment_id
                )
            )
        ).scalar_one()

    async def get_course_owner(self, course_id: uuid.UUID) -> Optional[uuid.UUID]:
        """Return the teacher_id of a course.

        Args:
            course_id: The course UUID.

        Returns:
            uuid.UUID | None: The teacher UUID.
        """
        return (
            await self._db.execute(
                select(Course.teacher_id).where(Course.id == course_id)
            )
        ).scalar_one_or_none()

    async def is_enrolled(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> bool:
        """Check active enrollment for a student.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            bool: True if actively enrolled.
        """
        count = (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == course_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
            )
        ).scalar_one()
        return count > 0


# ===========================================================================
# SubmissionRepository
# ===========================================================================


class SubmissionRepository:
    """CRUD for AssignmentSubmission records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        assignment_id: uuid.UUID,
        student_id: uuid.UUID,
        *,
        text_response: Optional[str] = None,
        r2_object_key: Optional[str] = None,
        is_late: bool = False,
    ) -> AssignmentSubmission:
        """Create a new assignment submission.

        Args:
            assignment_id: The assignment UUID.
            student_id: The student UUID.
            text_response: Optional inline text answer.
            r2_object_key: Optional R2 key of the uploaded file.
            is_late: True if submitted after the deadline.

        Returns:
            AssignmentSubmission: The persisted submission.
        """
        submission = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=student_id,
            text_response=text_response,
            r2_object_key=r2_object_key,
            is_late=is_late,
        )
        self._db.add(submission)
        await self._db.flush()
        return submission

    async def get_by_id(
        self,
        submission_id: uuid.UUID,
    ) -> Optional[AssignmentSubmission]:
        """Fetch a submission by primary key.

        Args:
            submission_id: The submission UUID.

        Returns:
            AssignmentSubmission | None: The record or None.
        """
        return (
            await self._db.execute(
                select(AssignmentSubmission).where(
                    AssignmentSubmission.id == submission_id
                )
            )
        ).scalar_one_or_none()

    async def get_student_submission(
        self,
        assignment_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> Optional[AssignmentSubmission]:
        """Fetch the submission for a specific student and assignment.

        Args:
            assignment_id: The assignment UUID.
            student_id: The student UUID.

        Returns:
            AssignmentSubmission | None: The submission or None.
        """
        return (
            await self._db.execute(
                select(AssignmentSubmission).where(
                    AssignmentSubmission.assignment_id == assignment_id,
                    AssignmentSubmission.student_id == student_id,
                )
            )
        ).scalar_one_or_none()

    async def list_for_assignment(
        self,
        assignment_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        graded_only: bool = False,
    ) -> tuple[list[AssignmentSubmission], int]:
        """Return paginated submissions for an assignment (teacher view).

        Args:
            assignment_id: The assignment UUID.
            page: 1-indexed page.
            page_size: Items per page.
            graded_only: If True, return only graded submissions.

        Returns:
            tuple: (list of submissions, total count).
        """
        conditions = [AssignmentSubmission.assignment_id == assignment_id]
        if graded_only:
            conditions.append(AssignmentSubmission.score.is_not(None))

        count_stmt = select(func.count(AssignmentSubmission.id)).where(
            and_(*conditions)
        )
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(AssignmentSubmission)
            .where(and_(*conditions))
            .order_by(desc(AssignmentSubmission.submitted_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self._db.execute(data_stmt)).scalars().all())
        return rows, total

    async def grade(
        self,
        submission: AssignmentSubmission,
        score: int,
        feedback: Optional[str],
    ) -> AssignmentSubmission:
        """Set the score and feedback on a submission.

        Args:
            submission: The AssignmentSubmission ORM instance.
            score: The awarded score.
            feedback: Optional Markdown feedback text.

        Returns:
            AssignmentSubmission: The updated submission.
        """
        submission.score = score
        submission.feedback = feedback
        submission.reviewed_at = datetime.now(timezone.utc)
        await self._db.flush()
        return submission

    async def update_r2_key(
        self,
        submission: AssignmentSubmission,
        r2_object_key: str,
    ) -> AssignmentSubmission:
        """Update the R2 object key after file upload confirmation.

        Args:
            submission: The AssignmentSubmission ORM instance.
            r2_object_key: The confirmed R2 key.

        Returns:
            AssignmentSubmission: The updated submission.
        """
        submission.r2_object_key = r2_object_key
        await self._db.flush()
        return submission
