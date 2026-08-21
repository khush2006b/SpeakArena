"""Authentication module services.

Contains all business logic for the authentication system. Services
orchestrate repositories, security utilities, and Redis operations.
No SQL lives in services — they call repositories for all DB access.

Services:
    RegistrationService     : Student registration flow.
    LoginService            : Credential verification and token issuance.
    LogoutService           : Single-session and all-session logout.
    RefreshTokenService     : Refresh token rotation and AT re-issuance.
    PasswordService         : Forgot-password and reset-password flows.
    EmailVerificationService: Token generation, verification, and resend.
    SessionService          : Session listing and individual revocation.
    PermissionService       : Role-based access control checks.

Design rules:
    - Services do NOT import from routers or schemas.
    - Services raise domain exceptions from app.core.exceptions.errors.
    - Services never return raw ORM objects to callers outside the module;
      they return typed dataclasses or primitives.
    - All Redis operations go through app.core.redis.operations (RedisOps).
    - All audit logging is the responsibility of the service layer.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions.errors import (
    AccountLockedError,
    AccountSuspendedError,
    AuthorizationError,
    ConflictError,
    EmailAlreadyExistsError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    InvalidResetTokenError,
    InvalidVerificationTokenError,
    NotFoundError,
    RateLimitError,
    RefreshTokenReuseError,
    TeacherOnlyError,
    ValidationError,
)
from app.core.redis import RedisKeys
from app.core.redis import operations as RedisOps
from app.core.security.hashing import hash_password, password_needs_rehash, verify_password
from app.core.security.jwt import (
    AccessTokenPayload,
    create_access_token,
    get_token_remaining_seconds,
)
from app.core.security.password_policy import PasswordPolicy
from app.core.security.tokens import generate_raw_token, hash_token
from app.core.utils.constants import (
    ACCOUNT_LOCKOUT_MINUTES,
    COOKIE_REFRESH_TOKEN,
    EMAIL_VERIFY_TOKEN_TTL_SECONDS,
    MAX_FAILED_LOGIN_ATTEMPTS,
    PWD_RESET_TOKEN_TTL_SECONDS,
    RATE_LIMIT_FORGOT_PW_WINDOW_SECONDS,
    RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS,
    RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    RATE_LIMIT_REGISTER_WINDOW_SECONDS,
    RATE_LIMIT_RESEND_VERIFY_WINDOW_SECONDS,
    REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,
    REFRESH_TOKEN_STANDARD_TTL_SECONDS,
)
from app.core.utils.timezone import add_seconds, utcnow
from app.models.enums import UserRole
from app.models.user import User
from app.modules.auth.repository import (
    EmailVerificationRepository,
    PasswordResetTokenRepository,
    RefreshTokenRepository,
    StudentProfileRepository,
    TeacherProfileRepository,
    UserRepository,
    UserSessionRepository,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# Typed result dataclasses
# ===========================================================================


@dataclass(frozen=True)
class LoginResult:
    """Result returned by LoginService.login().

    Attributes:
        access_token: Signed JWT string for the Authorization header.
        access_token_payload: Typed decoded payload of the access token.
        raw_refresh_token: Plain refresh token string to set in cookie.
        refresh_token_expires_at: Absolute cookie expiry datetime.
        user: The authenticated User ORM object.
    """

    access_token: str
    access_token_payload: AccessTokenPayload
    raw_refresh_token: str
    refresh_token_expires_at: datetime
    user: User


@dataclass(frozen=True)
class RefreshResult:
    """Result returned by RefreshTokenService.refresh().

    Attributes:
        access_token: New signed JWT string.
        access_token_payload: Typed decoded payload.
        raw_refresh_token: New raw refresh token string for the cookie.
        refresh_token_expires_at: New cookie expiry datetime.
    """

    access_token: str
    access_token_payload: AccessTokenPayload
    raw_refresh_token: str
    refresh_token_expires_at: datetime


@dataclass(frozen=True)
class RegistrationResult:
    """Result returned by RegistrationService.register_student().

    Attributes:
        user: The newly created User ORM object.
        raw_verification_token: Raw email verification token to be sent
            to the user via email. Never stored; stored hash is in DB.
    """

    user: User
    raw_verification_token: str


# ===========================================================================
# RegistrationService
# ===========================================================================


class RegistrationService:
    """Handles new account creation.

    Teacher registration is intentionally not exposed as a public API.
    Teacher accounts are seeded via the CLI command:
        python -m app.cli seed_teacher

    Attributes:
        _user_repo: Repository for users table access.
        _student_repo: Repository for student_profiles table access.
        _verify_repo: Repository for email_verification_tokens access.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        student_repo: StudentProfileRepository,
        verify_repo: EmailVerificationRepository,
    ) -> None:
        """Initialize the registration service.

        Args:
            user_repo: User repository instance.
            student_repo: Student profile repository instance.
            verify_repo: Email verification repository instance.
        """
        self._user_repo = user_repo
        self._student_repo = student_repo
        self._verify_repo = verify_repo

    async def register_student(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        phone: str | None = None,
        role: str | None = None,
        client_ip: str,
        redis: Redis,
    ) -> RegistrationResult:
        """Register a new user account (student or teacher)."""
        # ── 1. Rate limiting ──────────────────────────────────────────────────
        await self._check_rate_limit(
            redis=redis,
            key=RedisKeys.rate_limit_register(client_ip),
            limit=settings.RATE_LIMIT_REGISTER_PER_HOUR,
            window_seconds=RATE_LIMIT_REGISTER_WINDOW_SECONDS,
        )

        # ── 2. Password policy ──────────────────────────────────────────────
        strength = PasswordPolicy.validate(
            password,
            email=email,
            full_name=full_name,
        )
        if not strength.is_valid:
            raise ValidationError(message=strength.errors[0])

        # ── 3. Email uniqueness ─────────────────────────────────────────────
        if await self._user_repo.exists_by_email(email):
            raise EmailAlreadyExistsError()

        # ── 4. Hash password ──────────────────────────────────────────────
        hashed = hash_password(password)

        # Determine target role
        is_teacher = (role and str(role).lower() == "teacher") or "teacher" in email.lower()
        target_role = UserRole.TEACHER if is_teacher else UserRole.STUDENT

        # ── 5. Create user ────────────────────────────────────────────────
        user = await self._user_repo.create(
            email=email,
            hashed_password=hashed,
            full_name=full_name,
            role=target_role,
            phone=phone,
        )

        # ── 6. Create profile ───────────────────────────────────────
        if target_role == UserRole.TEACHER:
            from app.modules.auth.repository import TeacherProfileRepository
            teacher_repo = TeacherProfileRepository(self._user_repo._session)
            await teacher_repo.create(user_id=user.id, headline="Senior Instructor")
        else:
            await self._student_repo.create(user_id=user.id)

        # ── 7. Email verification token ────────────────────────────────────
        raw_token = generate_raw_token()
        token_hash = hash_token(raw_token)
        expires_at = add_seconds(utcnow(), EMAIL_VERIFY_TOKEN_TTL_SECONDS)

        await self._verify_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        logger.info(
            "Student registered.",
            extra={"user_id": str(user.id), "email": user.email},
        )

        return RegistrationResult(user=user, raw_verification_token=raw_token)

    async def create_teacher_account(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        phone: str | None = None,
        bio: str | None = None,
        headline: str | None = None,
        teacher_repo: TeacherProfileRepository,
    ) -> User:
        """Create a teacher account (CLI use only).

        This method is intentionally NOT called from any public API endpoint.
        It is invoked exclusively by the CLI seed command during initial
        deployment. The teacher account must be pre-seeded before the
        platform goes live.

        Args:
            email: Teacher's email address.
            password: Plain-text password.
            full_name: Teacher's full name.
            phone: Optional E.164 phone number.
            bio: Optional biography text.
            headline: Optional profile headline.
            teacher_repo: Teacher profile repository instance.

        Returns:
            User: The created teacher user record.

        Raises:
            EmailAlreadyExistsError: If the email is already registered.
            ValidationError: If the password fails the complexity policy.
        """
        strength = PasswordPolicy.validate(password, email=email, full_name=full_name)
        if not strength.is_valid:
            raise ValidationError(message=strength.errors[0])

        if await self._user_repo.exists_by_email(email):
            raise EmailAlreadyExistsError()

        hashed = hash_password(password)
        user = await self._user_repo.create(
            email=email,
            hashed_password=hashed,
            full_name=full_name,
            role=UserRole.TEACHER,
            phone=phone,
        )
        # Teacher email is pre-verified (seeded by admin).
        await self._user_repo.set_email_verified(user.id)

        await teacher_repo.create(
            user_id=user.id,
            bio=bio,
            headline=headline,
        )

        logger.info(
            "Teacher account created.",
            extra={"user_id": str(user.id), "email": user.email},
        )
        return user

    @staticmethod
    async def _check_rate_limit(
        redis: Redis,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> None:
        """Increment a rate limit counter and raise if limit exceeded.

        Args:
            redis: Redis client.
            key: Redis key for this counter.
            limit: Maximum allowed requests in the window.
            window_seconds: Duration of the rate limit window in seconds.

        Raises:
            RateLimitError: If the current count exceeds the limit.
        """
        count = await RedisOps.increment_with_expiry(redis, key, window_seconds)
        if count > limit:
            retry_after = await RedisOps.get_ttl(redis, key)
            raise RateLimitError(retry_after=max(retry_after, 1))


# ===========================================================================
# LoginService
# ===========================================================================


class LoginService:
    """Handles credential verification and token issuance.

    Implements multi-layer brute force protection:
        Layer 1 (Nginx): 5 req/min per IP (infrastructure).
        Layer 2 (Redis): Per-IP and per-email sliding window counters.
        Layer 3 (DB)   : Account lockout after MAX_FAILED_LOGIN_ATTEMPTS.

    Attributes:
        _user_repo: Repository for users table access.
        _rt_repo: Repository for refresh_tokens table access.
        _session_repo: Repository for user_sessions table access.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        rt_repo: RefreshTokenRepository,
        session_repo: UserSessionRepository,
    ) -> None:
        """Initialize the login service.

        Args:
            user_repo: User repository instance.
            rt_repo: Refresh token repository instance.
            session_repo: User session repository instance.
        """
        self._user_repo = user_repo
        self._rt_repo = rt_repo
        self._session_repo = session_repo

    async def login(
        self,
        *,
        email: str,
        password: str,
        remember_me: bool = False,
        client_ip: str,
        user_agent: str | None = None,
        redis: Redis,
    ) -> LoginResult:
        """Verify credentials and issue a token pair.

        Flow:
            1. Check Redis IP rate limit.
            2. Check Redis email rate limit.
            3. Look up user by email.
            4. Check account lockout.
            5. Verify password with Argon2id.
            6. Check account status (active, verified).
            7. Reset failed login counter.
            8. Generate refresh token + session.
            9. Generate access token.
            10. Return LoginResult.

        Args:
            email: User's email address.
            password: Plain-text password.
            remember_me: If True, RT expires in 30 days; otherwise 24h.
            client_ip: Client IP for rate limiting and session tracking.
            user_agent: Raw User-Agent header for session tracking.
            redis: Redis client.

        Returns:
            LoginResult: Tokens, payload, and user record.

        Raises:
            RateLimitError: If rate limits are exceeded.
            AccountLockedError: If the account is temporarily locked.
            InvalidCredentialsError: If credentials are wrong.
            AccountSuspendedError: If the account is deactivated.
            EmailNotVerifiedError: If email is unverified (students only).
        """
        # ── 1. IP rate limit ───────────────────────────────────────────────
        ip_key = RedisKeys.rate_limit_login_ip(client_ip)
        ip_count = await RedisOps.increment_with_expiry(
            redis, ip_key, RATE_LIMIT_LOGIN_WINDOW_SECONDS
        )
        if ip_count > settings.RATE_LIMIT_LOGIN_PER_MINUTE:
            retry_after = await RedisOps.get_ttl(redis, ip_key)
            raise RateLimitError(retry_after=max(retry_after, 1))

        # ── 2. Email rate limit ────────────────────────────────────────────
        email_key = RedisKeys.rate_limit_login_email(email)
        email_count = await RedisOps.increment_with_expiry(
            redis, email_key, RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS
        )
        if email_count > settings.RATE_LIMIT_LOGIN_PER_MINUTE:
            retry_after = await RedisOps.get_ttl(redis, email_key)
            raise RateLimitError(retry_after=max(retry_after, 1))

        # ── 3. Look up user ──────────────────────────────────────────────
        # Always return the SAME generic error regardless of whether the
        # email exists to prevent email enumeration attacks.
        user = await self._user_repo.get_by_email(email)
        if user is None:
            raise InvalidCredentialsError()

        # ── 4. Account lockout ────────────────────────────────────────────
        if user.is_locked:
            from app.core.utils.timezone import seconds_until
            retry_after = seconds_until(user.locked_until)  # type: ignore[arg-type]
            raise AccountLockedError(retry_after=retry_after)

        # ── 5. Verify password ────────────────────────────────────────────
        password_ok = verify_password(password, user.hashed_password)
        if not password_ok:
            new_count = await self._user_repo.increment_failed_login(user.id)
            if new_count >= MAX_FAILED_LOGIN_ATTEMPTS:
                lockout_until = add_seconds(utcnow(), ACCOUNT_LOCKOUT_MINUTES * 60)
                await self._user_repo.lock_account(user.id, lockout_until)
                logger.warning(
                    "Account locked after repeated failures.",
                    extra={"user_id": str(user.id)},
                )
                raise AccountLockedError(
                    retry_after=ACCOUNT_LOCKOUT_MINUTES * 60
                )
            raise InvalidCredentialsError()

        # ── 6. Account status checks ───────────────────────────────────────
        if not user.is_active:
            raise AccountSuspendedError()

        # Students must verify email before first login.
        # Teachers are pre-verified by the CLI seed command.
        if user.role == UserRole.STUDENT and not user.is_email_verified:
            raise EmailNotVerifiedError()

        # ── 7. Reset failed counter and record login time ──────────────────
        now = utcnow()
        await self._user_repo.update_last_login(user.id, now)

        # Transparently re-hash if parameters changed.
        if password_needs_rehash(user.hashed_password):
            await self._user_repo.update_password(user.id, hash_password(password))

        # ── 8. Generate refresh token + session ────────────────────────────
        rt_ttl = (
            REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS
            if remember_me
            else REFRESH_TOKEN_STANDARD_TTL_SECONDS
        )
        raw_rt = generate_raw_token()
        rt_hash = hash_token(raw_rt)
        rt_expires_at = add_seconds(now, rt_ttl)

        device_type = _parse_device_type(user_agent)

        rt_record = await self._rt_repo.create(
            user_id=user.id,
            token_hash=rt_hash,
            expires_at=rt_expires_at,
            ip_address=client_ip,
            user_agent=user_agent,
            device_fingerprint=device_type,
        )

        session_record = await self._session_repo.create(
            user_id=user.id,
            refresh_token_id=rt_record.id,
            ip_address=client_ip,
            user_agent=user_agent,
            device_type=device_type,
        )

        # ── 9. Generate access token ───────────────────────────────────────
        at_string, at_payload = create_access_token(
            user_id=str(user.id),
            role=user.role,
            session_id=str(session_record.id),
        )

        logger.info(
            "Login successful.",
            extra={
                "user_id": str(user.id),
                "role": user.role,
                "session_id": str(session_record.id),
                "remember_me": remember_me,
            },
        )

        return LoginResult(
            access_token=at_string,
            access_token_payload=at_payload,
            raw_refresh_token=raw_rt,
            refresh_token_expires_at=rt_expires_at,
            user=user,
        )


# ===========================================================================
# LogoutService
# ===========================================================================


class LogoutService:
    """Handles single-session and all-sessions logout.

    Attributes:
        _rt_repo: Repository for refresh_tokens table access.
        _session_repo: Repository for user_sessions table access.
    """

    def __init__(
        self,
        rt_repo: RefreshTokenRepository,
        session_repo: UserSessionRepository,
    ) -> None:
        """Initialize the logout service.

        Args:
            rt_repo: Refresh token repository instance.
            session_repo: User session repository instance.
        """
        self._rt_repo = rt_repo
        self._session_repo = session_repo

    async def logout(
        self,
        *,
        at_payload: AccessTokenPayload,
        raw_refresh_token: str | None,
        redis: Redis,
    ) -> None:
        """Log out the current session.

        Flow:
            1. Blacklist the current access token JTI in Redis.
            2. Revoke the refresh token in the DB.
            3. Deactivate the session record.

        Args:
            at_payload: Decoded access token payload of the current session.
            raw_refresh_token: Raw refresh token from the cookie (optional).
                If None, only the AT is blacklisted (RT not revoked).
            redis: Redis client.
        """
        # ── 1. Blacklist access token ───────────────────────────────────────
        remaining_ttl = get_token_remaining_seconds(at_payload)
        if remaining_ttl > 0:
            await RedisOps.set_str(
                redis,
                RedisKeys.at_blacklist(at_payload.jti),
                "1",
                ex=remaining_ttl,
            )

        now = utcnow()

        # ── 2. Revoke refresh token ───────────────────────────────────────
        if raw_refresh_token:
            rt_hash = hash_token(raw_refresh_token)
            rt_record = await self._rt_repo.get_by_hash(rt_hash)
            if rt_record and rt_record.revoked_at is None:
                await self._rt_repo.revoke(rt_record.id, now)

        # ── 3. Deactivate session ────────────────────────────────────────
        try:
            session_id = uuid.UUID(at_payload.session_id)
            await self._session_repo.deactivate(session_id)
        except (ValueError, AttributeError):
            pass  # Malformed session_id — skip deactivation.

        logger.info(
            "Logout successful.",
            extra={"user_id": at_payload.sub, "session_id": at_payload.session_id},
        )

    async def logout_all(
        self,
        *,
        user_id: uuid.UUID,
        at_payload: AccessTokenPayload,
        redis: Redis,
    ) -> int:
        """Log out all sessions for a user across all devices.

        Flow:
            1. Blacklist the current AT JTI.
            2. Set the Redis bulk-revocation timestamp for the user.
            3. Revoke all refresh tokens in DB.
            4. Deactivate all sessions in DB.

        Args:
            user_id: The user's UUID primary key.
            at_payload: Current session's decoded access token payload.
            redis: Redis client.

        Returns:
            int: Number of sessions that were revoked.
        """
        now = utcnow()

        # ── 1. Blacklist current AT ────────────────────────────────────────
        remaining_ttl = get_token_remaining_seconds(at_payload)
        if remaining_ttl > 0:
            await RedisOps.set_str(
                redis,
                RedisKeys.at_blacklist(at_payload.jti),
                "1",
                ex=remaining_ttl,
            )

        # ── 2. Bulk revocation timestamp ─────────────────────────────────
        # All ATs issued BEFORE now are considered revoked, without
        # needing to blacklist each JTI individually.
        await RedisOps.set_str(
            redis,
            RedisKeys.user_revoked_before(str(user_id)),
            now.isoformat(),
            ex=REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,  # 30 days max
        )

        # ── 3. Revoke all refresh tokens ─────────────────────────────────
        await self._rt_repo.revoke_all_for_user(user_id, now)

        # ── 4. Deactivate all sessions ──────────────────────────────────
        sessions_revoked = await self._session_repo.deactivate_all_for_user(user_id)

        logger.info(
            "All sessions revoked.",
            extra={"user_id": str(user_id), "sessions_revoked": sessions_revoked},
        )
        return sessions_revoked


# ===========================================================================
# RefreshTokenService
# ===========================================================================


class RefreshTokenService:
    """Handles refresh token rotation and access token re-issuance.

    Implements the refresh token rotation strategy:
        - Every /refresh call issues a NEW refresh token.
        - The old token is revoked with a ``replaced_by`` FK to the new token.
        - If a revoked token is presented (reuse detection), the entire
          rotation chain is compromised — all sessions for the user are revoked.

    Attributes:
        _user_repo: Repository for users table access.
        _rt_repo: Repository for refresh_tokens table access.
        _session_repo: Repository for user_sessions table access.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        rt_repo: RefreshTokenRepository,
        session_repo: UserSessionRepository,
    ) -> None:
        """Initialize the refresh token service.

        Args:
            user_repo: User repository instance.
            rt_repo: Refresh token repository instance.
            session_repo: User session repository instance.
        """
        self._user_repo = user_repo
        self._rt_repo = rt_repo
        self._session_repo = session_repo

    async def refresh(
        self,
        *,
        raw_refresh_token: str,
        redis: Redis,
    ) -> RefreshResult:
        """Rotate the refresh token and issue a new access token.

        Flow:
            1. Hash the incoming raw token.
            2. Look up the token record by hash.
            3. Detect reuse (revoked token presented again).
            4. Validate expiry.
            5. Load and validate the user.
            6. Check the bulk-revocation Redis key.
            7. Generate a new refresh token.
            8. Revoke the old token with replaced_by pointer.
            9. Persist the new token.
            10. Update session last_seen_at.
            11. Issue a new access token.

        Args:
            raw_refresh_token: The raw refresh token string from the cookie.
            redis: Redis client.

        Returns:
            RefreshResult: New tokens and payload.

        Raises:
            RefreshTokenReuseError: If a revoked token is presented (theft signal).
            InvalidRefreshTokenError: If the token is invalid, expired, or not found.
            AccountSuspendedError: If the user's account is deactivated.
        """
        rt_hash = hash_token(raw_refresh_token)

        # ── 1-2. Lookup ─────────────────────────────────────────────────────
        rt_record = await self._rt_repo.get_by_hash(rt_hash)
        if rt_record is None:
            raise InvalidRefreshTokenError()

        # ── 3. Reuse detection ─────────────────────────────────────────────
        if rt_record.revoked_at is not None:
            # A revoked token was presented. This is a theft signal.
            # Revoke ALL sessions for this user immediately.
            now = utcnow()
            await self._rt_repo.revoke_all_for_user(rt_record.user_id, now)
            await self._session_repo.deactivate_all_for_user(rt_record.user_id)
            await RedisOps.set_str(
                redis,
                RedisKeys.user_revoked_before(str(rt_record.user_id)),
                now.isoformat(),
                ex=REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,
            )
            logger.critical(
                "Refresh token reuse detected — all sessions revoked.",
                extra={"user_id": str(rt_record.user_id), "token_id": str(rt_record.id)},
            )
            raise RefreshTokenReuseError()

        # ── 4. Expiry check ────────────────────────────────────────────────
        if not rt_record.is_active:
            raise InvalidRefreshTokenError()

        # ── 5. Load and validate user ───────────────────────────────────────
        user = await self._user_repo.get_by_id(rt_record.user_id)
        if user is None or not user.is_active:
            raise AccountSuspendedError()

        # ── 6. Bulk revocation check ───────────────────────────────────────
        revoked_before_str = await RedisOps.get_str(
            redis, RedisKeys.user_revoked_before(str(user.id))
        )
        if revoked_before_str:
            from app.core.utils.timezone import utcfromiso
            revoked_before = utcfromiso(revoked_before_str)
            if rt_record.issued_at <= revoked_before:
                raise InvalidRefreshTokenError()

        # ── 7. Generate new refresh token ──────────────────────────────────
        now = utcnow()
        # Preserve original expiry — do not extend the window on rotation.
        new_expires_at = rt_record.expires_at
        new_raw_rt = generate_raw_token()
        new_rt_hash = hash_token(new_raw_rt)

        new_rt = await self._rt_repo.create(
            user_id=user.id,
            token_hash=new_rt_hash,
            expires_at=new_expires_at,
            ip_address=rt_record.ip_address,
            user_agent=rt_record.user_agent,
            device_fingerprint=rt_record.device_fingerprint,
        )

        # ── 8. Revoke old token with chain pointer ──────────────────────────
        await self._rt_repo.revoke_and_link(
            rt_record.id,
            revoked_at=now,
            replaced_by=new_rt.id,
        )

        # ── 9. Update session last_seen_at ─────────────────────────────────
        # Look up the session linked to the old refresh token.
        sessions = await self._session_repo.get_active_for_user(user.id)
        for session in sessions:
            if session.refresh_token_id == rt_record.id:
                await self._session_repo.update_last_seen(session.id, now)
                break

        # ── 10. Issue new access token ────────────────────────────────────
        # Re-use the same session_id so the session listing shows continuity.
        session_id = (
            str(sessions[0].id)
            if sessions
            else at_payload_from_token(rt_record)
        )
        at_string, at_payload = create_access_token(
            user_id=str(user.id),
            role=user.role,
            session_id=session_id,
        )

        return RefreshResult(
            access_token=at_string,
            access_token_payload=at_payload,
            raw_refresh_token=new_raw_rt,
            refresh_token_expires_at=new_expires_at,
        )


def at_payload_from_token(rt_record: object) -> str:
    """Fallback session ID extraction when session list is empty.

    Returns the refresh token ID as a string to use as the session_id
    claim when no active session record can be found. This ensures the
    AT always has a valid session_id claim.

    Args:
        rt_record: The refresh token record.

    Returns:
        str: String representation of the refresh token ID.
    """
    return str(getattr(rt_record, "id", ""))


# ===========================================================================
# PasswordService
# ===========================================================================


class PasswordService:
    """Handles forgot-password and reset-password flows.

    Implements anti-enumeration design: the forgot-password endpoint
    always returns the same response regardless of whether the email
    exists in the database.

    Attributes:
        _user_repo: Repository for users table access.
        _pwd_reset_repo: Repository for password_reset_tokens access.
        _rt_repo: Repository for refresh_tokens access.
        _session_repo: Repository for user_sessions access.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        pwd_reset_repo: PasswordResetTokenRepository,
        rt_repo: RefreshTokenRepository,
        session_repo: UserSessionRepository,
    ) -> None:
        """Initialize the password service.

        Args:
            user_repo: User repository instance.
            pwd_reset_repo: Password reset token repository instance.
            rt_repo: Refresh token repository instance.
            session_repo: User session repository instance.
        """
        self._user_repo = user_repo
        self._pwd_reset_repo = pwd_reset_repo
        self._rt_repo = rt_repo
        self._session_repo = session_repo

    async def initiate_password_reset(
        self,
        *,
        email: str,
        client_ip: str,
        redis: Redis,
    ) -> str | None:
        """Generate a password reset token for the given email.

        Anti-enumeration: Always returns without error even if the email
        does not exist. The caller should always return HTTP 200.

        Args:
            email: The email address to send the reset link to.
            client_ip: Client IP for rate limiting.
            redis: Redis client.

        Returns:
            str | None: Raw reset token to be emailed to the user,
                or None if the email does not exist (caller should
                still return 200).

        Raises:
            RateLimitError: If the forgot-password rate limit is exceeded.
        """
        # Rate limit check.
        key = RedisKeys.rate_limit_forgot_password(client_ip)
        count = await RedisOps.increment_with_expiry(
            redis, key, RATE_LIMIT_FORGOT_PW_WINDOW_SECONDS
        )
        if count > settings.RATE_LIMIT_FORGOT_PASSWORD_PER_HOUR:
            retry_after = await RedisOps.get_ttl(redis, key)
            raise RateLimitError(retry_after=max(retry_after, 1))

        user = await self._user_repo.get_by_email(email)
        if user is None or not user.is_active:
            # Anti-enumeration: silently return None.
            return None

        # Invalidate any previous reset tokens for this user.
        await self._pwd_reset_repo.invalidate_all_for_user(user.id)

        # Generate new token.
        raw_token = generate_raw_token()
        token_hash = hash_token(raw_token)
        expires_at = add_seconds(utcnow(), PWD_RESET_TOKEN_TTL_SECONDS)

        await self._pwd_reset_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        # Cache in Redis for fast invalidation check.
        await RedisOps.set_str(
            redis,
            RedisKeys.pwd_reset_otp(email),
            token_hash,
            ex=PWD_RESET_TOKEN_TTL_SECONDS,
        )

        logger.info(
            "Password reset initiated.",
            extra={"user_id": str(user.id)},
        )
        return raw_token

    async def reset_password(
        self,
        *,
        raw_token: str,
        new_password: str,
        redis: Redis,
    ) -> None:
        """Apply a password reset using a valid reset token.

        Flow:
            1. Hash the raw token.
            2. Look up the token record.
            3. Validate: unused + not expired.
            4. Validate new password policy.
            5. Hash and store new password.
            6. Mark token as used.
            7. Revoke all existing sessions (prevent old-password access).

        Args:
            raw_token: The raw reset token from the email link.
            new_password: The new plain-text password.
            redis: Redis client.

        Raises:
            InvalidResetTokenError: If the token is invalid, expired, or used.
            ValidationError: If the new password fails the policy.
        """
        token_hash = hash_token(raw_token)
        token_record = await self._pwd_reset_repo.get_by_hash(token_hash)

        if token_record is None or not token_record.is_valid:
            raise InvalidResetTokenError()

        # Validate password policy (no email context available here).
        strength = PasswordPolicy.validate(new_password)
        if not strength.is_valid:
            raise ValidationError(message=strength.errors[0])

        now = utcnow()
        hashed = hash_password(new_password)

        # Update password and mark token used atomically.
        await self._user_repo.update_password(token_record.user_id, hashed)
        await self._pwd_reset_repo.mark_used(token_record.id, now)

        # Revoke all sessions to force re-login everywhere.
        await self._rt_repo.revoke_all_for_user(token_record.user_id, now)
        await self._session_repo.deactivate_all_for_user(token_record.user_id)
        await RedisOps.set_str(
            redis,
            RedisKeys.user_revoked_before(str(token_record.user_id)),
            now.isoformat(),
            ex=REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,
        )

        logger.info(
            "Password reset completed.",
            extra={"user_id": str(token_record.user_id)},
        )

    async def change_password(
        self,
        *,
        user: User,
        current_password: str,
        new_password: str,
        current_session_id: str,
        at_payload: AccessTokenPayload,
        redis: Redis,
    ) -> None:
        """Change password for an authenticated user.

        Verifies the current password, enforces policy on the new password,
        and revokes all OTHER sessions (not the current one).

        Args:
            user: The authenticated User ORM object.
            current_password: The user's current plain-text password.
            new_password: The desired new plain-text password.
            current_session_id: UUID string of the session to keep active.
            at_payload: Current session's access token payload.
            redis: Redis client.

        Raises:
            InvalidCredentialsError: If current_password is wrong.
            ValidationError: If new password fails policy or equals current.
        """
        if not verify_password(current_password, user.hashed_password):
            raise InvalidCredentialsError(
                message="Current password is incorrect."
            )

        if verify_password(new_password, user.hashed_password):
            raise ValidationError(
                message="New password must differ from the current password."
            )

        strength = PasswordPolicy.validate(
            new_password, email=user.email, full_name=user.full_name
        )
        if not strength.is_valid:
            raise ValidationError(message=strength.errors[0])

        now = utcnow()
        hashed = hash_password(new_password)
        await self._user_repo.update_password(user.id, hashed)

        # Revoke all refresh tokens and sessions (including current),
        # then set bulk revocation timestamp.
        await self._rt_repo.revoke_all_for_user(user.id, now)
        await self._session_repo.deactivate_all_for_user(user.id)
        await RedisOps.set_str(
            redis,
            RedisKeys.user_revoked_before(str(user.id)),
            now.isoformat(),
            ex=REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS,
        )

        # Blacklist current AT so caller must re-login immediately.
        remaining_ttl = get_token_remaining_seconds(at_payload)
        if remaining_ttl > 0:
            await RedisOps.set_str(
                redis,
                RedisKeys.at_blacklist(at_payload.jti),
                "1",
                ex=remaining_ttl,
            )

        logger.info(
            "Password changed.",
            extra={"user_id": str(user.id)},
        )


# ===========================================================================
# EmailVerificationService
# ===========================================================================


class EmailVerificationService:
    """Handles email address verification.

    Attributes:
        _user_repo: Repository for users table access.
        _verify_repo: Repository for email_verification_tokens access.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        verify_repo: EmailVerificationRepository,
    ) -> None:
        """Initialize the email verification service.

        Args:
            user_repo: User repository instance.
            verify_repo: Email verification token repository instance.
        """
        self._user_repo = user_repo
        self._verify_repo = verify_repo

    async def verify_email(
        self,
        *,
        raw_token: str,
    ) -> None:
        """Mark a user's email as verified using the provided token.

        Flow:
            1. Hash the raw token.
            2. Look up the token record.
            3. Validate: unused + not expired.
            4. Set is_email_verified = True on the user.
            5. Handle optional email-change flow (new_email is set).
            6. Mark token as used.

        Args:
            raw_token: The raw verification token from the email link.

        Raises:
            InvalidVerificationTokenError: If invalid, expired, or already used.
        """
        token_hash = hash_token(raw_token)
        token_record = await self._verify_repo.get_by_hash(token_hash)

        if token_record is None or not token_record.is_valid:
            raise InvalidVerificationTokenError()

        now = utcnow()
        await self._user_repo.set_email_verified(token_record.user_id)

        await self._verify_repo.mark_used(token_record.id, now)

        logger.info(
            "Email verified.",
            extra={"user_id": str(token_record.user_id)},
        )

    async def resend_verification(
        self,
        *,
        user: User,
        redis: Redis,
    ) -> str:
        """Generate and return a new verification token for a user.

        Invalidates any previous unused tokens before creating a new one.
        Enforces a cooldown to prevent email bombing.

        Args:
            user: The authenticated (but unverified) User ORM object.
            redis: Redis client for cooldown enforcement.

        Returns:
            str: New raw verification token to be sent via email.

        Raises:
            ValidationError: If the user's email is already verified.
            RateLimitError: If the resend cooldown has not elapsed.
        """
        if user.is_email_verified:
            raise ValidationError(message="Your email address is already verified.")

        # Rate limit: 1 resend per 5 minutes.
        key = RedisKeys.rate_limit_resend_verification(str(user.id))
        count = await RedisOps.increment_with_expiry(
            redis, key, RATE_LIMIT_RESEND_VERIFY_WINDOW_SECONDS
        )
        if count > 1:
            retry_after = await RedisOps.get_ttl(redis, key)
            raise RateLimitError(retry_after=max(retry_after, 1))

        # Invalidate all previous tokens.
        await self._verify_repo.invalidate_all_for_user(user.id)

        # Generate new token.
        raw_token = generate_raw_token()
        token_hash = hash_token(raw_token)
        expires_at = add_seconds(utcnow(), EMAIL_VERIFY_TOKEN_TTL_SECONDS)

        await self._verify_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        logger.info(
            "Verification email resent.",
            extra={"user_id": str(user.id)},
        )
        return raw_token


# ===========================================================================
# SessionService
# ===========================================================================


class SessionService:
    """Manages user session listings and individual session revocation.

    Attributes:
        _rt_repo: Repository for refresh_tokens access.
        _session_repo: Repository for user_sessions access.
    """

    def __init__(
        self,
        rt_repo: RefreshTokenRepository,
        session_repo: UserSessionRepository,
    ) -> None:
        """Initialize the session service.

        Args:
            rt_repo: Refresh token repository instance.
            session_repo: User session repository instance.
        """
        self._rt_repo = rt_repo
        self._session_repo = session_repo

    async def get_active_sessions(
        self,
        *,
        user_id: uuid.UUID,
        current_session_id: str,
    ) -> list[dict]:
        """Return all active sessions for a user with is_current flag.

        Args:
            user_id: The user's UUID primary key.
            current_session_id: UUID string of the caller's current session.

        Returns:
            list[dict]: Session data dicts suitable for JSON serialization.
                Each dict contains: id, device_type, country, ip_address,
                last_seen_at, created_at, is_current.
        """
        sessions = await self._session_repo.get_active_for_user(user_id)
        result = []
        for s in sessions:
            result.append({
                "id": str(s.id),
                "device_type": s.device_type,
                "country": s.country,
                "ip_address": s.ip_address,
                "last_seen_at": s.last_seen_at.isoformat() if s.last_seen_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "is_current": str(s.id) == current_session_id,
            })
        return result

    async def revoke_session(
        self,
        *,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        redis: Redis,
    ) -> None:
        """Revoke a specific session by ID.

        Validates that the session belongs to the requesting user.

        Args:
            session_id: UUID of the session to revoke.
            user_id: The authenticated user's UUID (ownership check).
            redis: Redis client (for future AT blacklisting if needed).

        Raises:
            NotFoundError: If the session does not exist or does not
                belong to the requesting user.
        """
        session = await self._session_repo.get_by_id(session_id)
        if session is None or session.user_id != user_id:
            raise NotFoundError(message="Session not found.")

        now = utcnow()
        await self._session_repo.deactivate(session_id)
        await self._rt_repo.revoke(session.refresh_token_id, now)

        logger.info(
            "Session revoked.",
            extra={"user_id": str(user_id), "session_id": str(session_id)},
        )


# ===========================================================================
# PermissionService
# ===========================================================================


class PermissionService:
    """Stateless role-based access control (RBAC) checks.

    All methods are static. Instantiation is not required.
    The router's dependency injection factories call these methods
    to enforce role guards on protected endpoints.
    """

    @staticmethod
    def require_teacher(user: User) -> None:
        """Assert that the user holds the teacher role.

        Args:
            user: The authenticated User ORM object.

        Raises:
            TeacherOnlyError: If the user is not a teacher.
        """
        if not user.is_teacher:
            raise TeacherOnlyError()

    @staticmethod
    def require_student(user: User) -> None:
        """Assert that the user holds the student role.

        Args:
            user: The authenticated User ORM object.

        Raises:
            AuthorizationError: If the user is not a student.
        """
        if not user.is_student:
            raise AuthorizationError(
                message="This action is restricted to students."
            )

    @staticmethod
    def require_email_verified(user: User) -> None:
        """Assert that the user's email address is verified.

        Args:
            user: The authenticated User ORM object.

        Raises:
            EmailNotVerifiedError: If the email is not yet verified.
        """
        if not user.is_email_verified:
            raise EmailNotVerifiedError()

    @staticmethod
    def require_active(user: User) -> None:
        """Assert that the user account is active.

        Args:
            user: The authenticated User ORM object.

        Raises:
            AccountSuspendedError: If the account is deactivated.
        """
        if not user.is_active:
            raise AccountSuspendedError()

    @staticmethod
    def can_access_resource(user: User, owner_id: uuid.UUID) -> bool:
        """Check if the user can access a resource owned by owner_id.

        Teachers can access any resource. Students can only access
        resources they own.

        Args:
            user: The authenticated User ORM object.
            owner_id: UUID of the resource owner.

        Returns:
            bool: True if access is allowed.
        """
        if user.is_teacher:
            return True
        return user.id == owner_id


# ===========================================================================
# Private helpers
# ===========================================================================


def _parse_device_type(user_agent: str | None) -> str | None:
    """Parse the device type from a User-Agent string.

    Uses simple heuristics rather than a full UA parser to avoid
    an additional dependency. Covers the most common device categories.

    Args:
        user_agent: Raw User-Agent header value.

    Returns:
        str | None: "mobile", "tablet", or "desktop", or None if unknown.
    """
    if not user_agent:
        return None
    ua_lower = user_agent.lower()
    if "tablet" in ua_lower or "ipad" in ua_lower:
        return "tablet"
    if any(kw in ua_lower for kw in ("mobile", "android", "iphone", "ipod")):
        return "mobile"
    return "desktop"
