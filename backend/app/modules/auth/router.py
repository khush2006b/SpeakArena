"""FastAPI router for the authentication module.

Registers all authentication-related endpoints under the ``/auth`` prefix.
This router is mounted at ``/api/v1`` in ``main.py``, so the full paths
are ``/api/v1/auth/*``.

All business logic is delegated to service classes. The router is
responsible only for:
    - HTTP method and path binding.
    - Request validation (via Pydantic schemas).
    - Dependency injection (session, Redis, current user).
    - Response serialization.
    - Cookie lifecycle (set / clear).
    - Scheduling email background tasks.

Endpoint summary:
    POST   /auth/register                  Student registration.
    POST   /auth/login                     Login; issues AT + sets RT cookie.
    POST   /auth/logout                    Logout current session.
    POST   /auth/logout-all                Logout all sessions on all devices.
    POST   /auth/refresh                   Rotate RT; issue new AT.
    POST   /auth/forgot-password           Initiate password reset.
    POST   /auth/reset-password            Apply password reset.
    POST   /auth/verify-email              Verify email with one-use token.
    POST   /auth/resend-verification       Resend verification email.
    GET    /auth/me                        Current user profile.
    PATCH  /auth/me                        Update profile fields.
    POST   /auth/me/change-password        Change password while authenticated.
    GET    /auth/sessions                  List all active sessions.
    DELETE /auth/sessions/{session_id}     Revoke a specific session.
    POST   /auth/check-password-strength   Password strength check (public).
    GET    /auth/teacher/profile           Teacher-only profile endpoint.
    GET    /auth/student/profile           Student-only profile endpoint.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions.errors import NotFoundError, RateLimitError, ValidationError
from app.core.notifications.email import (
    send_password_reset_email,
    send_verification_email,
)
from app.core.redis.client import get_redis
from app.core.security.password_policy import PasswordPolicy
from app.core.utils.constants import (
    COOKIE_REFRESH_TOKEN,
    COOKIE_REFRESH_TOKEN_PATH,
    REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,
    REFRESH_TOKEN_STANDARD_TTL_SECONDS,
)
from app.core.utils.response import created_response, success_response
from app.core.utils.timezone import seconds_until
from app.core.utils.uuid_helpers import is_valid_uuid
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import (
    get_client_ip,
    get_current_student,
    get_current_teacher,
    get_current_user,
    get_refresh_token_from_cookie,
    get_user_agent,
)
from app.modules.auth.repository import (
    EmailVerificationRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    StudentProfileRepository,
    TeacherProfileRepository,
    UserRepository,
    UserSessionRepository,
)
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    PasswordStrengthCheckRequest,
    PasswordStrengthResponse,
    RefreshResponse,
    RegisterStudentRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SessionListResponse,
    SessionSchema,
    StudentProfileSchema,
    TeacherProfileSchema,
    UpdateProfileRequest,
    UserSchema,
    VerifyEmailRequest,
)
from app.modules.auth.service import (
    EmailVerificationService,
    LoginService,
    LogoutService,
    PasswordService,
    RefreshTokenService,
    RegistrationService,
    SessionService,
)
from app.core.security.rate_limit import RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ===========================================================================
# Cookie lifecycle helpers
# ===========================================================================


def _set_rt_cookie(
    response: JSONResponse,
    raw_refresh_token: str,
    *,
    max_age: int,
) -> None:
    """Set the HttpOnly refresh token cookie on a JSONResponse.

    The cookie is restricted to the ``/api/v1/auth/refresh`` path so the
    browser NEVER sends it to any other endpoint, minimising the blast
    radius of an XSS attack.

    Args:
        response: The ``JSONResponse`` to attach the cookie to.
        raw_refresh_token: The raw (un-hashed) refresh token string.
        max_age: Cookie ``Max-Age`` in seconds.
    """
    response.set_cookie(
        key=COOKIE_REFRESH_TOKEN,
        value=raw_refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path=COOKIE_REFRESH_TOKEN_PATH,
        max_age=max_age,
    )


def _clear_rt_cookie(response: JSONResponse) -> None:
    """Delete the refresh token cookie from the client browser."""
    response.delete_cookie(
        key=COOKIE_REFRESH_TOKEN,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path=COOKIE_REFRESH_TOKEN_PATH,
    )


def _get_frontend_base() -> str:
    """Return the first configured CORS origin as the frontend base URL.

    Used to build email verification and password reset links that
    point to the frontend application.

    Returns:
        str: Base URL string. Defaults to ``http://localhost:3000`` if
            CORS_ALLOWED_ORIGINS is not configured.
    """
    origins = settings.CORS_ALLOWED_ORIGINS
    return origins[0] if origins else "http://localhost:3000"


# ===========================================================================
# POST /auth/register
# ===========================================================================


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
    description=(
        "Creates a new student account and sends an email verification link. "
        "The account cannot be used until the email address is verified.\n\n"
        "Teacher accounts are not creatable via this endpoint."
    ),
    responses={
        201: {"description": "Account created. Verification email dispatched."},
        400: {"description": "Password does not meet complexity requirements."},
        409: {"description": "Email address is already registered."},
        422: {"description": "Request body validation error."},
        429: {"description": "Too many registration attempts. Try again later."},
    },
)
async def register(
    body: RegisterStudentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    """Register a new student account.

    Flow:
        1. IP rate limit check via Redis.
        2. Password complexity validation.
        3. Email uniqueness check (case-insensitive).
        4. Create User record with Argon2id hash.
        5. Create StudentProfile record.
        6. Generate email verification token (stored as SHA-256 hash).
        7. Commit database transaction.
        8. Schedule verification email as background task.

    Args:
        body: Validated registration request body.
        background_tasks: FastAPI background task scheduler.
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        client_ip: Client IP address for rate limiting.

    Returns:
        JSONResponse: 201 Created with user schema and confirmation message.
    """
    user_repo = UserRepository(db)
    service = RegistrationService(
        user_repo=user_repo,
        student_repo=StudentProfileRepository(db),
        verify_repo=EmailVerificationRepository(db),
    )
    result = await service.register_student(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        phone=body.phone,
        client_ip=client_ip,
        redis=redis,
    )

    # DEV MODE: Skip email verification — mark email as verified immediately
    # so users can log in without checking their inbox.
    await user_repo.set_email_verified(result.user.id)

    await db.commit()

    return created_response(
        data={"user": UserSchema.from_orm(result.user).model_dump(mode="json")},
        message="Account created successfully. You can now log in.",
    )


# ===========================================================================
# POST /auth/login
# ===========================================================================


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    summary="Login user and issue tokens",
    description=(
        "Authenticates a user with email and password. Returns a short-lived "
        "JWT access token in the response body and sets a long-lived HttpOnly "
        "refresh token cookie.\n\n"
        "Students must verify their email before the first login. "
        "Rate limited to 5 attempts per minute per IP and per email address."
    ),
    responses={
        200: {"description": "Login successful. AT in body, RT in HttpOnly cookie."},
        401: {
            "description": (
                "Invalid credentials, account locked, account suspended, "
                "or email not yet verified."
            )
        },
        429: {"description": "Too many login attempts. Try again later."},
    },
)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    client_ip: str = Depends(get_client_ip),
    user_agent: str | None = Depends(get_user_agent),
) -> JSONResponse:
    """Authenticate and issue an access token + refresh token pair.

    The access token is returned in the response body (Authorization Bearer).
    The refresh token is set as an HttpOnly Strict SameSite cookie restricted
    to the ``/api/v1/auth/refresh`` path.

    Args:
        body: Validated login request.
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        client_ip: Client IP for rate limiting and session tracking.
        user_agent: User-Agent header for device type detection.

    Returns:
        JSONResponse: 200 OK with access token and user data.
    """
    service = LoginService(
        user_repo=UserRepository(db),
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    result = await service.login(
        email=body.email,
        password=body.password,
        remember_me=body.remember_me,
        client_ip=client_ip,
        user_agent=user_agent,
        redis=redis,
    )
    await db.commit()

    rt_max_age = (
        REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS
        if body.remember_me
        else REFRESH_TOKEN_STANDARD_TTL_SECONDS
    )
    resp = success_response(
        data=LoginResponse(
            access_token=result.access_token,
            token_type="bearer",
            user=UserSchema.from_orm(result.user),
        ).model_dump(mode="json"),
    )
    _set_rt_cookie(resp, result.raw_refresh_token, max_age=rt_max_age)
    return resp


# ===========================================================================
# POST /auth/logout
# ===========================================================================


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout current session",
    description=(
        "Revokes the current session. Blacklists the access token JTI in Redis "
        "for its remaining TTL and revokes the refresh token in the database. "
        "Clears the refresh token cookie."
    ),
    responses={
        200: {"description": "Logged out successfully."},
        401: {"description": "Not authenticated."},
    },
)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Revoke the current session.

    Reads the access token payload from ``request.state.at_payload``
    (set by ``get_current_user``) to obtain the JTI for blacklisting.
    Reads the refresh token from the HttpOnly cookie if present.

    Args:
        request: Incoming request (provides AT payload via state).
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        user: Authenticated user (ensures AT is valid before logout).

    Returns:
        JSONResponse: 200 OK with logout confirmation. RT cookie cleared.
    """
    at_payload = request.state.at_payload
    raw_rt = request.cookies.get(COOKIE_REFRESH_TOKEN)

    service = LogoutService(
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    await service.logout(
        at_payload=at_payload,
        raw_refresh_token=raw_rt,
        redis=redis,
    )
    await db.commit()

    resp = success_response(message="You have been logged out successfully.")
    _clear_rt_cookie(resp)
    return resp


# ===========================================================================
# POST /auth/logout-all
# ===========================================================================


@router.post(
    "/logout-all",
    status_code=status.HTTP_200_OK,
    summary="Logout all sessions across all devices",
    description=(
        "Revokes ALL active sessions for the current user on every device. "
        "Sets a bulk-revocation timestamp in Redis so that all outstanding "
        "access tokens are treated as revoked without per-JTI blacklisting."
    ),
    responses={
        200: {"description": "All sessions revoked."},
        401: {"description": "Not authenticated."},
    },
)
async def logout_all(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Revoke all sessions for the authenticated user across all devices.

    Args:
        request: Incoming request (provides AT payload via state).
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        user: Authenticated user.

    Returns:
        JSONResponse: 200 OK with count of revoked sessions. RT cookie cleared.
    """
    at_payload = request.state.at_payload

    service = LogoutService(
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    sessions_revoked = await service.logout_all(
        user_id=user.id,
        at_payload=at_payload,
        redis=redis,
    )
    await db.commit()

    resp = success_response(
        message=(
            f"All {sessions_revoked} session(s) have been revoked across all devices. "
            "Please log in again."
        )
    )
    _clear_rt_cookie(resp)
    return resp


# ===========================================================================
# POST /auth/refresh
# ===========================================================================


@router.post(
    "/refresh",
    status_code=status.HTTP_200_OK,
    summary="Refresh access token",
    description=(
        "Reads the HttpOnly refresh token cookie, validates it, rotates it "
        "(old token revoked, new token issued), and returns a new access token. "
        "\n\nReuse detection: If a previously rotated token is re-presented, all "
        "sessions for the user are revoked immediately as a token theft response."
    ),
    responses={
        200: {"description": "New access token issued. New RT cookie set."},
        401: {"description": "Refresh token invalid, expired, or reused."},
    },
)
async def refresh(
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    raw_refresh_token: str = Depends(get_refresh_token_from_cookie),
) -> JSONResponse:
    """Rotate the refresh token and issue a new access token.

    The browser sends the HttpOnly RT cookie automatically because the
    request path (``/api/v1/auth/refresh``) matches the cookie's
    ``Path`` attribute.

    Args:
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        raw_refresh_token: Raw RT from the HttpOnly cookie.

    Returns:
        JSONResponse: 200 OK with new access token. New RT cookie set.
    """
    service = RefreshTokenService(
        user_repo=UserRepository(db),
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    result = await service.refresh(
        raw_refresh_token=raw_refresh_token,
        redis=redis,
    )
    await db.commit()

    rt_max_age = seconds_until(result.refresh_token_expires_at)

    resp = success_response(
        data=RefreshResponse(
            access_token=result.access_token,
            token_type="bearer",
        ).model_dump(),
    )
    _set_rt_cookie(resp, result.raw_refresh_token, max_age=rt_max_age)
    return resp


# ===========================================================================
# POST /auth/forgot-password
# ===========================================================================


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password reset link",
    description=(
        "Sends a password reset email if the provided address is registered. "
        "Always returns HTTP 200 regardless of whether the email exists "
        "(anti-enumeration protection)."
    ),
    responses={
        200: {"description": "Reset email dispatched if address is registered."},
        429: {"description": "Too many password reset requests. Try again later."},
    },
)
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    """Initiate the password reset flow.

    Checks the IP rate limit, generates a one-use reset token, and
    schedules a password reset email. Returns HTTP 200 regardless of
    whether the email exists in the database.

    Args:
        body: Validated forgot-password request.
        background_tasks: FastAPI background task scheduler.
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        client_ip: Client IP for rate limiting.

    Returns:
        JSONResponse: 200 OK with a generic confirmation message.
    """
    service = PasswordService(
        user_repo=UserRepository(db),
        pwd_reset_repo=PasswordResetTokenRepository(db),
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    raw_token = await service.initiate_password_reset(
        email=body.email,
        client_ip=client_ip,
        redis=redis,
    )

    if raw_token is not None:
        await db.commit()
        reset_url = f"{_get_frontend_base()}/reset-password?token={raw_token}"

        # Re-fetch user for email personalization (service already validated email).
        user = await UserRepository(db).get_by_email(body.email)
        to_name = user.full_name if user else body.email

        background_tasks.add_task(
            send_password_reset_email,
            to_email=body.email,
            to_name=to_name,
            reset_link=reset_url,
        )

    return success_response(
        message=(
            "If an account with that email address exists, a password reset link "
            "has been sent. Please check your inbox and spam folder."
        )
    )


# ===========================================================================
# POST /auth/reset-password
# ===========================================================================


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Reset password using the emailed token",
    description=(
        "Applies a password reset using the one-use token from the reset email. "
        "On success, all active sessions are revoked and the user must log in again."
    ),
    responses={
        200: {"description": "Password reset successfully. All sessions revoked."},
        400: {"description": "New password fails policy requirements."},
        401: {"description": "Reset token is invalid, expired, or already used."},
    },
)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Apply the password reset using a one-use token.

    Args:
        body: Validated reset-password request.
        db: Async SQLAlchemy session.
        redis: Async Redis client.

    Returns:
        JSONResponse: 200 OK with a re-login prompt message.
    """
    service = PasswordService(
        user_repo=UserRepository(db),
        pwd_reset_repo=PasswordResetTokenRepository(db),
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    await service.reset_password(
        raw_token=body.token,
        new_password=body.new_password,
        redis=redis,
    )
    await db.commit()

    return success_response(
        message=(
            "Your password has been reset successfully. "
            "Please log in with your new password."
        )
    )


# ===========================================================================
# POST /auth/verify-email
# ===========================================================================


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    summary="Verify email address",
    description=(
        "Marks a user's email address as verified using the one-use token "
        "from the registration email. The account can be used for login "
        "immediately after verification."
    ),
    responses={
        200: {"description": "Email verified. Account ready for login."},
        401: {"description": "Token is invalid, expired, or already used."},
    },
)
async def verify_email(
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Verify a user's email address.

    Args:
        body: Validated verify-email request.
        db: Async SQLAlchemy session.

    Returns:
        JSONResponse: 200 OK confirming email verification.
    """
    service = EmailVerificationService(
        user_repo=UserRepository(db),
        verify_repo=EmailVerificationRepository(db),
    )
    await service.verify_email(raw_token=body.token)
    await db.commit()

    return success_response(
        message="Your email has been verified successfully. You can now log in."
    )


# ===========================================================================
# POST /auth/resend-verification
# ===========================================================================


@router.post(
    "/resend-verification",
    status_code=status.HTTP_200_OK,
    summary="Resend email verification link",
    description=(
        "Sends a new verification email to the provided address. "
        "Always returns HTTP 200 (anti-enumeration). "
        "Rate limited to 1 resend per 5 minutes per user."
    ),
    responses={
        200: {"description": "Verification email sent if address is registered and unverified."},
        429: {"description": "Resend cooldown period has not elapsed."},
    },
)
async def resend_verification(
    body: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    client_ip: str = Depends(get_client_ip),
) -> JSONResponse:
    """Resend the email verification link.

    Silently succeeds (HTTP 200) if the email is not registered or
    already verified to prevent email enumeration attacks. The rate
    limit is enforced per-user and will raise HTTP 429 if exceeded.

    Args:
        body: Validated resend-verification request.
        background_tasks: FastAPI background task scheduler.
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        client_ip: Client IP for context logging.

    Returns:
        JSONResponse: 200 OK with generic confirmation message.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(body.email)

    if user is not None and not user.is_email_verified and user.is_active:
        service = EmailVerificationService(
            user_repo=user_repo,
            verify_repo=EmailVerificationRepository(db),
        )
        # Re-raise RateLimitError to return HTTP 429 (rate limit is real).
        # Anti-enumeration only applies to unknown/verified emails (silent 200).
        raw_token = await service.resend_verification(user=user, redis=redis)
        await db.commit()

        verify_url = (
            f"{_get_frontend_base()}/verify-email"
            f"?token={raw_token}"
        )
        background_tasks.add_task(
            send_verification_email,
            to_email=user.email,
            to_name=user.full_name,
            verification_link=verify_url,
        )

    return success_response(
        message=(
            "If your email address is registered and not yet verified, "
            "a new verification link has been sent."
        )
    )


# ===========================================================================
# GET /auth/me
# ===========================================================================


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description="Returns the authenticated user's public profile.",
    responses={
        200: {"description": "User profile data."},
        401: {"description": "Not authenticated."},
    },
)
async def get_me(
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Return the authenticated user's public profile.

    Args:
        user: Authenticated user from ``get_current_user``.

    Returns:
        JSONResponse: 200 OK with the user schema.
    """
    return success_response(
        data=UserSchema.from_orm(user).model_dump(mode="json"),
    )


# ===========================================================================
# PATCH /auth/me
# ===========================================================================


@router.patch(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
    description="Updates one or more profile fields (full_name, phone).",
    responses={
        200: {"description": "Profile updated successfully."},
        400: {"description": "No updatable fields provided."},
        401: {"description": "Not authenticated."},
        422: {"description": "Validation error in request body."},
    },
)
async def update_me(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Update the authenticated user's profile.

    At least one of ``full_name`` or ``phone`` must be provided.
    Only the supplied fields are updated (partial update semantics).

    Args:
        body: Validated update-profile request.
        db: Async SQLAlchemy session.
        user: Authenticated user.

    Returns:
        JSONResponse: 200 OK with updated user schema.
    """
    updates: dict = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.phone is not None:
        updates["phone"] = body.phone

    if not updates:
        raise ValidationError(
            message="At least one field (full_name, phone) must be provided."
        )

    stmt = (
        sa_update(User)
        .where(User.id == user.id, User.deleted_at.is_(None))
        .values(**updates)
    )
    await db.execute(stmt)
    await db.commit()

    # Reload updated user from DB for accurate response.
    updated_user = await UserRepository(db).get_by_id(user.id)

    return success_response(
        data=UserSchema.from_orm(updated_user).model_dump(mode="json"),
        message="Profile updated successfully.",
    )


# ===========================================================================
# POST /auth/me/change-password
# ===========================================================================


@router.post(
    "/me/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change password while authenticated",
    description=(
        "Changes the authenticated user's password. Requires the current "
        "password for verification. On success, ALL sessions are revoked "
        "and the user must log in again with the new password."
    ),
    responses={
        200: {"description": "Password changed. All sessions revoked. Re-login required."},
        400: {"description": "New password fails policy or is identical to current."},
        401: {"description": "Not authenticated or current password is incorrect."},
    },
)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Change the authenticated user's password.

    Verifies current password, enforces policy on the new one, re-hashes,
    revokes all sessions (including the current one), and clears the RT cookie.

    Args:
        body: Validated change-password request.
        request: Incoming request (provides AT payload via state).
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        user: Authenticated user.

    Returns:
        JSONResponse: 200 OK with re-login prompt. RT cookie cleared.
    """
    at_payload = request.state.at_payload

    service = PasswordService(
        user_repo=UserRepository(db),
        pwd_reset_repo=PasswordResetTokenRepository(db),
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    await service.change_password(
        user=user,
        current_password=body.current_password,
        new_password=body.new_password,
        current_session_id=at_payload.session_id,
        at_payload=at_payload,
        redis=redis,
    )
    await db.commit()

    resp = success_response(
        message=(
            "Password changed successfully. "
            "Please log in again with your new password."
        )
    )
    _clear_rt_cookie(resp)
    return resp


# ===========================================================================
# GET /auth/sessions
# ===========================================================================


@router.get(
    "/sessions",
    status_code=status.HTTP_200_OK,
    summary="List all active sessions",
    description=(
        "Returns all active sessions for the authenticated user. "
        "The current session is identified by the ``is_current`` flag."
    ),
    responses={
        200: {"description": "Active session list."},
        401: {"description": "Not authenticated."},
    },
)
async def get_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Return all active sessions for the authenticated user.

    Args:
        request: Incoming request (provides AT payload via state).
        db: Async SQLAlchemy session.
        user: Authenticated user.

    Returns:
        JSONResponse: 200 OK with session list and total count.
    """
    at_payload = request.state.at_payload

    service = SessionService(
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    sessions_data = await service.get_active_sessions(
        user_id=user.id,
        current_session_id=at_payload.session_id,
    )

    sessions = [SessionSchema(**s) for s in sessions_data]
    return success_response(
        data=SessionListResponse(
            sessions=sessions,
            total=len(sessions),
        ).model_dump(mode="json"),
    )


# ===========================================================================
# DELETE /auth/sessions/{session_id}
# ===========================================================================


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke a specific session",
    description=(
        "Revokes a specific session by its UUID. The session must belong "
        "to the authenticated user. Can be used to log out of a specific "
        "device remotely."
    ),
    responses={
        200: {"description": "Session revoked successfully."},
        401: {"description": "Not authenticated."},
        404: {"description": "Session not found or does not belong to this user."},
    },
)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Revoke a specific session by ID.

    Args:
        session_id: UUID string of the session to revoke (path parameter).
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        user: Authenticated user (for ownership check).

    Returns:
        JSONResponse: 200 OK with revocation confirmation.
    """
    if not is_valid_uuid(session_id):
        raise NotFoundError(message="Session not found.")

    service = SessionService(
        rt_repo=RefreshTokenRepository(db),
        session_repo=UserSessionRepository(db),
    )
    await service.revoke_session(
        session_id=uuid.UUID(session_id),
        user_id=user.id,
        redis=redis,
    )
    await db.commit()

    return success_response(message="Session revoked successfully.")


# ===========================================================================
# POST /auth/check-password-strength
# ===========================================================================


@router.post(
    "/check-password-strength",
    status_code=status.HTTP_200_OK,
    summary="Check password strength (unauthenticated)",
    description=(
        "Returns a complexity score and a list of policy violation messages "
        "for a candidate password. No data is stored. "
        "Used by the frontend registration form for live strength feedback."
    ),
    responses={
        200: {"description": "Password strength evaluation result."},
    },
)
async def check_password_strength(
    body: PasswordStrengthCheckRequest,
) -> JSONResponse:
    """Evaluate password strength without storing anything.

    Args:
        body: Validated strength-check request.

    Returns:
        JSONResponse: 200 OK with score, is_valid flag, and error list.
    """
    result = PasswordPolicy.validate(body.password)
    return success_response(
        data=PasswordStrengthResponse(
            score=result.score,
            is_valid=result.is_valid,
            errors=result.errors,
        ).model_dump(),
    )


# ===========================================================================
# GET /auth/teacher/profile  — Teacher only
# ===========================================================================


@router.get(
    "/teacher/profile",
    status_code=status.HTTP_200_OK,
    summary="Get teacher profile (teacher only)",
    description=(
        "Returns the teacher's extended profile including bio, headline, "
        "website URL, social links, and aggregate counters."
    ),
    responses={
        200: {"description": "Teacher profile."},
        401: {"description": "Not authenticated."},
        403: {"description": "Not a teacher."},
    },
)
async def get_teacher_profile(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_teacher),
) -> JSONResponse:
    """Return the teacher-specific extended profile.

    Args:
        db: Async SQLAlchemy session.
        user: Authenticated teacher user (enforced by ``get_current_teacher``).

    Returns:
        JSONResponse: 200 OK with teacher profile data.
    """
    profile = await TeacherProfileRepository(db).get_by_user_id(user.id)

    if profile is None:
        return success_response(data=None)

    return success_response(
        data=TeacherProfileSchema(
            id=str(profile.id),
            user_id=str(profile.user_id),
            bio=profile.bio,
            headline=profile.headline,
            website_url=getattr(profile, "website_url", None),
            social_links=getattr(profile, "social_links", None),
            total_students=getattr(profile, "total_students", 0),
            total_courses=getattr(profile, "total_courses", 0),
            total_revenue=float(getattr(profile, "total_revenue", 0) or 0),
        ).model_dump(mode="json"),
    )


# ===========================================================================
# GET /auth/student/profile  — Student only
# ===========================================================================


@router.get(
    "/student/profile",
    status_code=status.HTTP_200_OK,
    summary="Get student profile (student only)",
    description=(
        "Returns the student's extended profile including college, "
        "graduation year, preferred language, and enrollment counters."
    ),
    responses={
        200: {"description": "Student profile."},
        401: {"description": "Not authenticated."},
        403: {"description": "Not a student."},
    },
)
async def get_student_profile(
    db: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_student),
) -> JSONResponse:
    """Return the student-specific extended profile.

    Args:
        db: Async SQLAlchemy session.
        user: Authenticated student user (enforced by ``get_current_student``).

    Returns:
        JSONResponse: 200 OK with student profile data.
    """
    profile = await StudentProfileRepository(db).get_by_user_id(user.id)

    if profile is None:
        return success_response(data=None)

    return success_response(
        data=StudentProfileSchema(
            id=str(profile.id),
            user_id=str(profile.user_id),
            college=getattr(profile, "college", None),
            graduation_year=getattr(profile, "graduation_year", None),
            preferred_language=getattr(profile, "preferred_language", None),
            total_courses_enrolled=getattr(profile, "total_courses_enrolled", 0),
            total_courses_completed=getattr(profile, "total_courses_completed", 0),
        ).model_dump(mode="json"),
    )
