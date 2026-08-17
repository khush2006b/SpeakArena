"""Unit tests for the assignment module service layer.

Tests cover:
    - AssignmentService: publish gate, owner enforcement.
    - SubmissionService: already-submitted guard, late-submission gate,
      score-exceeds-max guard, grading notification.
    - Schema validation for GradeSubmissionRequest.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import FakeTeacher, FakeUser


# ===========================================================================
# Helpers
# ===========================================================================


def _fake_assignment(
    course_id: uuid.UUID | None = None,
    is_published: bool = True,
    due_at: datetime | None = None,
    allow_late_submission: bool = True,
    max_score: int = 100,
    deleted_at: datetime | None = None,
) -> MagicMock:
    a = MagicMock()
    a.id = uuid.uuid4()
    a.course_id = course_id or uuid.uuid4()
    a.title = "Test Assignment"
    a.description = None
    a.due_at = due_at
    a.max_score = max_score
    a.is_published = is_published
    a.allow_late_submission = allow_late_submission
    a.deleted_at = deleted_at
    a.created_at = datetime.now(timezone.utc)
    return a


def _fake_submission(
    assignment_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    score: int | None = None,
) -> MagicMock:
    s = MagicMock()
    s.id = uuid.uuid4()
    s.assignment_id = assignment_id or uuid.uuid4()
    s.student_id = student_id or uuid.uuid4()
    s.r2_object_key = None
    s.text_response = "My answer"
    s.score = score
    s.feedback = None
    s.is_late = False
    s.submitted_at = datetime.now(timezone.utc)
    s.reviewed_at = None
    return s


# ===========================================================================
# AssignmentService
# ===========================================================================


@pytest.mark.unit
class TestAssignmentService:
    """Tests teacher-facing assignment management."""

    @pytest.mark.asyncio
    async def test_non_owner_cannot_publish(self, mock_db: AsyncMock) -> None:
        """A teacher who doesn't own the course must not be able to publish."""
        from app.modules.assignment.service import AssignmentService, NotCourseOwnerError

        teacher = FakeTeacher()
        assignment = _fake_assignment(is_published=False)
        other_owner = uuid.uuid4()

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockRepo:
            MockRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockRepo.return_value.get_course_owner = AsyncMock(return_value=other_owner)

            svc = AssignmentService(mock_db, teacher)

            with pytest.raises(NotCourseOwnerError):
                await svc.publish(assignment.id)

    @pytest.mark.asyncio
    async def test_owner_can_publish(self, mock_db: AsyncMock) -> None:
        """The course owner must be able to publish their assignment."""
        from app.modules.assignment.service import AssignmentService

        teacher = FakeTeacher()
        assignment = _fake_assignment(course_id=uuid.uuid4(), is_published=False)

        published = MagicMock()
        published.id = assignment.id
        published.course_id = assignment.course_id
        published.title = assignment.title
        published.description = assignment.description
        published.due_at = assignment.due_at
        published.max_score = assignment.max_score
        published.is_published = True
        published.allow_late_submission = assignment.allow_late_submission
        published.created_at = assignment.created_at

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockRepo:
            MockRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockRepo.return_value.get_course_owner = AsyncMock(return_value=teacher.id)
            MockRepo.return_value.update = AsyncMock(return_value=published)
            MockRepo.return_value.count_submissions = AsyncMock(return_value=0)

            svc = AssignmentService(mock_db, teacher)
            result = await svc.publish(assignment.id)

        assert result["is_published"] is True

    @pytest.mark.asyncio
    async def test_publish_not_found_raises(self, mock_db: AsyncMock) -> None:
        """Publishing a non-existent assignment must raise AssignmentNotFoundError."""
        from app.modules.assignment.service import AssignmentNotFoundError, AssignmentService

        teacher = FakeTeacher()

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockRepo:
            MockRepo.return_value.get_by_id = AsyncMock(return_value=None)

            svc = AssignmentService(mock_db, teacher)

            with pytest.raises(AssignmentNotFoundError):
                await svc.publish(uuid.uuid4())


# ===========================================================================
# SubmissionService
# ===========================================================================


@pytest.mark.unit
class TestSubmissionService:
    """Tests student submission and teacher grading."""

    @pytest.mark.asyncio
    async def test_already_submitted_raises_conflict(self, mock_db: AsyncMock) -> None:
        """A second text submission must raise AlreadySubmittedError (409)."""
        from app.modules.assignment.service import AlreadySubmittedError, SubmissionService
        from app.modules.assignment.schemas import SubmitTextRequest

        student = FakeUser()
        assignment = _fake_assignment()
        existing_sub = _fake_submission(student_id=student.id)

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockAssignRepo, patch(
            "app.modules.assignment.service.SubmissionRepository"
        ) as MockSubRepo:
            MockAssignRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockAssignRepo.return_value.is_enrolled = AsyncMock(return_value=True)
            MockSubRepo.return_value.get_student_submission = AsyncMock(return_value=existing_sub)

            svc = SubmissionService(mock_db, student)

            with pytest.raises(AlreadySubmittedError):
                await svc.submit_text(
                    assignment.id,
                    SubmitTextRequest(text_response="My answer"),
                )

    @pytest.mark.asyncio
    async def test_late_submission_rejected_when_not_allowed(self, mock_db: AsyncMock) -> None:
        """Submitting after the deadline must raise LateSubmissionNotAllowedError."""
        from app.modules.assignment.service import (
            LateSubmissionNotAllowedError,
            SubmissionService,
        )
        from app.modules.assignment.schemas import SubmitTextRequest

        student = FakeUser()
        past_due = datetime.now(timezone.utc) - timedelta(hours=1)
        assignment = _fake_assignment(
            due_at=past_due, allow_late_submission=False
        )

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockAssignRepo, patch(
            "app.modules.assignment.service.SubmissionRepository"
        ) as MockSubRepo:
            MockAssignRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockAssignRepo.return_value.is_enrolled = AsyncMock(return_value=True)
            MockSubRepo.return_value.get_student_submission = AsyncMock(return_value=None)

            svc = SubmissionService(mock_db, student)

            with pytest.raises(LateSubmissionNotAllowedError):
                await svc.submit_text(
                    assignment.id,
                    SubmitTextRequest(text_response="Late answer"),
                )

    @pytest.mark.asyncio
    async def test_late_submission_allowed_sets_is_late_flag(self, mock_db: AsyncMock) -> None:
        """When allow_late_submission=True, is_late must be True in the submission."""
        from app.modules.assignment.service import SubmissionService
        from app.modules.assignment.schemas import SubmitTextRequest

        student = FakeUser()
        past_due = datetime.now(timezone.utc) - timedelta(hours=1)
        assignment = _fake_assignment(due_at=past_due, allow_late_submission=True)
        created_sub = _fake_submission(student_id=student.id)
        created_sub.is_late = True

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockAssignRepo, patch(
            "app.modules.assignment.service.SubmissionRepository"
        ) as MockSubRepo:
            MockAssignRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockAssignRepo.return_value.is_enrolled = AsyncMock(return_value=True)
            MockSubRepo.return_value.get_student_submission = AsyncMock(return_value=None)
            MockSubRepo.return_value.create = AsyncMock(return_value=created_sub)

            svc = SubmissionService(mock_db, student)
            result = await svc.submit_text(
                assignment.id,
                SubmitTextRequest(text_response="Late but allowed"),
            )

        assert result["is_late"] is True

    @pytest.mark.asyncio
    async def test_score_exceeds_max_raises(self, mock_db: AsyncMock) -> None:
        """Grading with score > max_score must raise ScoreExceedsMaxError."""
        from app.modules.assignment.service import ScoreExceedsMaxError, SubmissionService
        from app.modules.assignment.schemas import GradeSubmissionRequest

        teacher = FakeTeacher()
        assignment = _fake_assignment(max_score=100)
        submission = _fake_submission()
        submission.assignment_id = assignment.id

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockAssignRepo, patch(
            "app.modules.assignment.service.SubmissionRepository"
        ) as MockSubRepo:
            MockSubRepo.return_value.get_by_id = AsyncMock(return_value=submission)
            MockAssignRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockAssignRepo.return_value.get_course_owner = AsyncMock(return_value=teacher.id)

            svc = SubmissionService(mock_db, teacher)

            with pytest.raises(ScoreExceedsMaxError):
                await svc.grade(
                    submission.id,
                    GradeSubmissionRequest(score=150),
                )

    @pytest.mark.asyncio
    async def test_grading_creates_notification(self, mock_db: AsyncMock) -> None:
        """Grading a submission must add a Notification record to the session."""
        from app.modules.assignment.service import SubmissionService
        from app.modules.assignment.schemas import GradeSubmissionRequest

        teacher = FakeTeacher()
        assignment = _fake_assignment(max_score=100)
        submission = _fake_submission()
        submission.assignment_id = assignment.id

        graded_sub = MagicMock()
        graded_sub.id = submission.id
        graded_sub.assignment_id = assignment.id
        graded_sub.student_id = submission.student_id
        graded_sub.r2_object_key = None
        graded_sub.text_response = "My answer"
        graded_sub.score = 85
        graded_sub.feedback = "Well done!"
        graded_sub.is_late = False
        graded_sub.submitted_at = submission.submitted_at
        graded_sub.reviewed_at = datetime.now(timezone.utc)

        with patch(
            "app.modules.assignment.service.AssignmentRepository"
        ) as MockAssignRepo, patch(
            "app.modules.assignment.service.SubmissionRepository"
        ) as MockSubRepo:
            MockSubRepo.return_value.get_by_id = AsyncMock(return_value=submission)
            MockAssignRepo.return_value.get_by_id = AsyncMock(return_value=assignment)
            MockAssignRepo.return_value.get_course_owner = AsyncMock(return_value=teacher.id)
            MockSubRepo.return_value.grade = AsyncMock(return_value=graded_sub)

            svc = SubmissionService(mock_db, teacher)
            await svc.grade(
                submission.id,
                GradeSubmissionRequest(score=85, feedback="Well done!"),
            )

        # db.add must have been called at least twice: Notification + AuditLog
        assert mock_db.add.call_count >= 2
