"""Centralized Redis key namespace definitions.

All Redis keys used by the authentication and session modules are defined
here as static methods on ``RedisKeys``. This pattern ensures:

1. No key typos scattered across the codebase.
2. A single audit point for all Redis storage.
3. Easy refactoring of key patterns without grep-hunting.

Key format convention: ``{service}:{category}:{identifier}``

PII policy:
    Email addresses and IP addresses are never stored raw as key
    components. They are passed through SHA-256 before use to prevent
    PII leakage in Redis key listings.
"""

from __future__ import annotations

import hashlib


def _sha256_hex(value: str) -> str:
    """Return the lowercase SHA-256 hex digest of the given string.

    Args:
        value: Raw string (email, IP, etc.).

    Returns:
        str: 64-character hex digest.
    """
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class RedisKeys:
    """Namespace for all Redis key builder functions.

    All methods are static. Instantiation is not needed.
    """

    # ── Access Token Blacklist ────────────────────────────────────────────────

    @staticmethod
    def at_blacklist(jti: str) -> str:
        """Key for a blacklisted access token.

        Set on logout or when a compromised token is detected. TTL is
        set to the remaining lifetime of the access token (max 15 min).

        Args:
            jti: JWT token identifier claim (UUID v4 string).

        Returns:
            str: Redis key string.
        """
        return f"auth:blacklist:{jti}"

    # ── Bulk Session Revocation ───────────────────────────────────────────────

    @staticmethod
    def user_revoked_before(user_id: str) -> str:
        """Key storing a UTC ISO-8601 timestamp.

        Access tokens issued BEFORE this timestamp are rejected, enabling
        instant logout-all without blacklisting every individual JTI.
        TTL: 30 days (max refresh token lifetime).

        Args:
            user_id: User's UUID string.

        Returns:
            str: Redis key string.
        """
        return f"auth:revoked_before:{user_id}"

    # ── Rate Limiting ─────────────────────────────────────────────────────────

    @staticmethod
    def rate_limit_login_ip(ip: str) -> str:
        """Rate limit counter for login attempts from a given IP.

        Args:
            ip: Client IP address string (e.g. "203.0.113.1").

        Returns:
            str: Redis key for the IP-based login counter.
        """
        return f"ratelimit:login_ip:{_sha256_hex(ip)}"

    @staticmethod
    def rate_limit_login_email(email: str) -> str:
        """Rate limit counter for login attempts targeting a specific email.

        Used to detect credential-stuffing attacks against one account
        from rotating IP addresses.

        Args:
            email: User email address (normalized to lowercase before hashing).

        Returns:
            str: Redis key for the email-based login counter.
        """
        return f"ratelimit:login_email:{_sha256_hex(email.lower())}"

    @staticmethod
    def rate_limit_register(ip: str) -> str:
        """Rate limit counter for registration requests from a given IP.

        Args:
            ip: Client IP address string.

        Returns:
            str: Redis key for the registration rate limit counter.
        """
        return f"ratelimit:register:{_sha256_hex(ip)}"

    @staticmethod
    def rate_limit_forgot_password(ip: str) -> str:
        """Rate limit counter for forgot-password requests from a given IP.

        Args:
            ip: Client IP address string.

        Returns:
            str: Redis key for the forgot-password rate limit counter.
        """
        return f"ratelimit:forgot_pw:{_sha256_hex(ip)}"

    @staticmethod
    def rate_limit_resend_verification(user_id: str) -> str:
        """Rate limit counter for resend-verification requests by user.

        Prevents email bombing by enforcing a 5-minute cooldown.

        Args:
            user_id: User's UUID string.

        Returns:
            str: Redis key for the resend rate limit counter.
        """
        return f"ratelimit:resend_verify:{user_id}"

    # ── One-Use Token Cache ───────────────────────────────────────────────────

    @staticmethod
    def email_verify_otp(user_id: str) -> str:
        """Cache key for an email verification token hash.

        Stores the SHA-256 hash of the raw token to avoid a DB lookup
        on every resend check. TTL: 24 hours.

        Args:
            user_id: User's UUID string.

        Returns:
            str: Redis key for the email verification token cache.
        """
        return f"auth:email_verify_otp:{user_id}"

    @staticmethod
    def pwd_reset_otp(email: str) -> str:
        """Cache key for a password reset token hash.

        TTL: 1 hour (matches password_reset_tokens.expires_at).

        Args:
            email: User email address (normalized before hashing).

        Returns:
            str: Redis key for the password reset token cache.
        """
        return f"auth:pwd_reset_otp:{_sha256_hex(email.lower())}"

    # ── Session Cache ─────────────────────────────────────────────────────────

    @staticmethod
    def session_cache(user_id: str) -> str:
        """Cache key for a user's active session list.

        Caches the JSON-serialized list of active sessions to avoid
        a DB query on every ``GET /auth/sessions`` call.
        TTL: 5 minutes (invalidated on any session change).

        Args:
            user_id: User's UUID string.

        Returns:
            str: Redis key for the session list cache.
        """
        return f"auth:session_cache:{user_id}"
