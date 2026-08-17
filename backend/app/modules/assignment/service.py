"""Assignment module — service layer.

All business logic for assignment management:

    AssignmentService   Teacher creates, publishes, updates, deletes assignments.
    SubmissionService   Students submit (text or file); teachers grade.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import AppError, ResourceNotFoundError


from app.core.storage import r2
from app.models.audit import AuditLog
from app.models.enums import AuditSeverity, NotificationChannel, NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.modules.assignment.repository import AssignmentRepository, SubmissionRepository
from app.modules.assignment.schemas import (
    ConfirmFileSubmissionRequest,
    CreateAssignmentRequest,
    GradeSubmissionRequest,
    InitiateFileSubmissionRequest,
    SubmitTextRequest,
    UpdateAssignmentRequest,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain errors
# ---------------------------------------------------------------------------


class AssignmentNotFoundError(AppError):
    """Assignment not found or deleted."""

    status_code = 404
    error_code = "AssignmentNotFound"
    message = "Assignment not found."


class AssignmentNotPublishedError(AppError):
    """Assignment is not published yet."""

    status_code = 403
    error_code = "AssignmentNotPublished"
    message = "This assignment is not available yet."


class AlreadySubmittedError(AppError):
    """Student has already submitted this assignment."""

    status_code = 409
    error_code = "AlreadySubmitted"
    message = "You have already submitted this assignment."


class LateSubmissionNotAllowedError(AppError):
    """Late submission rejected by teacher policy."""

    status_code = 403
    error_code = "LateSubmissionNotAllowed"
    message = "The deadline has passed and late submissions are not accepted."


class NotCourseOwnerError(AppError):
    """Teacher does not own the assignment's course."""

    status_code = 403
    error_code = "NotCourseOwner"
    message = "You do not have permission to manage this assignment."


class NotEnrolledError(AppError):
    """Student is not enrolled in the course."""

    status_code = 403
    error_code = "NotEnrolled"
    message = "You must be enrolled in this course to submit assignments."


class ScoreExceedsMaxError(AppError):
    """Awarded score exceeds the assignment's max_score."""

    status_code = 400
    error_code = "ScoreExceedsMax"
    message = "Score cannot exceed the assignment's maximum score."


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------


def _audit(
    db: AsyncSession,
    actor_id: Optional[uuid.UUID],
    actor_role: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    severity: str = AuditSeverity.INFO,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append an audit log record to the session.

    Args:
        db: Async database session.
        actor_id: Acting user UUID.
        actor_role: Denormalized role string.
        action: Dot-notation action string.
        entity_type: Entity category.
        entity_id: Optional entity UUID.
        severity: AuditSeverity value.
        metadata: Optional extra context.
    """
    db.add(
        AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            severity=severity,
            metadata_=metadata or {},
        )
    )


# ===========================================================================
# AssignmentService
# ===========================================================================


class AssignmentService:
    """Teacher management of assignment definitions."""

    def __init__(
        self,
        db: AsyncSession,
        teacher: User,
    ) -> None:
        """Initialize AssignmentService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._repo = AssignmentRepository(db)

    async def _verify_owner(self, course_id: uuid.UUID) -> None:
        """Verify the teacher owns the course.

        Args:
            course_id: The course UUID.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        owner_id = await self._repo.get_course_owner(course_id)
        if owner_id != self._teacher.id:
            raise NotCourseOwnerError()

    async def create(
        self,
        body: CreateAssignmentRequest,
    ) -> dict[str, Any]:
        """Create a new assignment (unpublished by default).

        Args:
            body: Create assignment request.

        Returns:
            dict: AssignmentResponse payload.

        Raises:
            NotCourseOwnerError: If teacher doesn't own the course.
        """
        await self._verify_owner(body.course_id)

        assignment = await self._repo.create(
            course_id=body.course_id,
            title=body.title,
            description=body.description,
            due_at=body.due_at,
            max_score=body.max_score,
            allow_late_submission=body.allow_late_submission,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="assignment.created",
            entity_type="assignment",
            entity_id=assignment.id,
        )

        return _serialize_assignment(assignment, submission_count=0)

    async def list_assignments(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """List all assignments for a course (teacher sees all statuses).

        Args:
            course_id: The course UUID.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple: (list of assignment dicts, total count).
        """
        await self._verify_owner(course_id)

        assignments, total = await self._repo.list_for_course(
            course_id,
            page=page,
            page_size=page_size,
            published_only=False,
        )

        results = []
        for a in assignments:
            count = await self._repo.count_submissions(a.id)
            results.append(_serialize_assignment(a, submission_count=count))
        return results, total

    async def update(
        self,
        assignment_id: uuid.UUID,
        body: UpdateAssignmentRequest,
    ) -> dict[str, Any]:
        """Update assignment metadata.

        Args:
            assignment_id: The assignment UUID.
            body: Update payload.

        Returns:
            dict: Updated AssignmentResponse payload.
        """
        assignment = await self._repo.get_by_id(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()

        await self._verify_owner(assignment.course_id)

        updated = await self._repo.update(
            assignment,
            title=body.title,
            description=body.description,
            due_at=body.due_at,
            max_score=body.max_score,
            allow_late_submission=body.allow_late_submission,
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="assignment.updated",
            entity_type="assignment",
            entity_id=assignment.id,
        )

        count = await self._repo.count_submissions(updated.id)
        return _serialize_assignment(updated, submission_count=count)

    async def publish(
        self,
        assignment_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Publish an assignment, making it visible to enrolled students.

        Args:
            assignment_id: The assignment UUID.

        Returns:
            dict: Updated AssignmentResponse payload.
        """
        assignment = await self._repo.get_by_id(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()

        await self._verify_owner(assignment.course_id)

        updated = await self._repo.update(assignment, is_published=True)

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="assignment.published",
            entity_type="assignment",
            entity_id=assignment.id,
        )

        logger.info(
            "Assignment published: %s (course=%s)", assignment.id, assignment.course_id
        )

        count = await self._repo.count_submissions(updated.id)
        return _serialize_assignment(updated, submission_count=count)

    async def delete(
        self,
        assignment_id: uuid.UUID,
    ) -> None:
        """Soft-delete an assignment.

        Args:
            assignment_id: The assignment UUID.
        """
        assignment = await self._repo.get_by_id(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()

        await self._verify_owner(assignment.course_id)
        await self._repo.soft_delete(assignment)

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="assignment.deleted",
            entity_type="assignment",
            entity_id=assignment_id,
            severity=AuditSeverity.WARNING,
        )


# ===========================================================================
# SubmissionService
# ===========================================================================


class SubmissionService:
    """Handles student submission and teacher grading."""

    def __init__(
        self,
        db: AsyncSession,
        actor: User,
    ) -> None:
        """Initialize SubmissionService.

        Args:
            db: Async database session.
            actor: The authenticated user (student or teacher).
        """
        self._db = db
        self._actor = actor
        self._assignment_repo = AssignmentRepository(db)
        self._submission_repo = SubmissionRepository(db)

    async def _get_published_assignment(
        self, assignment_id: uuid.UUID
    ) -> Any:  # Assignment ORM
        """Fetch a published assignment and verify enrollment.

        Args:
            assignment_id: The assignment UUID.

        Returns:
            Assignment: The published assignment.

        Raises:
            AssignmentNotFoundError: If not found.
            AssignmentNotPublishedError: If not published.
            NotEnrolledError: If student not enrolled.
        """
        assignment = await self._assignment_repo.get_by_id(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()
        if not assignment.is_published:
            raise AssignmentNotPublishedError()

        enrolled = await self._assignment_repo.is_enrolled(
            self._actor.id, assignment.course_id
        )
        if not enrolled:
            raise NotEnrolledError()

        return assignment

    async def _check_late(
        self,
        assignment: Any,
    ) -> bool:
        """Check if the current submission is late.

        Args:
            assignment: The Assignment ORM instance.

        Returns:
            bool: True if late.

        Raises:
            LateSubmissionNotAllowedError: If late and not allowed.
        """
        now = datetime.now(timezone.utc)
        if assignment.due_at and now > assignment.due_at:
            if not assignment.allow_late_submission:
                raise LateSubmissionNotAllowedError()
            return True
        return False

    async def submit_text(
        self,
        assignment_id: uuid.UUID,
        body: SubmitTextRequest,
    ) -> dict[str, Any]:
        """Submit a text-based answer to an assignment.

        Args:
            assignment_id: The assignment UUID.
            body: The text submission payload.

        Returns:
            dict: SubmissionResponse payload.

        Raises:
            AlreadySubmittedError: If already submitted.
        """
        assignment = await self._get_published_assignment(assignment_id)
        is_late = await self._check_late(assignment)

        existing = await self._submission_repo.get_student_submission(
            assignment_id, self._actor.id
        )
        if existing is not None:
            raise AlreadySubmittedError()

        submission = await self._submission_repo.create(
            assignment_id=assignment_id,
            student_id=self._actor.id,
            text_response=body.text_response,
            is_late=is_late,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="assignment.submitted_text",
            entity_type="assignment_submission",
            entity_id=submission.id,
        )

        return _serialize_submission(submission)

    async def initiate_file_submission(
        self,
        body: InitiateFileSubmissionRequest,
    ) -> dict[str, Any]:
        """Generate a presigned R2 PUT URL for a file submission.

        Does NOT create the submission record yet — that happens on
        confirm_file_submission after the frontend uploads to R2.

        Args:
            body: File submission initiation payload.

        Returns:
            dict: FileSubmissionPresignResponse payload.

        Raises:
            AlreadySubmittedError: If already submitted.
        """
        assignment = await self._get_published_assignment(body.assignment_id)
        await self._check_late(assignment)

        existing = await self._submission_repo.get_student_submission(
            body.assignment_id, self._actor.id
        )
        if existing is not None:
            raise AlreadySubmittedError()

        # Validate MIME type (PDF, images, archives)
        allowed_prefixes = (
            "application/pdf",
            "image/",
            "application/zip",
            "application/x-zip",
            "text/",
            "application/msword",
            "application/vnd.openxmlformats",
        )
        if not any(body.content_type.startswith(p) for p in allowed_prefixes):
            raise AppError(
                message="Unsupported file type for submissions.",
                error_code="UnsupportedSubmissionType",
            )

        r2_key = (
            f"courses/{assignment.course_id}/submissions/"
            f"{body.assignment_id}/{self._actor.id}/{body.file_name}"
        )
        upload_url = await r2.generate_presigned_upload_url(
            object_key=r2_key,
            content_type=body.content_type,
        )

        from app.config import get_settings
        expiry = get_settings().R2_PRESIGNED_URL_EXPIRY_UPLOAD

        return {
            "upload_url": upload_url,
            "r2_key": r2_key,
            "expires_in_seconds": expiry,
            "method": "PUT",
        }

    async def confirm_file_submission(
        self,
        body: ConfirmFileSubmissionRequest,
    ) -> dict[str, Any]:
        """Confirm file upload and create submission record.

        Args:
            body: File submission confirmation payload.

        Returns:
            dict: SubmissionResponse payload.

        Raises:
            AlreadySubmittedError: If already submitted.
            AppError: If file not found in R2.
        """
        assignment = await self._get_published_assignment(body.assignment_id)
        is_late = await self._check_late(assignment)

        existing = await self._submission_repo.get_student_submission(
            body.assignment_id, self._actor.id
        )
        if existing is not None:
            raise AlreadySubmittedError()

        exists = await r2.object_exists(body.r2_object_key)
        if not exists:
            raise AppError(
                message="Submission file not found in storage. Please upload again.",
                error_code="SubmissionFileNotInStorage",
            )

        submission = await self._submission_repo.create(
            assignment_id=body.assignment_id,
            student_id=self._actor.id,
            r2_object_key=body.r2_object_key,
            is_late=is_late,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="assignment.submitted_file",
            entity_type="assignment_submission",
            entity_id=submission.id,
        )

        return _serialize_submission(submission)

    async def get_my_submission(
        self,
        assignment_id: uuid.UUID,
    ) -> Optional[dict[str, Any]]:
        """Return the current student's submission for an assignment.

        Args:
            assignment_id: The assignment UUID.

        Returns:
            dict | None: Submission payload or None if not submitted.
        """
        await self._get_published_assignment(assignment_id)
        submission = await self._submission_repo.get_student_submission(
            assignment_id, self._actor.id
        )
        return _serialize_submission(submission) if submission else None

    async def list_submissions(
        self,
        assignment_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        graded_only: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        """List all submissions for an assignment (teacher view).

        Args:
            assignment_id: The assignment UUID.
            page: Page number.
            page_size: Items per page.
            graded_only: If True, return only graded submissions.

        Returns:
            tuple: (list of submission dicts, total count).

        Raises:
            NotCourseOwnerError: If actor is not the course teacher.
        """
        assignment = await self._assignment_repo.get_by_id(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()

        owner_id = await self._assignment_repo.get_course_owner(assignment.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        submissions, total = await self._submission_repo.list_for_assignment(
            assignment_id,
            page=page,
            page_size=page_size,
            graded_only=graded_only,
        )
        return [_serialize_submission(s) for s in submissions], total

    async def grade(
        self,
        submission_id: uuid.UUID,
        body: GradeSubmissionRequest,
    ) -> dict[str, Any]:
        """Grade a student submission.

        Validates score <= assignment.max_score.
        Sends a notification to the student.

        Args:
            submission_id: The submission UUID.
            body: Grading payload.

        Returns:
            dict: Updated submission payload.

        Raises:
            AssignmentNotFoundError: If submission or assignment not found.
            NotCourseOwnerError: If actor is not the course teacher.
            ScoreExceedsMaxError: If score > max_score.
        """
        submission = await self._submission_repo.get_by_id(submission_id)
        if submission is None:
            raise ResourceNotFoundError(message="Submission not found.")

        assignment = await self._assignment_repo.get_by_id(submission.assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError()

        owner_id = await self._assignment_repo.get_course_owner(assignment.course_id)
        if owner_id != self._actor.id:
            raise NotCourseOwnerError()

        if body.score > assignment.max_score:
            raise ScoreExceedsMaxError(
                message=(
                    f"Score {body.score} exceeds max_score {assignment.max_score}."
                )
            )

        updated = await self._submission_repo.grade(
            submission,
            score=body.score,
            feedback=body.feedback,
        )

        # Notify the student
        self._db.add(
            Notification(
                recipient_id=submission.student_id,
                actor_id=self._actor.id,
                type=NotificationType.ASSIGNMENT_GRADED,
                title="Assignment Graded",
                body=(
                    f'Your submission for "{assignment.title}" has been graded. '
                    f"Score: {body.score}/{assignment.max_score}."
                ),
                entity_type="assignment_submission",
                entity_id=submission.id,
                channel=NotificationChannel.IN_APP,
            )
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="assignment.graded",
            entity_type="assignment_submission",
            entity_id=submission.id,
            metadata={"score": body.score, "max_score": assignment.max_score},
        )

        logger.info(
            "Submission graded: %s score=%s/%s",
            submission.id,
            body.score,
            assignment.max_score,
        )

        return _serialize_submission(updated)


# ===========================================================================
# StudentAssignmentService
# ===========================================================================


class StudentAssignmentService:
    """Student-facing read access for assignments."""

    def __init__(self, db: AsyncSession, student: User) -> None:
        """Initialize StudentAssignmentService.

        Args:
            db: Async database session.
            student: The authenticated student user.
        """
        self._db = db
        self._student = student
        self._repo = AssignmentRepository(db)
        self._sub_repo = SubmissionRepository(db)

    async def list_assignments(
        self,
        course_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """List published assignments for a course.

        Args:
            course_id: The course UUID.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple: (list of assignment dicts with my_submission, total).
        """
        enrolled = await self._repo.is_enrolled(self._student.id, course_id)
        if not enrolled:
            raise NotEnrolledError()

        assignments, total = await self._repo.list_for_course(
            course_id,
            page=page,
            page_size=page_size,
            published_only=True,
        )

        results = []
        for a in assignments:
            sub = await self._sub_repo.get_student_submission(a.id, self._student.id)
            data = _serialize_assignment(a, submission_count=0)
            data["my_submission"] = _serialize_submission(sub) if sub else None
            results.append(data)
        return results, total


# ===========================================================================
# Serializers
# ===========================================================================


def _serialize_assignment(assignment: Any, *, submission_count: int) -> dict[str, Any]:
    """Serialize an Assignment ORM instance to a response dict.

    Args:
        assignment: The Assignment ORM instance.
        submission_count: Denormalized submission count.

    Returns:
        dict: AssignmentResponse payload.
    """
    return {
        "id": assignment.id,
        "course_id": assignment.course_id,
        "title": assignment.title,
        "description": assignment.description,
        "due_at": assignment.due_at,
        "max_score": assignment.max_score,
        "is_published": assignment.is_published,
        "allow_late_submission": assignment.allow_late_submission,
        "submission_count": submission_count,
        "created_at": assignment.created_at,
    }


def _serialize_submission(submission: Any) -> dict[str, Any]:
    """Serialize an AssignmentSubmission ORM instance to a response dict.

    Args:
        submission: The AssignmentSubmission ORM instance.

    Returns:
        dict: SubmissionResponse payload.
    """
    return {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "student_id": submission.student_id,
        "r2_object_key": submission.r2_object_key,
        "text_response": submission.text_response,
        "score": submission.score,
        "feedback": submission.feedback,
        "is_late": submission.is_late,
        "submitted_at": submission.submitted_at,
        "reviewed_at": submission.reviewed_at,
    }
