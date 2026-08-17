"""Authentication support models.

RefreshToken  : Hashed JWT refresh tokens with rotation chain.
UserSession   : Active login sessions for device management.
PasswordResetToken    : One-use password recovery tokens.
EmailVerificationToken: Email address verification tokens.

Security principle: raw tokens are NEVER stored. Only SHA-256
hashes are persisted. The raw token is sent to the client once.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import INET, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    """Hashed JWT refresh token record.

    Only the SHA-256 hash of the raw token is stored. The raw token
    is issued to the client once and never re-stored. Token rotation
    is tracked via the replaced_by self-referential FK, enabling
    detection of token reuse attacks (one token in the chain revoked
    => entire chain revoked).

    Expiry is enforced by checking expires_at in the auth service
    before issuing a new access token.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        comment="SHA-256 hex digest of the raw refresh token.",
    )
    device_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        INET, nullable=True, default=None
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    issued_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    replaced_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="FK to the successor token in the rotation chain.",
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")

    @property
    def is_active(self) -> bool:
        """Return True if the token is valid (not revoked and not expired).

        Returns:
            bool: True when the token can be used to issue an access token.
        """
        return (
            self.revoked_at is None
            and self.expires_at > datetime.now(timezone.utc)
        )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<RefreshToken id={self.id} user_id={self.user_id} active={self.is_active}>"


class UserSession(UUIDPrimaryKeyMixin, Base):
    """Active login session record linked to a refresh token.

    Created on every successful login alongside the refresh token.
    Enables the 'All Active Sessions' page and 'Log Out All Devices'.
    last_seen_at is updated on every API call via middleware.
    """

    __tablename__ = "user_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    refresh_token_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("refresh_tokens.id", ondelete="CASCADE"),
        nullable=False,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        INET, nullable=True, default=None
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    device_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default=None,
        comment="desktop | mobile | tablet",
    )
    country: Mapped[Optional[str]] = mapped_column(
        String(2),
        nullable=True,
        default=None,
        comment="ISO 3166-1 alpha-2 country code.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<UserSession id={self.id} user_id={self.user_id} active={self.is_active}>"


class PasswordResetToken(UUIDPrimaryKeyMixin, Base):
    """One-use password recovery token.

    Stores only the SHA-256 hash of the raw token emailed to the user.
    Expires 1 hour after creation. is_valid property gates all usage.
    used_at is set atomically with the password hash update.
    """

    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User")

    @property
    def is_valid(self) -> bool:
        """Return True when the token is unused and has not expired.

        Returns:
            bool: True when the token can be used to reset the password.
        """
        return (
            self.used_at is None
            and self.expires_at > datetime.now(timezone.utc)
        )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<PasswordResetToken id={self.id} user_id={self.user_id}>"


class EmailVerificationToken(UUIDPrimaryKeyMixin, Base):
    """Email address ownership verification token.

    Used on registration (verify primary email) and on email change
    (verify the new address before swapping). The new_email column
    is only populated during the email-change flow; it is NULL for
    initial registration verification.
    """

    __tablename__ = "email_verification_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    new_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Populated only during the email-change flow.",
    )
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    user: Mapped[User] = relationship("User")

    @property
    def is_valid(self) -> bool:
        """Return True when the token is unused and has not expired.

        Returns:
            bool: True when the token can be used to verify an email.
        """
        return (
            self.used_at is None
            and self.expires_at > datetime.now(timezone.utc)
        )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<EmailVerificationToken id={self.id} user_id={self.user_id}>"
