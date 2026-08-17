"""FastAPI dependency factories for authentication and authorization.

These dependencies are injected via ``Depends()`` in router endpoint
signatures. They enforce authentication, role-based access control,
and provide common request context values.

Dependency hierarchy::

    get_current_user              (any authenticated, active user)
        ├── get_current_teacher   (teacher role only)
        └── get_current_student   (student role only)
            └── get_verified_student (student + email verified)

Side effect:
    ``get_current_user`` stores the decoded JWT payload in
    ``request.state.at_payload`` so that logout, logout-all,
    change-password, and session-listing endpoints can access it
    without re-decoding the token.

Usage example::

    @router.get("/protected")
    async def protected(
        user: User = Depends(get_current_user),
    ) -> JSONResponse:
        ...
"""

from __future__ import annotations

import logging
import uuid

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import (
    AccountSuspendedError,
    AuthenticationError,
    TokenRevokedError,
)
from app.core.redis import RedisKeys
from app.core.redis import operations as RedisOps
from app.core.redis.client import get_redis
from app.core.security.jwt import decode_access_token
from app.core.utils.constants import COOKIE_REFRESH_TOKEN
from app.core.utils.timezone import utcfromiso, utcfromtimestamp
from app.core.utils.uuid_helpers import is_valid_uuid
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.service import PermissionService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTTP Bearer scheme
# ---------------------------------------------------------------------------

# auto_error=False so we can raise our own domain exceptions
# (AuthenticationError) instead of FastAPI's default HTTP 403.
_bearer_scheme = HTTPBearer(auto_error=False)


# ===========================================================================
# Core authentication dependency
# ===========================================================================


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> User:
    """Dependency: authenticate and return the current user.

    Validates the Bearer JWT access token through four layers:
        1. Schema validation (Bearer scheme present).
        2. Cryptographic verification + claim checks (JWT library).
        3. Per-JTI Redis blacklist (handles single-session logout).
        4. Per-user bulk revocation timestamp (handles logout-all,
           password reset, and account lockout scenarios).
    Then loads and validates the user record from the database.

    Side effect:
        Stores the decoded ``AccessTokenPayload`` in ``request.state.at_payload``
        so downstream endpoints (logout, change-password, sessions) can
        access it without a second decode.

    Args:
        request: Incoming FastAPI request object.
        credentials: HTTP Bearer credentials extracted from the
            Authorization header. None if the header is absent.
        db: Async SQLAlchemy session for the current request.
        redis: Async Redis client.

    Returns:
        User: The authenticated, active User ORM object.

    Raises:
        AuthenticationError: If credentials are missing or the user is not found.
        TokenExpiredError: If the JWT exp claim is in the past.
        TokenRevokedError: If the JTI is blacklisted or the bulk-revocation
            timestamp indicates the token predates a logout-all event.
        AccountSuspendedError: If the user account is deactivated.
    """
    if credentials is None:
        raise AuthenticationError(
            message="Authentication required. Provide a valid Bearer token.",
        )

    token = credentials.credentials

    # 1. Cryptographic verification: signature, expiry, issuer, audience.
    payload = decode_access_token(token)

    # 2. Per-JTI blacklist check (set on single-session logout).
    is_blacklisted = await RedisOps.key_exists(
        redis, RedisKeys.at_blacklist(payload.jti)
    )
    if is_blacklisted:
        raise TokenRevokedError()

    # 3. Bulk revocation timestamp (set on logout-all and password reset).
    #    Any token issued BEFORE the revocation timestamp is considered invalid.
    revoked_before_str = await RedisOps.get_str(
        redis, RedisKeys.user_revoked_before(payload.sub)
    )
    if revoked_before_str:
        revoked_before = utcfromiso(revoked_before_str)
        token_iat = utcfromtimestamp(float(payload.iat))
        if token_iat <= revoked_before:
            raise TokenRevokedError()

    # 4. Load user from the database.
    if not is_valid_uuid(payload.sub):
        raise TokenRevokedError(message="Token subject is not a valid UUID.")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(uuid.UUID(payload.sub))

    if user is None:
        raise AuthenticationError(
            message="User account associated with this token no longer exists."
        )

    if not user.is_active:
        raise AccountSuspendedError()

    # Store payload and user identity in request state for downstream use.
    request.state.at_payload = payload
    request.state.user_id = str(user.id)
    request.state.role = str(user.role)

    return user


# ===========================================================================
# Role-based access control dependencies
# ===========================================================================


async def get_current_teacher(
    user: User = Depends(get_current_user),
) -> User:
    """Dependency: authenticate and enforce the teacher role.

    Wraps ``get_current_user`` and adds a role guard. Use this on
    endpoints restricted to the platform administrator (teacher).

    Args:
        user: Authenticated user from ``get_current_user``.

    Returns:
        User: The authenticated teacher user.

    Raises:
        TeacherOnlyError: If the user does not hold the teacher role.
    """
    PermissionService.require_teacher(user)
    return user


async def get_current_student(
    user: User = Depends(get_current_user),
) -> User:
    """Dependency: authenticate and enforce the student role.

    Args:
        user: Authenticated user from ``get_current_user``.

    Returns:
        User: The authenticated student user.

    Raises:
        AuthorizationError: If the user does not hold the student role.
    """
    PermissionService.require_student(user)
    return user


async def get_verified_user(
    user: User = Depends(get_current_user),
) -> User:
    """Dependency: authenticate and require email verification.

    Use on endpoints that must not be accessed by unverified accounts
    (e.g. course purchase, content access).

    Args:
        user: Authenticated user from ``get_current_user``.

    Returns:
        User: The authenticated, email-verified user.

    Raises:
        EmailNotVerifiedError: If the user's email is not yet verified.
    """
    PermissionService.require_email_verified(user)
    return user


async def get_verified_student(
    user: User = Depends(get_current_student),
) -> User:
    """Dependency: authenticate, enforce student role, and require verification.

    Used for content-access endpoints where both student role and email
    verification are prerequisites.

    Args:
        user: Authenticated student from ``get_current_student``.

    Returns:
        User: The authenticated, verified student user.

    Raises:
        AuthorizationError: If not a student.
        EmailNotVerifiedError: If email is unverified.
    """
    PermissionService.require_email_verified(user)
    return user


# ===========================================================================
# Request context extraction dependencies
# ===========================================================================


def get_refresh_token_from_cookie(request: Request) -> str:
    """Dependency: extract the raw refresh token from the HttpOnly cookie.

    The browser sends the refresh token cookie ONLY on requests to the
    ``/api/v1/auth/refresh`` path (cookie path restriction). All other
    requests do not receive this cookie.

    Args:
        request: The incoming request.

    Returns:
        str: The raw refresh token string from the cookie.

    Raises:
        AuthenticationError: If the cookie is absent (user not logged in
            or cookie was cleared).
    """
    raw_rt = request.cookies.get(COOKIE_REFRESH_TOKEN)
    if not raw_rt:
        raise AuthenticationError(
            message="Refresh token is missing. Please log in again.",
        )
    return raw_rt


def get_client_ip(request: Request) -> str:
    """Dependency: extract the real client IP address.

    Reads ``X-Forwarded-For`` when the application is behind a reverse
    proxy (Nginx in production). Falls back to the direct TCP connection
    address in development.

    Takes the FIRST IP in the ``X-Forwarded-For`` list, which is the
    original client IP when Nginx is configured with
    ``proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for``.

    Args:
        request: The incoming request.

    Returns:
        str: The real client IP address string.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_user_agent(request: Request) -> str | None:
    """Dependency: extract the User-Agent header value.

    Used by the login service for device-type detection and session
    tracking. Returns None if the header is absent.

    Args:
        request: The incoming request.

    Returns:
        str | None: The raw User-Agent header string, or None.
    """
    return request.headers.get("User-Agent")


# ===========================================================================
# WebSocket authentication helper
# ===========================================================================


async def decode_ws_token(
    token: str,
    db: AsyncSession,
) -> "User | None":
    """Authenticate a WebSocket connection using a raw JWT token string.

    WebSocket connections cannot use HTTP Authorization headers, so the
    access token is passed as a query parameter. This function replicates
    the same validation pipeline as ``get_current_user`` but accepts a
    raw token string and returns None on failure instead of raising.

    Validation pipeline:
        1. Cryptographic verification (signature, expiry, issuer, audience).
        2. User loaded from database.
        3. Account active check.

    Note:
        The per-JTI Redis blacklist check is intentionally skipped here to
        avoid the additional Redis dependency on the WebSocket connect path.
        Implement if the project requires immediate WebSocket token revocation.

    Args:
        token: Raw JWT access token string (from WS query parameter).
        db: Async SQLAlchemy session.

    Returns:
        User | None: The authenticated user, or None if the token is invalid.
    """
    try:
        payload = decode_access_token(token)
        if not is_valid_uuid(payload.sub):
            return None
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(uuid.UUID(payload.sub))
        if user is None or not user.is_active:
            return None
        return user
    except Exception as exc:
        logger.warning("WebSocket token validation failed: %s", exc)
        return None
