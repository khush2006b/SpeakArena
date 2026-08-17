"""Authentication module repositories.

Provides all database access for authentication-related entities.
Follows the Repository Pattern: all SQL lives here, no business logic.

Repositories:
    UserRepository              : CRUD and lookups for the users table.
    TeacherProfileRepository    : CRUD for teacher_profiles.
    StudentProfileRepository    : CRUD for student_profiles.
    RefreshTokenRepository      : Manage refresh token lifecycle.
    UserSessionRepository       : Manage user session lifecycle.
    PasswordResetTokenRepository: Manage password reset tokens.
    EmailVerificationRepository : Manage email verification tokens.

Design principles:
    - Every repository takes AsyncSession as its constructor argument.
    - Methods are typed with precise return types (no Any).
    - Methods return ORM objects or None — never dicts or primitives
      (except for aggregate queries like counts).
    - No business logic: pure SQL/ORM operations only.
    - All queries respect soft-delete (deleted_at IS NULL on users).
    - Bulk operations use SQLAlchemy Core for performance.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    UserSession,
)
from app.models.user import StudentProfile, TeacherProfile, User


# ===========================================================================
# UserRepository
# ===========================================================================


class UserRepository:
    """Database access layer for the users table.

    Attributes:
        _session: The async SQLAlchemy session bound to the current
            request. Never share sessions across requests.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        email: str,
        hashed_password: str,
        full_name: str,
        role: str,
        phone: str | None = None,
    ) -> User:
        """Create and persist a new user record.

        Args:
            email: User's email address. Must be unique (enforced by DB).
            hashed_password: Argon2id PHC hash string.
            full_name: User's display name.
            role: Role string ("teacher" or "student").
            phone: Optional E.164 phone number.

        Returns:
            User: The persisted ORM object with database-generated id/timestamps.
        """
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            phone=phone,
        )
        self._session.add(user)
        await self._session.flush()  # Populate id without committing.
        await self._session.refresh(user)
        return user

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Fetch a user by primary key.

        Excludes soft-deleted users.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            User | None: The user record, or None if not found or deleted.
        """
        stmt = select(User).where(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Fetch a user by email address (case-insensitive).

        The LOWER() comparison matches the partial index created in the
        initial migration for case-insensitive email uniqueness.

        Excludes soft-deleted users.

        Args:
            email: The email address to look up.

        Returns:
            User | None: The user record, or None if not found.
        """
        stmt = select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def exists_by_email(self, email: str) -> bool:
        """Check if a user exists with the given email (case-insensitive).

        More efficient than get_by_email for uniqueness checks — returns
        as soon as any match is found without loading the full row.

        Args:
            email: The email address to check.

        Returns:
            bool: True if an active user with this email exists.
        """
        stmt = select(func.count()).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        ).select_from(User)
        result = await self._session.execute(stmt)
        return (result.scalar_one() or 0) > 0

    async def update_password(self, user_id: uuid.UUID, hashed_password: str) -> None:
        """Update the stored password hash for a user.

        Called by the password reset and change-password flows.

        Args:
            user_id: The user's UUID primary key.
            hashed_password: New Argon2id PHC hash string.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(hashed_password=hashed_password)
        )
        await self._session.execute(stmt)

    async def set_email_verified(self, user_id: uuid.UUID) -> None:
        """Mark a user's email address as verified.

        Args:
            user_id: The user's UUID primary key.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(is_email_verified=True)
        )
        await self._session.execute(stmt)

    async def update_last_login(
        self, user_id: uuid.UUID, last_login_at: datetime
    ) -> None:
        """Update the last login timestamp and reset failed login counter.

        Called immediately after successful credential verification.

        Args:
            user_id: The user's UUID primary key.
            last_login_at: Timezone-aware UTC datetime of the login.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(
                last_login_at=last_login_at,
                failed_login_count=0,
                locked_until=None,
            )
        )
        await self._session.execute(stmt)

    async def increment_failed_login(
        self, user_id: uuid.UUID
    ) -> int:
        """Increment the failed login counter and return the new count.

        Uses a server-side increment to avoid read-modify-write races.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            int: The new failed_login_count value after incrementing.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(failed_login_count=User.failed_login_count + 1)
            .returning(User.failed_login_count)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def lock_account(
        self, user_id: uuid.UUID, locked_until: datetime
    ) -> None:
        """Temporarily lock a user account until a specified datetime.

        Called by the login service after the brute-force threshold is
        exceeded. The lock is cleared automatically when the service
        checks locked_until on the next login attempt.

        Args:
            user_id: The user's UUID primary key.
            locked_until: Timezone-aware UTC datetime when the lock expires.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(locked_until=locked_until)
        )
        await self._session.execute(stmt)

    async def soft_delete(self, user_id: uuid.UUID, deleted_at: datetime) -> None:
        """Soft-delete a user by setting deleted_at.

        The user record is not physically removed from the database to
        preserve referential integrity and support GDPR export requests.

        Args:
            user_id: The user's UUID primary key.
            deleted_at: Timezone-aware UTC datetime of deletion.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(deleted_at=deleted_at, is_active=False)
        )
        await self._session.execute(stmt)

    async def set_active(
        self, user_id: uuid.UUID, *, is_active: bool
    ) -> None:
        """Enable or suspend a user account.

        Args:
            user_id: The user's UUID primary key.
            is_active: True to activate, False to suspend.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(is_active=is_active)
        )
        await self._session.execute(stmt)

    async def update_avatar(
        self, user_id: uuid.UUID, avatar_r2_key: str | None
    ) -> None:
        """Update or clear the user's avatar R2 object key.

        Args:
            user_id: The user's UUID primary key.
            avatar_r2_key: The new R2 object key, or None to clear.
        """
        stmt = (
            update(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .values(avatar_r2_key=avatar_r2_key)
        )
        await self._session.execute(stmt)

    async def get_all_paginated(
        self, *, page: int, page_size: int
    ) -> tuple[list[User], int]:
        """Fetch a page of active users with total count.

        Args:
            page: 1-indexed page number.
            page_size: Number of records per page.

        Returns:
            tuple[list[User], int]: Active users for the page and total count.
        """
        offset = (page - 1) * page_size

        count_stmt = (
            select(func.count())
            .where(User.deleted_at.is_(None))
            .select_from(User)
        )
        total: int = (await self._session.execute(count_stmt)).scalar_one()

        rows_stmt = (
            select(User)
            .where(User.deleted_at.is_(None))
            .order_by(User.created_at.desc())
            .limit(page_size)
            .offset(offset)
        )
        result = await self._session.execute(rows_stmt)
        users = list(result.scalars().all())

        return users, total


# ===========================================================================
# TeacherProfileRepository
# ===========================================================================


class TeacherProfileRepository:
    """Database access layer for the teacher_profiles table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        bio: str | None = None,
        headline: str | None = None,
    ) -> TeacherProfile:
        """Create a teacher profile record.

        Args:
            user_id: FK to users.id.
            bio: Optional biography text.
            headline: Optional short profile headline.

        Returns:
            TeacherProfile: The persisted profile record.
        """
        profile = TeacherProfile(
            user_id=user_id,
            bio=bio,
            headline=headline,
        )
        self._session.add(profile)
        await self._session.flush()
        await self._session.refresh(profile)
        return profile

    async def get_by_user_id(
        self, user_id: uuid.UUID
    ) -> TeacherProfile | None:
        """Fetch the teacher profile for a given user.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            TeacherProfile | None: The profile, or None if not found.
        """
        stmt = select(TeacherProfile).where(
            TeacherProfile.user_id == user_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update(
        self,
        user_id: uuid.UUID,
        updates: dict[str, Any],
    ) -> None:
        """Update specific fields of a teacher profile.

        Args:
            user_id: The user's UUID primary key.
            updates: Dict of column names to new values.
        """
        stmt = (
            update(TeacherProfile)
            .where(TeacherProfile.user_id == user_id)
            .values(**updates)
        )
        await self._session.execute(stmt)


# ===========================================================================
# StudentProfileRepository
# ===========================================================================


class StudentProfileRepository:
    """Database access layer for the student_profiles table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(self, *, user_id: uuid.UUID) -> StudentProfile:
        """Create a student profile record with default values.

        Args:
            user_id: FK to users.id.

        Returns:
            StudentProfile: The persisted profile record.
        """
        profile = StudentProfile(user_id=user_id)
        self._session.add(profile)
        await self._session.flush()
        await self._session.refresh(profile)
        return profile

    async def get_by_user_id(
        self, user_id: uuid.UUID
    ) -> StudentProfile | None:
        """Fetch the student profile for a given user.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            StudentProfile | None: The profile, or None if not found.
        """
        stmt = select(StudentProfile).where(
            StudentProfile.user_id == user_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update(
        self,
        user_id: uuid.UUID,
        updates: dict[str, Any],
    ) -> None:
        """Update specific fields of a student profile.

        Args:
            user_id: The user's UUID primary key.
            updates: Dict of column names to new values.
        """
        stmt = (
            update(StudentProfile)
            .where(StudentProfile.user_id == user_id)
            .values(**updates)
        )
        await self._session.execute(stmt)


# ===========================================================================
# RefreshTokenRepository
# ===========================================================================


class RefreshTokenRepository:
    """Database access layer for the refresh_tokens table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        ip_address: str | None = None,
        user_agent: str | None = None,
        device_fingerprint: str | None = None,
    ) -> RefreshToken:
        """Persist a new refresh token record.

        Only the SHA-256 hash of the raw token is stored.

        Args:
            user_id: FK to users.id.
            token_hash: SHA-256 hex digest of the raw refresh token.
            expires_at: Timezone-aware UTC expiry datetime.
            ip_address: Client IP address string (optional).
            user_agent: Raw User-Agent header value (optional).
            device_fingerprint: Parsed device description (optional).

        Returns:
            RefreshToken: The persisted token record.
        """
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
        )
        self._session.add(token)
        await self._session.flush()
        await self._session.refresh(token)
        return token

    async def get_by_hash(
        self, token_hash: str
    ) -> RefreshToken | None:
        """Look up a refresh token record by its SHA-256 hash.

        This is the primary lookup path on every /auth/refresh request.

        Args:
            token_hash: SHA-256 hex digest of the raw token.

        Returns:
            RefreshToken | None: The token record, or None if not found.
        """
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke(
        self, token_id: uuid.UUID, revoked_at: datetime
    ) -> None:
        """Mark a single refresh token as revoked.

        Args:
            token_id: The refresh token's UUID primary key.
            revoked_at: Timezone-aware UTC datetime of revocation.
        """
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.id == token_id)
            .values(revoked_at=revoked_at)
        )
        await self._session.execute(stmt)

    async def revoke_and_link(
        self,
        token_id: uuid.UUID,
        *,
        revoked_at: datetime,
        replaced_by: uuid.UUID,
    ) -> None:
        """Revoke a token and record which token replaced it.

        Used during refresh token rotation to maintain the rotation chain
        for reuse detection.

        Args:
            token_id: The refresh token UUID to revoke.
            revoked_at: Timezone-aware UTC datetime of revocation.
            replaced_by: UUID of the new token that replaced this one.
        """
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.id == token_id)
            .values(revoked_at=revoked_at, replaced_by=replaced_by)
        )
        await self._session.execute(stmt)

    async def revoke_all_for_user(
        self, user_id: uuid.UUID, revoked_at: datetime
    ) -> int:
        """Revoke all active refresh tokens for a user (logout-all).

        Args:
            user_id: The user's UUID primary key.
            revoked_at: Timezone-aware UTC datetime of bulk revocation.

        Returns:
            int: Number of tokens that were revoked.
        """
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at)
            .returning(RefreshToken.id)
        )
        result = await self._session.execute(stmt)
        return len(result.fetchall())

    async def get_active_for_user(
        self, user_id: uuid.UUID
    ) -> list[RefreshToken]:
        """Fetch all non-revoked, non-expired tokens for a user.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            list[RefreshToken]: Active token records.
        """
        from app.core.utils.timezone import utcnow
        now = utcnow()
        stmt = select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


# ===========================================================================
# UserSessionRepository
# ===========================================================================


class UserSessionRepository:
    """Database access layer for the user_sessions table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        refresh_token_id: uuid.UUID,
        ip_address: str | None = None,
        user_agent: str | None = None,
        device_type: str | None = None,
        country: str | None = None,
    ) -> UserSession:
        """Create a new session record linked to a refresh token.

        Args:
            user_id: FK to users.id.
            refresh_token_id: FK to refresh_tokens.id.
            ip_address: Client IP address string.
            user_agent: Raw User-Agent header value.
            device_type: Parsed device type ("desktop", "mobile", "tablet").
            country: ISO 3166-1 alpha-2 country code.

        Returns:
            UserSession: The persisted session record.
        """
        session_record = UserSession(
            user_id=user_id,
            refresh_token_id=refresh_token_id,
            ip_address=ip_address,
            user_agent=user_agent,
            device_type=device_type,
            country=country,
        )
        self._session.add(session_record)
        await self._session.flush()
        await self._session.refresh(session_record)
        return session_record

    async def get_by_id(
        self, session_id: uuid.UUID
    ) -> UserSession | None:
        """Fetch a session by primary key.

        Args:
            session_id: The session's UUID primary key.

        Returns:
            UserSession | None: The session record, or None if not found.
        """
        stmt = select(UserSession).where(UserSession.id == session_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_for_user(
        self, user_id: uuid.UUID
    ) -> list[UserSession]:
        """Fetch all active sessions for a user, newest first.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            list[UserSession]: Active session records ordered by last_seen_at desc.
        """
        stmt = (
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_active.is_(True),
            )
            .order_by(UserSession.last_seen_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def deactivate(
        self, session_id: uuid.UUID
    ) -> None:
        """Mark a single session as inactive.

        Args:
            session_id: The session's UUID primary key.
        """
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(is_active=False)
        )
        await self._session.execute(stmt)

    async def deactivate_all_for_user(
        self, user_id: uuid.UUID
    ) -> int:
        """Deactivate all active sessions for a user (logout-all).

        Args:
            user_id: The user's UUID primary key.

        Returns:
            int: Number of sessions that were deactivated.
        """
        stmt = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_active.is_(True),
            )
            .values(is_active=False)
            .returning(UserSession.id)
        )
        result = await self._session.execute(stmt)
        return len(result.fetchall())

    async def update_last_seen(
        self, session_id: uuid.UUID, last_seen_at: datetime
    ) -> None:
        """Update the last_seen_at timestamp for a session.

        Called on every successful /auth/refresh call to keep session
        activity timestamps current.

        Args:
            session_id: The session's UUID primary key.
            last_seen_at: Timezone-aware UTC datetime.
        """
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(last_seen_at=last_seen_at)
        )
        await self._session.execute(stmt)


# ===========================================================================
# PasswordResetTokenRepository
# ===========================================================================


class PasswordResetTokenRepository:
    """Database access layer for the password_reset_tokens table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> PasswordResetToken:
        """Persist a new password reset token.

        Args:
            user_id: FK to users.id.
            token_hash: SHA-256 hex digest of the raw token.
            expires_at: Timezone-aware UTC expiry datetime.

        Returns:
            PasswordResetToken: The persisted token record.
        """
        token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self._session.add(token)
        await self._session.flush()
        await self._session.refresh(token)
        return token

    async def get_by_hash(
        self, token_hash: str
    ) -> PasswordResetToken | None:
        """Look up a password reset token by its SHA-256 hash.

        Args:
            token_hash: SHA-256 hex digest of the raw token.

        Returns:
            PasswordResetToken | None: The token record, or None if not found.
        """
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_used(
        self, token_id: uuid.UUID, used_at: datetime
    ) -> None:
        """Mark a password reset token as consumed.

        Called atomically with the password hash update to ensure
        tokens cannot be reused on concurrent requests.

        Args:
            token_id: The token's UUID primary key.
            used_at: Timezone-aware UTC datetime of use.
        """
        stmt = (
            update(PasswordResetToken)
            .where(PasswordResetToken.id == token_id)
            .values(used_at=used_at)
        )
        await self._session.execute(stmt)

    async def invalidate_all_for_user(self, user_id: uuid.UUID) -> None:
        """Mark all unused reset tokens for a user as instantly expired.

        Called when a new password reset is requested to prevent multiple
        valid reset links from existing simultaneously.

        Args:
            user_id: The user's UUID primary key.
        """
        from app.core.utils.timezone import utcnow
        stmt = (
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=utcnow())
        )
        await self._session.execute(stmt)


# ===========================================================================
# EmailVerificationRepository
# ===========================================================================


class EmailVerificationRepository:
    """Database access layer for the email_verification_tokens table."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the repository with a database session.

        Args:
            session: The async SQLAlchemy session for this request.
        """
        self._session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        new_email: str | None = None,
    ) -> EmailVerificationToken:
        """Persist a new email verification token.

        Args:
            user_id: FK to users.id.
            token_hash: SHA-256 hex digest of the raw token.
            expires_at: Timezone-aware UTC expiry datetime.
            new_email: Populated only during the email-change flow.

        Returns:
            EmailVerificationToken: The persisted token record.
        """
        token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            new_email=new_email,
        )
        self._session.add(token)
        await self._session.flush()
        await self._session.refresh(token)
        return token

    async def get_by_hash(
        self, token_hash: str
    ) -> EmailVerificationToken | None:
        """Look up a verification token by its SHA-256 hash.

        Args:
            token_hash: SHA-256 hex digest of the raw token.

        Returns:
            EmailVerificationToken | None: Token record, or None if not found.
        """
        stmt = select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_used(
        self, token_id: uuid.UUID, used_at: datetime
    ) -> None:
        """Mark a verification token as consumed.

        Args:
            token_id: The token's UUID primary key.
            used_at: Timezone-aware UTC datetime of use.
        """
        stmt = (
            update(EmailVerificationToken)
            .where(EmailVerificationToken.id == token_id)
            .values(used_at=used_at)
        )
        await self._session.execute(stmt)

    async def get_latest_unused_for_user(
        self, user_id: uuid.UUID
    ) -> EmailVerificationToken | None:
        """Fetch the most recent unused, non-expired verification token.

        Used by the resend-verification flow to check if a recent token
        already exists before issuing a new one.

        Args:
            user_id: The user's UUID primary key.

        Returns:
            EmailVerificationToken | None: Latest valid token, or None.
        """
        from app.core.utils.timezone import utcnow
        now = utcnow()
        stmt = (
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.used_at.is_(None),
                EmailVerificationToken.expires_at > now,
            )
            .order_by(EmailVerificationToken.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def invalidate_all_for_user(self, user_id: uuid.UUID) -> None:
        """Invalidate all unused verification tokens for a user.

        Called before creating a new verification token to ensure only
        one valid token exists per user at a time.

        Args:
            user_id: The user's UUID primary key.
        """
        from app.core.utils.timezone import utcnow
        stmt = (
            update(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.used_at.is_(None),
            )
            .values(used_at=utcnow())
        )
        await self._session.execute(stmt)
