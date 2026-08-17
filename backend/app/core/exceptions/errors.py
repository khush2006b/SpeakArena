"""Domain exception hierarchy for the SpeakArena application.

All application errors inherit from ``AppError``. Each subclass carries:

    status_code : HTTP status code to return to the client.
    error_code  : Machine-readable PascalCase code (e.g. ``InvalidCredentials``).
    message     : Human-readable message safe to show to end users.

Design principles:
    - Services raise domain exceptions; the global exception handler
      converts them to HTTP responses. Services never import ``HTTPException``.
    - Error codes are stable strings — frontend code can ``switch`` on them.
    - Messages are safe for display — no stack traces, no internal details.
    - The ``detail`` field carries structured context for logging only
      (never sent to the client).
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for all SpeakArena application errors.

    Attributes:
        status_code: HTTP status code for the response.
        error_code: Machine-readable PascalCase error identifier.
        message: Human-readable, client-safe error description.
        detail: Optional structured context for server-side logging only.
            Never sent to the client.
    """

    status_code: int = 500
    error_code: str = "InternalError"
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        *,
        error_code: str | None = None,
        detail: Any = None,
    ) -> None:
        """Initialize the application error.

        Args:
            message: Override the default human-readable message.
            error_code: Override the default machine-readable error code.
            detail: Optional structured context for logging. Never exposed
                to clients.
        """
        if message is not None:
            self.message = message
        if error_code is not None:
            self.error_code = error_code
        self.detail = detail
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# 400 Bad Request
# ---------------------------------------------------------------------------


class ValidationError(AppError):
    """Request payload failed validation beyond Pydantic's built-in checks.

    Use when business-level validation fails (e.g. new password equals
    current password) rather than schema-level validation.
    """

    status_code = 400
    error_code = "ValidationError"
    message = "The request contains invalid data."


# ---------------------------------------------------------------------------
# 401 Unauthorized
# ---------------------------------------------------------------------------


class AuthenticationError(AppError):
    """The request lacks valid authentication credentials.

    Raised when:
        - Credentials are missing or malformed.
        - JWT is expired, revoked, or has an invalid signature.
        - Refresh token is invalid or has been rotated away.
        - Account is locked due to brute-force protection.
    """

    status_code = 401
    error_code = "AuthenticationError"
    message = "Authentication is required to access this resource."


class InvalidCredentialsError(AuthenticationError):
    """Email/password combination is incorrect.

    Message is intentionally generic to prevent email enumeration.
    """

    error_code = "InvalidCredentials"
    message = "Invalid email or password."


class AccountLockedError(AuthenticationError):
    """Account is temporarily locked due to repeated failed login attempts.

    Attributes:
        retry_after: Seconds until the lockout expires.
    """

    error_code = "AccountLocked"
    message = "Account is temporarily locked due to too many failed attempts."

    def __init__(self, retry_after: int, **kwargs: Any) -> None:
        """Initialize with the lockout duration.

        Args:
            retry_after: Seconds until the lockout expires.
            **kwargs: Passed to AppError.__init__.
        """
        self.retry_after = retry_after
        super().__init__(**kwargs)


class AccountSuspendedError(AuthenticationError):
    """Account has been permanently suspended by an administrator."""

    error_code = "AccountSuspended"
    message = "This account has been suspended. Please contact support."


class EmailNotVerifiedError(AuthenticationError):
    """Login attempted before email verification was completed."""

    error_code = "EmailNotVerified"
    message = "Please verify your email address before logging in."


class TokenExpiredError(AuthenticationError):
    """JWT access token has exceeded its expiry time."""

    error_code = "TokenExpired"
    message = "Your session has expired. Please log in again."


class TokenRevokedError(AuthenticationError):
    """JWT access token has been explicitly revoked (e.g. on logout)."""

    error_code = "TokenRevoked"
    message = "Your session has been revoked. Please log in again."


class InvalidRefreshTokenError(AuthenticationError):
    """Refresh token is missing, invalid, expired, or already rotated."""

    error_code = "InvalidRefreshToken"
    message = "Invalid or expired refresh token. Please log in again."


class RefreshTokenReuseError(AuthenticationError):
    """A previously rotated refresh token was presented again.

    This indicates potential token theft. All sessions for the affected
    user are revoked immediately upon detection.
    """

    error_code = "RefreshTokenReuse"
    message = "A security violation was detected. All sessions have been revoked."


class InvalidResetTokenError(AuthenticationError):
    """Password reset token is missing, invalid, expired, or already used."""

    error_code = "InvalidResetToken"
    message = "Password reset token is invalid or has expired."


class InvalidVerificationTokenError(AuthenticationError):
    """Email verification token is invalid, expired, or already used."""

    error_code = "InvalidVerificationToken"
    message = "Verification token is invalid or has expired."


# ---------------------------------------------------------------------------
# 403 Forbidden
# ---------------------------------------------------------------------------


class AuthorizationError(AppError):
    """The authenticated user lacks permission for the requested resource."""

    status_code = 403
    error_code = "Forbidden"
    message = "You do not have permission to perform this action."


class TeacherOnlyError(AuthorizationError):
    """Resource requires teacher (admin) role."""

    error_code = "TeacherOnly"
    message = "This action requires teacher permissions."


class OriginMismatchError(AuthorizationError):
    """Request Origin header does not match the allowed origins list."""

    error_code = "OriginMismatch"
    message = "Request origin is not permitted."


class PermissionDeniedError(AuthorizationError):
    """Caller lacks the required permission for the requested operation.

    A semantic alias for AuthorizationError providing a more descriptive
    error_code for resource-level permission failures (e.g. teacher trying
    to modify another teacher's course, payment refund for another user).
    """

    error_code = "PermissionDenied"
    message = "You do not have permission to perform this operation."


# ---------------------------------------------------------------------------
# 404 Not Found
# ---------------------------------------------------------------------------


class NotFoundError(AppError):
    """The requested resource does not exist."""

    status_code = 404
    error_code = "NotFound"
    message = "The requested resource was not found."


class ResourceNotFoundError(NotFoundError):
    """A generic domain resource (course, payment, enrollment, etc.) was not found.

    Use this when no more specific NotFoundError subclass applies.
    """

    error_code = "ResourceNotFound"
    message = "The requested resource was not found."


# ---------------------------------------------------------------------------
# 409 Conflict
# ---------------------------------------------------------------------------


class ConflictError(AppError):
    """The request conflicts with existing server state.

    Raised on duplicate resource creation (e.g. email already registered).
    """

    status_code = 409
    error_code = "Conflict"
    message = "A conflict occurred with existing data."


class EmailAlreadyExistsError(ConflictError):
    """Registration attempted with an email already in use."""

    error_code = "EmailAlreadyExists"
    message = "An account with this email address already exists."


# ---------------------------------------------------------------------------
# 422 Unprocessable Entity
# ---------------------------------------------------------------------------


class UnprocessableEntityError(AppError):
    """Semantic error in a syntactically valid request.

    Used for business-rule violations that Pydantic cannot express
    (e.g. new password equals current password).
    """

    status_code = 422
    error_code = "UnprocessableEntity"
    message = "The request data is semantically invalid."


# ---------------------------------------------------------------------------
# 429 Too Many Requests
# ---------------------------------------------------------------------------


class RateLimitError(AppError):
    """Client has exceeded the allowed request rate.

    Attributes:
        retry_after: Seconds until the client may retry.
    """

    status_code = 429
    error_code = "RateLimitExceeded"
    message = "Too many requests. Please slow down and try again later."

    def __init__(self, retry_after: int = 60, **kwargs: Any) -> None:
        """Initialize with the retry-after duration.

        Args:
            retry_after: Seconds until the rate limit window resets.
            **kwargs: Passed to AppError.__init__.
        """
        self.retry_after = retry_after
        super().__init__(**kwargs)


# ---------------------------------------------------------------------------
# 503 Service Unavailable
# ---------------------------------------------------------------------------


class ServiceUnavailableError(AppError):
    """A required downstream service (DB, Redis) is not reachable."""

    status_code = 503
    error_code = "ServiceUnavailable"
    message = "The service is temporarily unavailable. Please try again shortly."


# ---------------------------------------------------------------------------
# Teacher Module domain errors
# ---------------------------------------------------------------------------


class CourseNotFoundError(NotFoundError):
    """Course does not exist or is not owned by the requesting teacher."""

    error_code = "CourseNotFound"
    message = "Course not found."


class CourseAlreadyPublishedError(ConflictError):
    """Publish was called on a course that is already published."""

    error_code = "CourseAlreadyPublished"
    message = "This course is already published."


class CourseNotReadyError(UnprocessableEntityError):
    """Publish attempted without required fields (title, price, at least one video)."""

    error_code = "CourseNotReady"
    message = "Course is missing required content before it can be published."


class MeetingNotFoundError(NotFoundError):
    """Meeting does not exist or does not belong to the teacher's course."""

    error_code = "MeetingNotFound"
    message = "Meeting not found."


class MeetingInPastError(UnprocessableEntityError):
    """Meeting scheduled_at is in the past."""

    error_code = "MeetingInPast"
    message = "Meeting cannot be scheduled in the past."


class MeetingNotCancellableError(UnprocessableEntityError):
    """Attempt to cancel a completed or already-cancelled meeting."""

    error_code = "MeetingNotCancellable"
    message = "Only scheduled or live meetings can be cancelled."


class ResourceNotFoundError(NotFoundError):
    """Video or PDF resource not found."""

    error_code = "ResourceNotFound"
    message = "Resource not found."


class InvalidUploadTypeError(UnprocessableEntityError):
    """Uploaded MIME type is not on the allowlist."""

    error_code = "InvalidUploadType"
    message = "This file type is not supported."


class StudentNotFoundError(NotFoundError):
    """Student does not exist or is not enrolled in any of the teacher's courses."""

    error_code = "StudentNotFound"
    message = "Student not found."


class SlugConflictError(ConflictError):
    """Generated course slug already exists in the database."""

    error_code = "SlugConflict"
    message = "A course with this title already exists. Please use a different title."


class R2OperationError(AppError):
    """Cloudflare R2 presign or delete operation failed."""

    status_code = 502
    error_code = "R2OperationError"
    message = "Storage operation failed. Please try again."


class AnnouncementNotFoundError(NotFoundError):
    """Announcement message not found or not in the expected course room."""

    error_code = "AnnouncementNotFound"
    message = "Announcement not found."


class CategoryNotFoundError(NotFoundError):
    """Category ID does not exist."""

    error_code = "CategoryNotFound"
    message = "Category not found."


class EnrollmentNotFoundError(NotFoundError):
    """Enrollment record not found for this student+course pair."""

    error_code = "EnrollmentNotFound"
    message = "Enrollment not found."


# ---------------------------------------------------------------------------
# Meeting Errors
# ---------------------------------------------------------------------------


class MeetingNotFoundError(AppError):
    """Requested meeting does not exist or has been soft-deleted."""

    status_code = 404
    error_code = "MeetingNotFound"
    message = "Meeting not found."


class MeetingNotStartedError(AppError):
    """Student attempted to join before the early-join window opens."""

    status_code = 403
    error_code = "MeetingNotStarted"
    message = "This meeting has not started yet."


class MeetingAlreadyLiveError(AppError):
    """Teacher attempted to mark a meeting live that is already live."""

    status_code = 409
    error_code = "MeetingAlreadyLive"
    message = "This meeting is already live."


class MeetingExpiredError(AppError):
    """Meeting window has passed; students may no longer join."""

    status_code = 410
    error_code = "MeetingExpired"
    message = "This meeting has expired and is no longer accessible."


class MeetingCancelledError(AppError):
    """Meeting was cancelled by the teacher."""

    status_code = 410
    error_code = "MeetingCancelled"
    message = "This meeting has been cancelled."


class MeetingLockedError(AppError):
    """Meeting is locked; no new participants may join."""

    status_code = 423
    error_code = "MeetingLocked"
    message = "This meeting is currently locked."


class MeetingAtCapacityError(AppError):
    """Meeting has reached its maximum participant limit."""

    status_code = 429
    error_code = "MeetingAtCapacity"
    message = "This meeting has reached its maximum participant limit."


class InvalidMeetingLinkError(AppError):
    """Provided Google Meet link failed format validation."""

    status_code = 422
    error_code = "InvalidMeetingLink"
    message = "The provided meeting link is not a valid Google Meet URL."


class DuplicateMeetingLinkError(AppError):
    """The same Google Meet link already exists in another active meeting."""

    status_code = 409
    error_code = "DuplicateMeetingLink"
    message = "This meeting link is already used in another active meeting."


class EarlyJoinNotAllowedError(AppError):
    """Student attempted to join before the early-join window."""

    status_code = 403
    error_code = "EarlyJoinNotAllowed"
    message = "You may not join this meeting yet. Please wait until closer to the start time."


class LateJoinNotPermittedError(AppError):
    """Meeting has passed its late-join window."""

    status_code = 403
    error_code = "LateJoinNotPermitted"
    message = "The late-join window for this meeting has closed."


class MeetingOwnershipError(AppError):
    """Teacher tried to modify a meeting they do not own."""

    status_code = 403
    error_code = "MeetingOwnership"
    message = "You do not have permission to modify this meeting."


class NotEnrolledInCourseError(AppError):
    """Student is not enrolled in the course this meeting belongs to."""

    status_code = 403
    error_code = "NotEnrolled"
    message = "You are not enrolled in the course this meeting belongs to."


class DuplicateResourceError(AppError):
    """A resource with the same unique identifier already exists.

    Used when trying to create a record that conflicts with an existing
    active record (e.g. duplicate payment order, duplicate enrollment).
    """

    status_code = 409
    error_code = "DuplicateResource"
    message = "A resource with this identifier already exists."
