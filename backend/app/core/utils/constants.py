"""Platform-wide constant values.

All values that appear in more than one file and are not environment-
configurable belong here. Environment-configurable values live in
``app.config.Settings``.

Naming convention:
    UPPER_SNAKE_CASE for all constants.
    Group related constants together.
    Add a comment above each group.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Cookie names
# ---------------------------------------------------------------------------

# Name of the HttpOnly cookie carrying the raw refresh token.
COOKIE_REFRESH_TOKEN = "refresh_token"

# ---------------------------------------------------------------------------
# Cookie path
# ---------------------------------------------------------------------------

# Restrict the refresh token cookie to the token refresh endpoint only.
# This means the browser will NEVER send the cookie to any other path,
# limiting the blast radius if another endpoint is compromised.
COOKIE_REFRESH_TOKEN_PATH = "/api/v1/auth/refresh"

# ---------------------------------------------------------------------------
# JWT claims
# ---------------------------------------------------------------------------

# Expected issuer claim in all JWTs.
JWT_ISSUER = "speakarena.com"

# Expected audience claim in all JWTs.
JWT_AUDIENCE = "speakarena-api"

# ---------------------------------------------------------------------------
# Token expiry (in seconds, for Redis TTL calculations)
# ---------------------------------------------------------------------------

# Access token maximum lifetime.
ACCESS_TOKEN_MAX_TTL_SECONDS = 900  # 15 minutes

# Standard (non-remember-me) refresh token lifetime.
REFRESH_TOKEN_STANDARD_TTL_SECONDS = 86_400  # 24 hours

# Remember-me refresh token lifetime.
REFRESH_TOKEN_REMEMBER_ME_TTL_SECONDS = 2_592_000  # 30 days

# Password reset token lifetime.
PWD_RESET_TOKEN_TTL_SECONDS = 3_600  # 1 hour

# Email verification token lifetime.
EMAIL_VERIFY_TOKEN_TTL_SECONDS = 86_400  # 24 hours

# ---------------------------------------------------------------------------
# Rate limiting (used by Redis operations)
# ---------------------------------------------------------------------------

# Login rate limit — sliding window in seconds.
RATE_LIMIT_LOGIN_WINDOW_SECONDS = 60  # 1 minute

# Per-email lockout window.
RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS = 900  # 15 minutes

# Registration rate limit window.
RATE_LIMIT_REGISTER_WINDOW_SECONDS = 3_600  # 1 hour

# Forgot-password rate limit window.
RATE_LIMIT_FORGOT_PW_WINDOW_SECONDS = 3_600  # 1 hour

# Resend-verification cooldown.
RATE_LIMIT_RESEND_VERIFY_WINDOW_SECONDS = 300  # 5 minutes

# ---------------------------------------------------------------------------
# Brute force protection
# ---------------------------------------------------------------------------

# Number of consecutive failed logins before account lockout.
MAX_FAILED_LOGIN_ATTEMPTS = 5

# Account lockout duration in minutes.
ACCOUNT_LOCKOUT_MINUTES = 15

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

# Default number of items per page.
DEFAULT_PAGE_SIZE = 20

# Maximum allowed items per page.
MAX_PAGE_SIZE = 100

# ---------------------------------------------------------------------------
# File uploads
# ---------------------------------------------------------------------------

# Maximum avatar file size (5 MB).
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

# Allowed avatar MIME types.
ALLOWED_AVATAR_MIME_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)

# Maximum video file size (4 GB).
MAX_VIDEO_SIZE_BYTES = 4 * 1024 * 1024 * 1024

# Maximum PDF file size (50 MB).
MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024
