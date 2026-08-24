"""Meeting module — Service layer.

All business logic lives here. Services never import HTTP primitives.
Every service raises domain exceptions (from app.core.exceptions.errors)
which are converted to HTTP responses by the global exception handler.

Services:
    MeetingValidationService  : Pure validation (no DB). Link, time, status.
    MeetingService            : Meeting CRUD, duplicate, recurring.
    AttendanceService         : Join/leave flow, attendance computation.
    MeetingAnalyticsService   : Stats aggregation for teachers.
    MeetingNotificationService: In-app notification dispatch.
    GoogleMeetService         : Provider-aware meeting operations.

Join Security Pipeline (AttendanceService.join_meeting):
    1. Verify JWT (enforced by FastAPI dependency before service call).
    2. Verify enrollment in the course (or teacher ownership).
    3. Verify meeting status is 'live' or 'scheduled' (early join window).
    4. Verify the current time is within the join window.
    5. Verify meeting is not at participant capacity.
    6. Record AttendanceEvent(join).
    7. Write AuditLog.
    8. Return JoinResponse with provider_data containing the meet link.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import (
    AppError,
    DuplicateMeetingLinkError,
    EarlyJoinNotAllowedError,
    InvalidMeetingLinkError,
    LateJoinNotPermittedError,
    MeetingAlreadyLiveError,
    MeetingAtCapacityError,
    MeetingCancelledError,
    MeetingExpiredError,
    MeetingLockedError,
    MeetingNotFoundError,
    MeetingNotStartedError,
    MeetingOwnershipError,
    NotEnrolledInCourseError,
)
from app.models.audit import AuditLog
from app.models.enums import (
    AttendanceEventType,
    AttendanceStatus,
    AuditSeverity,
    MeetingStatus,
    NotificationChannel,
    NotificationType,
)
from app.models.meeting import Meeting, SessionAttendance
from app.models.notification import Notification
from app.models.user import User
from app.modules.meeting.providers import GoogleMeetProvider, MeetingProvider
from app.modules.meeting.repository import (
    AttendanceRepository,
    MeetingAnalyticsRepository,
    MeetingRepository,
)
from app.modules.meeting.schemas import (
    AttendanceMarkRequest,
    AttendanceSummaryResponse,
    CancelMeetingRequest,
    CreateMeetingRequest,
    DuplicateMeetingRequest,
    EndMeetingRequest,
    GoLiveRequest,
    JoinResponse,
    RecurringMeetingRequest,
    UpdateMeetingRequest,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Join window constants
# ---------------------------------------------------------------------------

# Students may join this many minutes before the scheduled start time.
EARLY_JOIN_WINDOW_MINUTES: int = 10

# Students are barred from joining this many minutes after scheduled end.
LATE_JOIN_WINDOW_MINUTES: int = 30

# A student is considered 'late' if they joined this many minutes after start.
LATE_THRESHOLD_MINUTES: int = 10

# Minimum attendance percentage to be considered 'present' (not partial).
PRESENT_THRESHOLD_PCT: float = 75.0


# ===========================================================================
# Provider registry
# ===========================================================================

_PROVIDERS: dict[str, MeetingProvider] = {
    "google_meet": GoogleMeetProvider(),
}


def _get_provider(provider_name: str) -> MeetingProvider:
    """Return the MeetingProvider for the given provider name.

    Args:
        provider_name: Provider identifier string (e.g. 'google_meet').

    Returns:
        MeetingProvider: The provider implementation.

    Raises:
        AppError: If the provider is not registered.
    """
    provider = _PROVIDERS.get(provider_name)
    if provider is None:
        raise AppError(
            message=f"Meeting provider '{provider_name}' is not supported.",
            error_code="UnsupportedProvider",
        )
    return provider


# ===========================================================================
# MeetingValidationService
# ===========================================================================


class MeetingValidationService:
    """Pure, stateless validation service for meeting operations.

    Contains no database access. All methods validate inputs and raise
    domain exceptions on failure.
    """

    @staticmethod
    def validate_meet_link(
        meet_link: str, provider_name: str = "google_meet"
    ) -> str:
        """Validate and normalize a meeting provider link.

        Args:
            meet_link: Raw URL submitted by the teacher.
            provider_name: Provider to validate against.

        Returns:
            str: The normalized canonical URL for DB storage.

        Raises:
            InvalidMeetingLinkError: If the URL fails format validation.
        """
        provider = _get_provider(provider_name)
        provider.validate_link(meet_link)
        return provider.normalize_link(meet_link)

    @staticmethod
    def validate_scheduled_at(scheduled_at: datetime) -> None:
        """Validate that the scheduled start time is in the future.

        Args:
            scheduled_at: Proposed meeting start datetime.

        Raises:
            AppError: If the time is in the past (>5 minutes tolerance).
        """
        now = datetime.now(timezone.utc)
        # Ensure timezone-aware comparison
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        if scheduled_at < now - timedelta(minutes=5):
            raise AppError(
                message="Meeting start time must be in the future.",
                error_code="MeetingInPast",
            )

    @staticmethod
    def validate_status_transition(current: str, target: str) -> None:
        """Validate that a status transition is legal.

        Valid transitions::
            draft      → scheduled
            scheduled  → live, cancelled, expired
            live       → completed, cancelled
            completed  → archived

        Args:
            current: Current MeetingStatus value.
            target: Target MeetingStatus value.

        Raises:
            AppError: If the transition is not permitted.
        """
        allowed: dict[str, set[str]] = {
            MeetingStatus.DRAFT: {MeetingStatus.SCHEDULED, MeetingStatus.CANCELLED},
            MeetingStatus.SCHEDULED: {
                MeetingStatus.LIVE,
                MeetingStatus.CANCELLED,
                MeetingStatus.EXPIRED,
            },
            MeetingStatus.LIVE: {MeetingStatus.COMPLETED, MeetingStatus.CANCELLED},
            MeetingStatus.COMPLETED: {MeetingStatus.ARCHIVED},
            MeetingStatus.CANCELLED: set(),
            MeetingStatus.EXPIRED: set(),
            MeetingStatus.ARCHIVED: set(),
        }
        if target not in allowed.get(current, set()):
            raise AppError(
                message=f"Cannot transition meeting from '{current}' to '{target}'.",
                error_code="InvalidStatusTransition",
            )

    @staticmethod
    def check_join_window(meeting: Meeting) -> None:
        """Validate that the current time is within the allowed join window.

        Early join: allowed EARLY_JOIN_WINDOW_MINUTES before scheduled_at.
        Late join: blocked LATE_JOIN_WINDOW_MINUTES after scheduled end.

        Args:
            meeting: The meeting ORM instance to validate against.

        Raises:
            MeetingNotStartedError: Too early to join.
            EarlyJoinNotAllowedError: Not within early window.
            LateJoinNotPermittedError: Late-join window has closed.
            MeetingExpiredError: Meeting is past its end time by a lot.
        """
        now = datetime.now(timezone.utc)
        scheduled_at = meeting.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        window_open = scheduled_at - timedelta(minutes=EARLY_JOIN_WINDOW_MINUTES)
        window_close = scheduled_at + timedelta(
            minutes=meeting.duration_minutes + LATE_JOIN_WINDOW_MINUTES
        )

        if now < window_open:
            raise EarlyJoinNotAllowedError(
                message=(
                    f"This meeting starts at {scheduled_at.strftime('%H:%M UTC')}. "
                    f"You may join up to {EARLY_JOIN_WINDOW_MINUTES} minutes before."
                )
            )

        if now > window_close:
            raise LateJoinNotPermittedError(
                message="The late-join window for this meeting has closed."
            )


# ===========================================================================
# MeetingService
# ===========================================================================


class MeetingService:
    """Meeting CRUD and lifecycle management.

    Handles all teacher-facing meeting operations:
        - Create, read, update, soft-delete.
        - Publish (scheduled), cancel, go-live, end.
        - Duplicate a meeting with a new time.
        - Schedule a recurring meeting series.

    Args:
        db: Async SQLAlchemy session.
        current_user: The authenticated user (teacher).
    """

    def __init__(self, db: AsyncSession, current_user: User) -> None:
        """Initialize the service."""
        self._db = db
        self._user = current_user
        self._repo = MeetingRepository(db)
        self._validator = MeetingValidationService()
        self._notifier = MeetingNotificationService(db)

    async def create_meeting(
        self, body: CreateMeetingRequest
    ) -> dict[str, Any]:
        """Create a new scheduled meeting.

        Validates the Google Meet link, normalizes it, checks for
        duplicates, verifies course ownership, then creates the record.

        Args:
            body: Validated CreateMeetingRequest payload.

        Returns:
            dict[str, Any]: Serialized meeting record (no meet_link).

        Raises:
            MeetingOwnershipError: If the teacher doesn't own the course.
            InvalidMeetingLinkError: If the link fails format validation.
            DuplicateMeetingLinkError: If the link is already used.
            AppError: If the scheduled_at is in the past.
        """
        # Verify course ownership
        owner_id = await self._repo.get_course_owner(body.course_id)
        if owner_id != self._user.id:
            raise MeetingOwnershipError(
                message="You do not own this course and cannot create meetings for it."
            )

        # Validate and normalize the meet link
        normalized_link = MeetingValidationService.validate_meet_link(body.meet_link)

        # Check for duplicate link
        duplicate = await self._repo.get_by_meet_link(normalized_link)
        if duplicate is not None:
            raise DuplicateMeetingLinkError()

        # Validate scheduled time
        MeetingValidationService.validate_scheduled_at(body.scheduled_at)

        scheduled_at = body.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        data: dict[str, Any] = {
            "course_id": body.course_id,
            "teacher_id": self._user.id,
            "title": body.title,
            "description": body.description,
            "instructions": body.instructions if hasattr(body, "instructions") else None,
            "meet_link": normalized_link,
            "provider": "google_meet",
            "scheduled_at": scheduled_at,
            "duration_minutes": body.duration_minutes,
            "max_participants": body.max_participants,
            "visibility": body.visibility,
            "status": MeetingStatus.SCHEDULED,
            "metadata_": body.metadata or {},
        }

        meeting = await self._repo.create(data)

        # Audit log
        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.created",
            entity_type="meeting",
            entity_id=meeting.id,
            severity=AuditSeverity.INFO,
            metadata_={"title": meeting.title, "course_id": str(body.course_id)},
        ))

        # Send notifications to enrolled students
        await self._notifier.notify_meeting_created(meeting)

        logger.info(
            "Meeting created",
            extra={"meeting_id": str(meeting.id), "teacher_id": str(self._user.id)},
        )

        return self._serialize_meeting(meeting)

    async def get_meeting(
        self, meeting_id: uuid.UUID
    ) -> dict[str, Any]:
        """Fetch full meeting detail.

        For teachers: all fields including notes. For students: filtered.
        Security: meet_link never included.

        Args:
            meeting_id: UUID of the meeting.

        Returns:
            dict[str, Any]: Serialized meeting detail.

        Raises:
            MeetingNotFoundError: If the meeting does not exist.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        return self._serialize_meeting_detail(meeting)

    async def list_meetings(
        self,
        course_id: Optional[uuid.UUID],
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        sort_by: str = "scheduled_at",
        sort_order: str = "asc",
    ) -> tuple[list[dict[str, Any]], int]:
        """List meetings with pagination and filters.

        Args:
            course_id: Optional course filter.
            page: Page number.
            page_size: Items per page.
            status: Optional status filter.
            sort_by: Sort column name.
            sort_order: 'asc' or 'desc'.

        Returns:
            tuple[list[dict], int]: Serialized meetings and total count.
        """
        meetings, total = await self._repo.list_for_course(
            course_id=course_id,
            page=page,
            page_size=page_size,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return [self._serialize_meeting(m) for m in meetings], total

    async def update_meeting(
        self,
        meeting_id: uuid.UUID,
        body: UpdateMeetingRequest,
    ) -> dict[str, Any]:
        """Apply a partial update to a meeting.

        Args:
            meeting_id: UUID of the meeting to update.
            body: Partial update payload.

        Returns:
            dict[str, Any]: Updated meeting record.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own this meeting.
            InvalidMeetingLinkError: New meet link is invalid.
            DuplicateMeetingLinkError: New link already used elsewhere.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        updates: dict[str, Any] = {}

        if body.title is not None:
            updates["title"] = body.title
        if body.description is not None:
            updates["description"] = body.description
        if body.instructions is not None:
            updates["instructions"] = body.instructions
        if body.duration_minutes is not None:
            updates["duration_minutes"] = body.duration_minutes
        if body.max_participants is not None:
            updates["max_participants"] = body.max_participants
        if body.visibility is not None:
            updates["visibility"] = body.visibility
        if body.notes is not None:
            updates["notes"] = body.notes
        if body.metadata is not None:
            updates["metadata_"] = body.metadata

        if body.scheduled_at is not None:
            MeetingValidationService.validate_scheduled_at(body.scheduled_at)
            sat = body.scheduled_at
            if sat.tzinfo is None:
                sat = sat.replace(tzinfo=timezone.utc)
            updates["scheduled_at"] = sat

        if body.meet_link is not None:
            normalized = MeetingValidationService.validate_meet_link(body.meet_link)
            duplicate = await self._repo.get_by_meet_link(normalized, exclude_id=meeting_id)
            if duplicate is not None:
                raise DuplicateMeetingLinkError()
            updates["meet_link"] = normalized

        updated = await self._repo.update(meeting_id, updates)

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.updated",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.INFO,
            metadata_={"fields_updated": list(updates.keys())},
        ))

        if updated and (body.scheduled_at is not None or body.meet_link is not None):
            await self._notifier.notify_meeting_updated(updated)

        return self._serialize_meeting(updated)

    async def cancel_meeting(
        self,
        meeting_id: uuid.UUID,
        body: CancelMeetingRequest,
    ) -> dict[str, Any]:
        """Cancel a meeting and notify enrolled students.

        Args:
            meeting_id: UUID of the meeting to cancel.
            body: Cancellation request with reason.

        Returns:
            dict[str, Any]: Updated (cancelled) meeting record.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
            AppError: If the meeting is already in a terminal state.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        MeetingValidationService.validate_status_transition(
            meeting.status, MeetingStatus.CANCELLED
        )

        updated = await self._repo.set_status(meeting_id, MeetingStatus.CANCELLED)

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.cancelled",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.WARNING,
            metadata_={"reason": body.reason},
        ))

        if body.notify_students:
            await self._notifier.notify_meeting_cancelled(updated, reason=body.reason)

        logger.info(
            "Meeting cancelled",
            extra={"meeting_id": str(meeting_id), "reason": body.reason},
        )

        return self._serialize_meeting(updated)

    async def delete_meeting(self, meeting_id: uuid.UUID) -> None:
        """Soft-delete a meeting.

        Only draft or cancelled meetings may be hard-soft-deleted. Live
        or completed meetings must be cancelled first.

        Args:
            meeting_id: UUID of the meeting to delete.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
            AppError: If the meeting is live (cannot delete while live).
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            return
        user_role = str(getattr(self._user, "role", "")).lower()
        if meeting.teacher_id != self._user.id and "admin" not in user_role and "teacher" not in user_role:
            raise MeetingOwnershipError()
        if meeting.status == MeetingStatus.LIVE:
            raise AppError(
                message="Cannot delete a live meeting. End the meeting first.",
                error_code="MeetingIsLive",
            )

        await self._repo.soft_delete(meeting_id)

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.deleted",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.WARNING,
            metadata_={"title": meeting.title},
        ))

        logger.info(
            "Meeting soft-deleted",
            extra={"meeting_id": str(meeting_id)},
        )

    async def duplicate_meeting(
        self,
        meeting_id: uuid.UUID,
        body: DuplicateMeetingRequest,
    ) -> dict[str, Any]:
        """Duplicate an existing meeting with a new time and link.

        Copies all fields from the original, applies overrides from body.

        Args:
            meeting_id: UUID of the meeting to copy.
            body: New scheduled_at, optional title, and new meet_link.

        Returns:
            dict[str, Any]: The newly created duplicate meeting.

        Raises:
            MeetingNotFoundError: Original meeting not found.
            MeetingOwnershipError: Caller doesn't own the original.
            InvalidMeetingLinkError: New link is invalid.
            DuplicateMeetingLinkError: New link is already in use.
        """
        original = await self._repo.get_by_id(meeting_id)
        if original is None:
            raise MeetingNotFoundError()
        if original.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        # Validate new link
        normalized_link = MeetingValidationService.validate_meet_link(body.meet_link)
        duplicate = await self._repo.get_by_meet_link(normalized_link)
        if duplicate is not None:
            raise DuplicateMeetingLinkError()

        scheduled_at = body.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        MeetingValidationService.validate_scheduled_at(scheduled_at)

        data: dict[str, Any] = {
            "course_id": original.course_id,
            "teacher_id": self._user.id,
            "title": body.title or f"{original.title} (Copy)",
            "description": original.description,
            "meet_link": normalized_link,
            "provider": original.provider,
            "scheduled_at": scheduled_at,
            "duration_minutes": original.duration_minutes,
            "max_participants": original.max_participants,
            "visibility": original.visibility,
            "status": MeetingStatus.SCHEDULED,
            "metadata_": original.metadata_ or {},
        }

        new_meeting = await self._repo.create(data)

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.duplicated",
            entity_type="meeting",
            entity_id=new_meeting.id,
            severity=AuditSeverity.INFO,
            metadata_={"original_id": str(meeting_id)},
        ))

        return self._serialize_meeting(new_meeting)

    async def create_recurring(
        self, body: RecurringMeetingRequest
    ) -> list[dict[str, Any]]:
        """Schedule a series of recurring meetings.

        Generates `body.occurrences` meetings spaced by `body.frequency`.
        All sessions share the same meet_link. Titles are suffixed with
        ' #N' (e.g. 'Weekly Q&A #1', 'Weekly Q&A #2').

        Args:
            body: Recurring meeting configuration.

        Returns:
            list[dict[str, Any]]: All created meeting records.

        Raises:
            MeetingOwnershipError: Caller doesn't own the course.
            InvalidMeetingLinkError: Meet link is invalid.
            DuplicateMeetingLinkError: Meet link already used.
        """
        owner_id = await self._repo.get_course_owner(body.course_id)
        if owner_id != self._user.id:
            raise MeetingOwnershipError(
                message="You do not own this course."
            )

        normalized_link = MeetingValidationService.validate_meet_link(body.meet_link)
        duplicate = await self._repo.get_by_meet_link(normalized_link)
        if duplicate is not None:
            raise DuplicateMeetingLinkError()

        deltas: dict[str, timedelta] = {
            "daily": timedelta(days=1),
            "weekly": timedelta(weeks=1),
            "biweekly": timedelta(weeks=2),
            "monthly": timedelta(days=30),
        }
        delta = deltas[body.frequency]

        first = body.first_session_at
        if first.tzinfo is None:
            first = first.replace(tzinfo=timezone.utc)

        created: list[dict[str, Any]] = []
        for n in range(body.occurrences):
            session_at = first + (delta * n)
            data: dict[str, Any] = {
                "course_id": body.course_id,
                "teacher_id": self._user.id,
                "title": f"{body.title} #{n + 1}",
                "description": body.description,
                "meet_link": normalized_link,
                "provider": "google_meet",
                "scheduled_at": session_at,
                "duration_minutes": body.duration_minutes,
                "max_participants": body.max_participants,
                "visibility": body.visibility,
                "status": MeetingStatus.SCHEDULED,
                "metadata_": {"series_frequency": body.frequency, "occurrence": n + 1},
            }
            meeting = await self._repo.create(data)
            created.append(self._serialize_meeting(meeting))

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.recurring_series_created",
            entity_type="course",
            entity_id=body.course_id,
            severity=AuditSeverity.INFO,
            metadata_={
                "count": body.occurrences,
                "frequency": body.frequency,
                "title": body.title,
            },
        ))

        logger.info(
            "Recurring series created",
            extra={"count": body.occurrences, "course_id": str(body.course_id)},
        )

        return created

    async def go_live(
        self, meeting_id: uuid.UUID, body: GoLiveRequest
    ) -> dict[str, Any]:
        """Transition a meeting from 'scheduled' to 'live'.

        Args:
            meeting_id: UUID of the meeting.
            body: Optional actual_start_override.

        Returns:
            dict[str, Any]: Updated meeting record.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
            MeetingAlreadyLiveError: Meeting is already live.
            AppError: If transition is not valid from current status.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()
        if meeting.status == MeetingStatus.LIVE:
            raise MeetingAlreadyLiveError()

        MeetingValidationService.validate_status_transition(
            meeting.status, MeetingStatus.LIVE
        )

        actual_start = body.actual_start_override or datetime.now(timezone.utc)
        if actual_start.tzinfo is None:
            actual_start = actual_start.replace(tzinfo=timezone.utc)

        updated = await self._repo.set_status(
            meeting_id,
            MeetingStatus.LIVE,
            extra={"actual_started_at": actual_start},
        )

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.went_live",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.INFO,
            metadata_={"actual_started_at": actual_start.isoformat()},
        ))

        await self._notifier.notify_meeting_live(updated)

        logger.info("Meeting went live", extra={"meeting_id": str(meeting_id)})

        return self._serialize_meeting(updated)

    async def end_meeting(
        self, meeting_id: uuid.UUID, body: EndMeetingRequest
    ) -> dict[str, Any]:
        """Transition a meeting from 'live' to 'completed'.

        Computes and finalizes attendance records for all participants.

        Args:
            meeting_id: UUID of the meeting.
            body: Optional actual_end_override.

        Returns:
            dict[str, Any]: Updated meeting record.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
            AppError: If the meeting is not currently live.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        MeetingValidationService.validate_status_transition(
            meeting.status, MeetingStatus.COMPLETED
        )

        actual_end = body.actual_end_override or datetime.now(timezone.utc)
        if actual_end.tzinfo is None:
            actual_end = actual_end.replace(tzinfo=timezone.utc)

        updated = await self._repo.set_status(
            meeting_id,
            MeetingStatus.COMPLETED,
            extra={"actual_ended_at": actual_end},
        )

        # Finalize attendance for all participants who didn't explicitly leave
        att_svc = AttendanceService(self._db, self._user)
        await att_svc.finalize_attendance(meeting_id, actual_end, meeting)

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.ended",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.INFO,
            metadata_={"actual_ended_at": actual_end.isoformat()},
        ))

        await self._notifier.notify_meeting_ended(updated)

        logger.info("Meeting ended", extra={"meeting_id": str(meeting_id)})

        return self._serialize_meeting(updated)

    # ---------------------------------------------------------------------------
    # Private serializers
    # ---------------------------------------------------------------------------

    @staticmethod
    def _serialize_meeting(meeting: Optional[Meeting]) -> dict[str, Any]:
        """Serialize a Meeting ORM instance to a safe dict.

        NEVER includes meet_link.

        Args:
            meeting: Meeting ORM instance or None.

        Returns:
            dict[str, Any]: Safe serialized meeting.
        """
        if meeting is None:
            return {}
        now = datetime.now(timezone.utc)
        scheduled_at = meeting.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        window_open = scheduled_at - timedelta(minutes=EARLY_JOIN_WINDOW_MINUTES)
        window_close = scheduled_at + timedelta(
            minutes=meeting.duration_minutes + LATE_JOIN_WINDOW_MINUTES
        )
        can_join = (
            meeting.status in (MeetingStatus.SCHEDULED, MeetingStatus.LIVE)
            and window_open <= now <= window_close
        )

        effective_status = meeting.status
        if effective_status == MeetingStatus.SCHEDULED and now > window_close:
            effective_status = MeetingStatus.EXPIRED

        return {
            "id": str(meeting.id),
            "course_id": str(meeting.course_id),
            "teacher_id": str(meeting.teacher_id),
            "title": meeting.title,
            "description": meeting.description,
            "instructions": getattr(meeting, "instructions", None),
            "scheduled_at": scheduled_at.isoformat(),
            "duration_minutes": meeting.duration_minutes,
            "actual_started_at": (
                meeting.actual_started_at.isoformat()
                if meeting.actual_started_at
                else None
            ),
            "actual_ended_at": (
                meeting.actual_ended_at.isoformat()
                if meeting.actual_ended_at
                else None
            ),
            "status": effective_status,
            "provider": meeting.provider,
            "max_participants": meeting.max_participants,
            "visibility": getattr(meeting, "visibility", "public"),
            "is_live": effective_status == MeetingStatus.LIVE,
            "can_join": can_join,
            "created_at": meeting.created_at.isoformat(),
        }

    @staticmethod
    def _serialize_meeting_detail(meeting: Meeting) -> dict[str, Any]:
        """Serialize a Meeting to its detail form.

        Includes teacher-only fields (notes, recording_r2_key) but
        NEVER includes meet_link.

        Args:
            meeting: Meeting ORM instance.

        Returns:
            dict[str, Any]: Extended serialized meeting.
        """
        base = MeetingService._serialize_meeting(meeting)
        base["notes"] = getattr(meeting, "notes", None)
        base["recording_r2_key"] = meeting.recording_r2_key
        base["metadata"] = meeting.metadata_ or {}
        base["attendance_count"] = len(getattr(meeting, "attendance_records", []))
        return base


# ===========================================================================
# AttendanceService
# ===========================================================================


class AttendanceService:
    """Student join/leave tracking and attendance computation.

    Implements the full join security pipeline:
        1. Authentication (enforced by dependency before this service).
        2. Enrollment or teacher-ownership verification.
        3. Meeting status and window validation.
        4. Capacity check.
        5. Attendance event recording.
        6. Audit log.
        7. Secure join response generation.

    Args:
        db: Async SQLAlchemy session.
        current_user: The authenticated user.
    """

    def __init__(self, db: AsyncSession, current_user: User) -> None:
        """Initialize the service."""
        self._db = db
        self._user = current_user
        self._repo = MeetingRepository(db)
        self._att_repo = AttendanceRepository(db)

    async def join_meeting(
        self, meeting_id: uuid.UUID
    ) -> dict[str, Any]:
        """Execute the full join security pipeline and return join payload.

        Pipeline steps:
            1. Load meeting (404 if not found/deleted).
            2. Check meeting status (cancelled/expired/completed block join).
            3. Verify enrollment (students) or ownership (teachers).
            4. Validate time window (early/late join limits).
            5. Check participant capacity.
            6. Record join AttendanceEvent.
            7. Write AuditLog entry.
            8. Return provider join payload (includes meet_link).

        Args:
            meeting_id: UUID of the meeting to join.

        Returns:
            dict[str, Any]: JoinResponse-compatible dict with provider_data
                containing the actual meet link.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingCancelledError: Meeting was cancelled.
            MeetingExpiredError: Meeting has expired.
            NotEnrolledInCourseError: Student is not enrolled.
            EarlyJoinNotAllowedError: Too early to join.
            LateJoinNotPermittedError: Too late to join.
            MeetingAtCapacityError: Maximum participants reached.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()

        # Step 2: Status checks
        if meeting.status == MeetingStatus.CANCELLED:
            raise MeetingCancelledError()
        if meeting.status in (MeetingStatus.EXPIRED, MeetingStatus.ARCHIVED):
            raise MeetingExpiredError()
        if meeting.status == MeetingStatus.COMPLETED:
            raise MeetingExpiredError(
                message="This meeting has already ended."
            )
        if meeting.status == MeetingStatus.DRAFT:
            raise MeetingNotStartedError(
                message="This meeting is not yet published."
            )

        # Step 3: Enrollment check (teachers bypass enrollment check)
        is_teacher = meeting.teacher_id == self._user.id
        if not is_teacher:
            enrolled = await self._repo.is_enrolled(self._user.id, meeting.course_id)
            if not enrolled:
                raise NotEnrolledInCourseError()

        # Step 4: Time window validation (teachers bypass window for management)
        if not is_teacher:
            MeetingValidationService.check_join_window(meeting)

        # Step 5: Capacity check
        if meeting.max_participants is not None:
            current_count = await self._repo.count_current_participants(meeting_id)
            if current_count >= meeting.max_participants:
                raise MeetingAtCapacityError()

        now = datetime.now(timezone.utc)

        # Step 6: Upsert SessionAttendance and record join event
        scheduled_at = meeting.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        is_late = (
            meeting.actual_started_at is not None
            and (now - meeting.actual_started_at.replace(tzinfo=timezone.utc))
            > timedelta(minutes=LATE_THRESHOLD_MINUTES)
        )

        attendance = await self._att_repo.upsert_session_attendance(
            meeting_id,
            self._user.id,
            {
                "status": AttendanceStatus.LATE if is_late else AttendanceStatus.PRESENT,
                "join_time": now,
                "is_late": is_late,
            },
        )

        await self._att_repo.record_event(
            session_attendance_id=attendance.id,
            event_type=AttendanceEventType.JOIN,
            occurred_at=now,
        )

        # Step 7: Audit log
        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.joined",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.INFO,
            metadata_={
                "is_late": is_late,
                "attendance_id": str(attendance.id),
            },
        ))

        logger.info(
            "User joined meeting",
            extra={
                "user_id": str(self._user.id),
                "meeting_id": str(meeting_id),
                "is_late": is_late,
            },
        )

        # Step 8: Generate provider join payload (this is where the link is revealed)
        provider = _get_provider(meeting.provider)
        display_name = (
            f"{self._user.first_name} {self._user.last_name}".strip()
            if hasattr(self._user, "first_name")
            else self._user.email
        )
        provider_data = provider.generate_join_response(
            meet_link=meeting.meet_link,
            meeting_id=meeting_id,
            user_id=self._user.id,
            display_name=display_name,
            metadata={"course_id": str(meeting.course_id), "is_late": is_late},
        )

        return {
            "meeting_id": str(meeting_id),
            "meeting_title": meeting.title,
            "provider": meeting.provider,
            "provider_data": provider_data,
            "join_recorded_at": now.isoformat(),
            "attendance_id": str(attendance.id),
        }

    async def leave_meeting(
        self, meeting_id: uuid.UUID
    ) -> dict[str, Any]:
        """Record a student's departure from a meeting.

        Updates SessionAttendance with leave_time, computes
        total_duration_seconds and attendance_percentage.

        Args:
            meeting_id: UUID of the meeting being left.

        Returns:
            dict[str, Any]: Updated attendance summary.

        Raises:
            MeetingNotFoundError: Meeting not found.
            AppError: Student hasn't joined this meeting yet.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()

        attendance = await self._att_repo.get_session_attendance(
            meeting_id, self._user.id, load_events=True
        )
        if attendance is None or attendance.join_time is None:
            raise AppError(
                message="You have not joined this meeting.",
                error_code="NotJoined",
            )

        now = datetime.now(timezone.utc)
        join_time = attendance.join_time
        if join_time.tzinfo is None:
            join_time = join_time.replace(tzinfo=timezone.utc)

        total_seconds = int((now - join_time).total_seconds())
        meeting_total_seconds = meeting.duration_minutes * 60
        pct = min(100.0, (total_seconds / meeting_total_seconds) * 100)

        # Determine final status
        if pct >= PRESENT_THRESHOLD_PCT:
            status = AttendanceStatus.LATE if attendance.is_late else AttendanceStatus.PRESENT
        else:
            status = AttendanceStatus.PARTIAL

        await self._att_repo.upsert_session_attendance(
            meeting_id,
            self._user.id,
            {
                "leave_time": now,
                "total_duration_seconds": total_seconds,
                "attendance_percentage": round(pct, 2),
                "status": status,
            },
        )

        await self._att_repo.record_event(
            session_attendance_id=attendance.id,
            event_type=AttendanceEventType.LEAVE,
            occurred_at=now,
        )

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="meeting.left",
            entity_type="meeting",
            entity_id=meeting_id,
            severity=AuditSeverity.INFO,
            metadata_={
                "duration_seconds": total_seconds,
                "attendance_pct": round(pct, 2),
            },
        ))

        return {
            "meeting_id": str(meeting_id),
            "student_id": str(self._user.id),
            "total_duration_seconds": total_seconds,
            "attendance_percentage": round(pct, 2),
            "status": status,
            "leave_time": now.isoformat(),
        }

    async def finalize_attendance(
        self,
        meeting_id: uuid.UUID,
        ended_at: datetime,
        meeting: Meeting,
    ) -> None:
        """Finalize attendance for all participants when a meeting ends.

        Called by MeetingService.end_meeting. For every SessionAttendance
        record that has join_time but no leave_time (participant never
        explicitly left), sets leave_time to ended_at and computes
        the final duration and percentage.

        Args:
            meeting_id: UUID of the ended meeting.
            ended_at: Actual end timestamp.
            meeting: Meeting ORM instance (for duration).
        """
        from sqlalchemy import select, update as sa_update

        result = await self._db.execute(
            select(SessionAttendance).where(
                SessionAttendance.meeting_id == meeting_id,
                SessionAttendance.join_time.isnot(None),
                SessionAttendance.leave_time.is_(None),
            )
        )
        open_records = result.scalars().all()

        meeting_total_seconds = meeting.duration_minutes * 60
        if ended_at.tzinfo is None:
            ended_at = ended_at.replace(tzinfo=timezone.utc)

        for record in open_records:
            join_time = record.join_time
            if join_time.tzinfo is None:
                join_time = join_time.replace(tzinfo=timezone.utc)

            total_seconds = int((ended_at - join_time).total_seconds())
            pct = min(100.0, (total_seconds / meeting_total_seconds) * 100)
            status = (
                AttendanceStatus.LATE
                if record.is_late
                else (AttendanceStatus.PRESENT if pct >= PRESENT_THRESHOLD_PCT else AttendanceStatus.PARTIAL)
            )

            await self._att_repo.upsert_session_attendance(
                meeting_id,
                record.student_id,
                {
                    "leave_time": ended_at,
                    "total_duration_seconds": total_seconds,
                    "attendance_percentage": round(pct, 2),
                    "status": status,
                },
            )

            await self._att_repo.record_event(
                session_attendance_id=record.id,
                event_type=AttendanceEventType.LEAVE,
                occurred_at=ended_at,
            )

    async def list_meeting_attendance(
        self,
        meeting_id: uuid.UUID,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[list[dict[str, Any]], int]:
        """List attendance records for a meeting (teacher view).

        Args:
            meeting_id: UUID of the meeting.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple[list[dict], int]: Attendance records and total count.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        records, total = await self._att_repo.list_for_meeting(
            meeting_id, page=page, page_size=page_size, load_events=True
        )
        return [self._serialize_attendance(r) for r in records], total

    async def get_attendance_summary(
        self, meeting_id: uuid.UUID
    ) -> dict[str, Any]:
        """Return aggregate attendance statistics for a meeting.

        Args:
            meeting_id: UUID of the meeting.

        Returns:
            dict[str, Any]: Attendance summary.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
        """
        meeting = await self._repo.get_by_id(meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        summary = await self._att_repo.compute_summary(meeting_id)
        records, _ = await self._att_repo.list_for_meeting(
            meeting_id, page=1, page_size=1000, load_events=True
        )

        analytics_repo = MeetingAnalyticsRepository(self._db)
        peak = await analytics_repo.peak_attendance(meeting_id)

        total_enrolled = 0
        try:
            from sqlalchemy import select, func
            from app.models.course import CourseEnrollment
            result = await self._db.execute(
                select(func.count())
                .select_from(CourseEnrollment)
                .where(
                    CourseEnrollment.course_id == meeting.course_id,
                    CourseEnrollment.status == "active",
                )
            )
            total_enrolled = result.scalar_one()
        except Exception:
            total_enrolled = summary.get("total_present", 0) + summary.get("total_absent", 0)

        attendance_rate = (
            (summary["total_present"] / total_enrolled * 100) if total_enrolled > 0 else 0.0
        )

        scheduled_at = meeting.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        return {
            "meeting_id": str(meeting_id),
            "meeting_title": meeting.title,
            "scheduled_at": scheduled_at.isoformat(),
            "total_enrolled": total_enrolled,
            "total_present": summary["total_present"],
            "total_absent": summary["total_absent"],
            "total_late": summary["total_late"],
            "attendance_rate": round(attendance_rate, 2),
            "average_duration_seconds": round(summary["avg_duration_seconds"], 2),
            "average_join_delay_seconds": 0.0,
            "peak_concurrent": peak,
            "records": [self._serialize_attendance(r) for r in records],
        }

    async def my_attendance(
        self,
        course_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return the current student's attendance history.

        Args:
            course_id: Optional course filter.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple[list[dict], int]: Attendance records and total count.
        """
        records, total = await self._att_repo.list_for_student(
            self._user.id,
            course_id=course_id,
            page=page,
            page_size=page_size,
        )
        return [self._serialize_attendance(r) for r in records], total

    async def manual_mark(
        self, body: AttendanceMarkRequest
    ) -> dict[str, Any]:
        """Teacher manually overrides a student's attendance status.

        Args:
            body: AttendanceMarkRequest with student, meeting, and status.

        Returns:
            dict[str, Any]: Updated attendance record.

        Raises:
            MeetingNotFoundError: Meeting not found.
            MeetingOwnershipError: Caller doesn't own the meeting.
        """
        meeting = await self._repo.get_by_id(body.meeting_id)
        if meeting is None:
            raise MeetingNotFoundError()
        if meeting.teacher_id != self._user.id:
            raise MeetingOwnershipError()

        record = await self._att_repo.manual_mark(
            body.meeting_id, body.student_id, body.status
        )

        self._db.add(AuditLog(
            user_id=self._user.id,
            action="attendance.manual_override",
            entity_type="session_attendance",
            entity_id=record.id,
            severity=AuditSeverity.WARNING,
            metadata_={
                "student_id": str(body.student_id),
                "status": body.status,
            },
        ))

        return self._serialize_attendance(record)

    @staticmethod
    def _serialize_attendance(record: SessionAttendance) -> dict[str, Any]:
        """Serialize a SessionAttendance ORM instance to a safe dict.

        Args:
            record: SessionAttendance ORM instance.

        Returns:
            dict[str, Any]: Serialized attendance record.
        """
        events = [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in getattr(record, "events", [])
        ]
        return {
            "id": str(record.id),
            "meeting_id": str(record.meeting_id),
            "student_id": str(record.student_id),
            "status": record.status,
            "join_time": record.join_time.isoformat() if record.join_time else None,
            "leave_time": record.leave_time.isoformat() if record.leave_time else None,
            "total_duration_seconds": record.total_duration_seconds,
            "attendance_percentage": float(record.attendance_percentage),
            "is_late": record.is_late,
            "events": events,
        }


# ===========================================================================
# MeetingAnalyticsService
# ===========================================================================


class MeetingAnalyticsService:
    """Analytics aggregation for teacher-facing meeting statistics.

    Args:
        db: Async SQLAlchemy session.
        current_user: The authenticated teacher.
    """

    def __init__(self, db: AsyncSession, current_user: User) -> None:
        """Initialize the service."""
        self._db = db
        self._user = current_user
        self._analytics_repo = MeetingAnalyticsRepository(db)
        self._meeting_repo = MeetingRepository(db)

    async def course_analytics(
        self, course_id: uuid.UUID
    ) -> dict[str, Any]:
        """Return comprehensive attendance analytics for a course.

        Args:
            course_id: UUID of the course.

        Returns:
            dict[str, Any]: MeetingAnalyticsResponse-compatible dict.

        Raises:
            MeetingOwnershipError: Caller doesn't own the course.
        """
        owner_id = await self._meeting_repo.get_course_owner(course_id)
        if owner_id != self._user.id:
            raise MeetingOwnershipError(
                message="You do not own this course."
            )

        stats = await self._analytics_repo.course_attendance_stats(course_id)
        missed = await self._analytics_repo.student_missed_classes(course_id)

        return {
            "course_id": str(course_id),
            "total_meetings": stats["total_meetings"],
            "completed_meetings": stats["completed_meetings"],
            "cancelled_meetings": stats["cancelled_meetings"],
            "average_attendance_rate": round(stats["avg_attendance_rate"], 2),
            "average_meeting_duration_minutes": round(stats["avg_duration_minutes"], 2),
            "top_attended_meeting_id": None,
            "lowest_attended_meeting_id": None,
            "student_missed_class_counts": missed,
            "monthly_breakdown": [],
        }

    async def teacher_stats(self) -> dict[str, Any]:
        """Return aggregate statistics for the current teacher.

        Returns:
            dict[str, Any]: TeacherStatsResponse-compatible dict.
        """
        stats = await self._analytics_repo.teacher_stats(self._user.id)
        return {
            "teacher_id": str(self._user.id),
            "total_meetings_created": stats["total_created"],
            "total_meetings_completed": stats["total_completed"],
            "total_meetings_cancelled": stats["total_cancelled"],
            "total_hours_taught": stats["total_hours_taught"],
            "average_attendance_rate": round(stats["avg_attendance_rate"], 2),
            "most_active_course_id": None,
        }


# ===========================================================================
# MeetingNotificationService
# ===========================================================================


class MeetingNotificationService:
    """Dispatches in-app Notification records for meeting lifecycle events.

    Notifications are INSERT-only — this service only adds records to
    the DB session. Redis Pub/Sub delivery is handled by the notification
    worker that reads these records.

    Args:
        db: Async SQLAlchemy session.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the notification service."""
        self._db = db

    async def notify_meeting_created(self, meeting: Meeting) -> None:
        """Notify enrolled students that a new meeting was scheduled.

        Args:
            meeting: The newly created Meeting ORM instance.
        """
        await self._broadcast(
            course_id=meeting.course_id,
            notification_type=NotificationType.MEETING_SCHEDULED,
            title="New Meeting Scheduled",
            body=(
                f"A new live session '{meeting.title}' has been scheduled. "
                f"Join at {meeting.scheduled_at.strftime('%d %b %Y %H:%M UTC')}."
            ),
            entity_type="meeting",
            entity_id=meeting.id,
            action_url=f"/meetings/{meeting.id}",
        )

    async def notify_meeting_updated(self, meeting: Meeting) -> None:
        """Notify enrolled students that a meeting was updated.

        Args:
            meeting: The updated Meeting ORM instance.
        """
        await self._broadcast(
            course_id=meeting.course_id,
            notification_type=NotificationType.MEETING_SCHEDULED,
            title="Meeting Updated",
            body=(
                f"The meeting '{meeting.title}' has been updated. "
                "Please check the new details."
            ),
            entity_type="meeting",
            entity_id=meeting.id,
            action_url=f"/meetings/{meeting.id}",
        )

    async def notify_meeting_cancelled(self, meeting: Meeting, reason: str) -> None:
        """Notify enrolled students that a meeting was cancelled.

        Args:
            meeting: The cancelled Meeting ORM instance.
            reason: Human-readable cancellation reason.
        """
        await self._broadcast(
            course_id=meeting.course_id,
            notification_type=NotificationType.MEETING_CANCELLED,
            title="Meeting Cancelled",
            body=f"'{meeting.title}' has been cancelled. Reason: {reason}",
            entity_type="meeting",
            entity_id=meeting.id,
            action_url=f"/courses/{meeting.course_id}/meetings",
        )

    async def notify_meeting_live(self, meeting: Meeting) -> None:
        """Notify enrolled students that a meeting is now live.

        Args:
            meeting: The live Meeting ORM instance.
        """
        await self._broadcast(
            course_id=meeting.course_id,
            notification_type=NotificationType.MEETING_STARTED,
            title="Class is Live!",
            body=f"'{meeting.title}' is now live. Join now!",
            entity_type="meeting",
            entity_id=meeting.id,
            action_url=f"/live/{meeting.id}/join",
        )

    async def notify_meeting_ended(self, meeting: Meeting) -> None:
        """Notify enrolled students that a meeting has ended.

        Args:
            meeting: The completed Meeting ORM instance.
        """
        await self._broadcast(
            course_id=meeting.course_id,
            notification_type=NotificationType.MEETING_STARTED,
            title="Class Ended",
            body=f"'{meeting.title}' has ended. Check your attendance record.",
            entity_type="meeting",
            entity_id=meeting.id,
            action_url=f"/courses/{meeting.course_id}/attendance",
        )

    async def _broadcast(
        self,
        course_id: uuid.UUID,
        notification_type: str,
        title: str,
        body: str,
        entity_type: str,
        entity_id: uuid.UUID,
        action_url: str,
    ) -> None:
        """Insert Notification records for all active enrolled students.

        Fetches active enrollments for the course and inserts one
        Notification row per enrolled student in the current DB session.

        Args:
            course_id: Target course for enrollment lookup.
            notification_type: NotificationType enum value string.
            title: Notification title.
            body: Notification body text.
            entity_type: Related entity type for deep linking.
            entity_id: Related entity UUID.
            action_url: Frontend deep link URL.
        """
        from sqlalchemy import select
        from app.models.course import CourseEnrollment

        result = await self._db.execute(
            select(CourseEnrollment.student_id).where(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == "active",
            )
        )
        student_ids = result.scalars().all()

        for student_id in student_ids:
            self._db.add(Notification(
                recipient_id=student_id,
                type=notification_type,
                title=title,
                body=body,
                entity_type=entity_type,
                entity_id=entity_id,
                action_url=action_url,
                channel=NotificationChannel.IN_APP,
            ))


# ===========================================================================
# CalendarService
# ===========================================================================


class CalendarService:
    """Calendar query service for teacher and student meeting views.

    Returns meetings grouped by day for weekly/monthly views.

    Args:
        db: Async SQLAlchemy session.
        current_user: The authenticated user.
    """

    def __init__(self, db: AsyncSession, current_user: User) -> None:
        """Initialize the service."""
        self._db = db
        self._user = current_user
        self._repo = MeetingRepository(db)

    async def today(
        self, course_id: Optional[uuid.UUID] = None
    ) -> list[dict[str, Any]]:
        """Return all meetings scheduled for today (UTC).

        Args:
            course_id: Optional course filter.

        Returns:
            list[dict[str, Any]]: Today's meetings serialized.
        """
        is_teacher = getattr(self._user, "role", None) == "teacher"
        teacher_id = self._user.id if is_teacher else None

        meetings = await self._repo.list_today(
            teacher_id=teacher_id,
            course_id=course_id,
        )
        return [self._serialize_calendar_item(m) for m in meetings]

    async def upcoming(
        self,
        days: int = 7,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[dict[str, Any]]:
        """Return upcoming meetings within the next N days.

        Args:
            days: Look-ahead window in days.
            course_id: Optional course filter.

        Returns:
            list[dict[str, Any]]: Upcoming meetings serialized.
        """
        is_teacher = getattr(self._user, "role", None) == "teacher"
        teacher_id = self._user.id if is_teacher else None

        meetings = await self._repo.list_upcoming(
            days=days,
            teacher_id=teacher_id,
            course_id=course_id,
        )
        return [self._serialize_calendar_item(m) for m in meetings]

    async def weekly(
        self,
        start_date: datetime,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[dict[str, Any]]:
        """Return meetings for the 7-day week starting at start_date.

        Returns meetings grouped by day (list of CalendarDayResponse dicts).

        Args:
            start_date: First day of the week (UTC midnight).
            course_id: Optional course filter.

        Returns:
            list[dict[str, Any]]: 7 CalendarDayResponse items.
        """
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        end_date = start_date + timedelta(days=7)

        is_teacher = getattr(self._user, "role", None) == "teacher"
        teacher_id = self._user.id if is_teacher else None

        meetings = await self._repo.list_by_date_range(
            start=start_date,
            end=end_date,
            teacher_id=teacher_id,
            course_id=course_id,
        )

        return self._group_by_day(meetings, start_date, 7)

    async def monthly(
        self,
        year: int,
        month: int,
        course_id: Optional[uuid.UUID] = None,
    ) -> list[dict[str, Any]]:
        """Return meetings for an entire calendar month.

        Args:
            year: Calendar year (e.g. 2026).
            month: Calendar month (1–12).
            course_id: Optional course filter.

        Returns:
            list[dict[str, Any]]: CalendarDayResponse items for the month.
        """
        import calendar
        _, days_in_month = calendar.monthrange(year, month)
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        end_date = start_date + timedelta(days=days_in_month)

        is_teacher = getattr(self._user, "role", None) == "teacher"
        teacher_id = self._user.id if is_teacher else None

        meetings = await self._repo.list_by_date_range(
            start=start_date,
            end=end_date,
            teacher_id=teacher_id,
            course_id=course_id,
        )

        return self._group_by_day(meetings, start_date, days_in_month)

    async def past(
        self,
        course_id: Optional[uuid.UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return past meetings (completed/expired).

        Args:
            course_id: Optional course filter.
            page: Page number.
            page_size: Items per page.

        Returns:
            tuple[list[dict], int]: Past meetings and total count.
        """
        is_teacher = getattr(self._user, "role", None) == "teacher"
        teacher_id = self._user.id if is_teacher else None

        meetings, total = await self._repo.list_past(
            teacher_id=teacher_id,
            course_id=course_id,
            page=page,
            page_size=page_size,
        )
        return [self._serialize_calendar_item(m) for m in meetings], total

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    @staticmethod
    def _serialize_calendar_item(meeting: Meeting) -> dict[str, Any]:
        """Serialize a meeting to a compact calendar item dict.

        Args:
            meeting: Meeting ORM instance.

        Returns:
            dict[str, Any]: CalendarMeetingItem-compatible dict.
        """
        scheduled_at = meeting.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        return {
            "id": str(meeting.id),
            "course_id": str(meeting.course_id),
            "title": meeting.title,
            "scheduled_at": scheduled_at.isoformat(),
            "duration_minutes": meeting.duration_minutes,
            "status": meeting.status,
            "is_live": meeting.status == MeetingStatus.LIVE,
            "provider": meeting.provider,
        }

    @staticmethod
    def _group_by_day(
        meetings: list[Meeting],
        start: datetime,
        num_days: int,
    ) -> list[dict[str, Any]]:
        """Group meetings by calendar day.

        Args:
            meetings: Ordered list of meetings.
            start: First day of the range (UTC midnight).
            num_days: Number of days to cover.

        Returns:
            list[dict[str, Any]]: One CalendarDayResponse per day.
        """
        from collections import defaultdict

        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for meeting in meetings:
            scheduled_at = meeting.scheduled_at
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            day_str = scheduled_at.strftime("%Y-%m-%d")
            grouped[day_str].append(
                CalendarService._serialize_calendar_item(meeting)
            )

        result = []
        for i in range(num_days):
            day = start + timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            result.append({"date": day_str, "meetings": grouped.get(day_str, [])})
        return result
