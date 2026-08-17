"""JWT access token creation and verification.

Only ACCESS tokens are JWTs. Refresh tokens are raw cryptographic
random strings stored as SHA-256 hashes in the database (see tokens.py).

Access Token Payload (claims):
    sub        : User UUID string (primary key).
    role       : "teacher" or "student" (embedded to avoid DB hit per request).
    session_id : UUID of the UserSession record (for logout-single-device).
    jti        : Unique token ID (UUID v4). Used as Redis blacklist key.
    iat        : Issued-at Unix timestamp.
    exp        : Expiry Unix timestamp (iat + 15 minutes).
    iss        : Issuer — "speakarena.com".
    aud        : Audience — "speakarena-api".

Why HS256?
    This platform has a single backend service. Symmetric signing
    (HS256) is simpler and equally secure at this scale. RS256 should
    be adopted when independent microservices need to verify tokens
    without sharing a secret key.

Key rotation:
    JWT_SECRET_KEY is loaded from environment variables. Rotate it by:
    1. Setting a new key in production.
    2. All existing access tokens expire within 15 minutes naturally.
    3. All refresh tokens will require a new login (they reference the
       old session which is still valid in the DB).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone

from jose import ExpiredSignatureError, JWTError, jwt

from app.config import settings
from app.core.exceptions.errors import TokenExpiredError, TokenRevokedError
from app.core.utils.constants import (
    ACCESS_TOKEN_MAX_TTL_SECONDS,
    JWT_AUDIENCE,
    JWT_ISSUER,
)
from app.core.utils.timezone import utcnow
from app.core.utils.uuid_helpers import generate_token_id


@dataclass(frozen=True)
class AccessTokenPayload:
    """Typed representation of a decoded JWT access token payload.

    Attributes:
        sub: User UUID string (maps to users.id).
        role: User role string ("teacher" or "student").
        session_id: UUID string of the associated UserSession record.
        jti: Unique token identifier. Used as the Redis blacklist key on logout.
        iat: Unix timestamp when the token was issued.
        exp: Unix timestamp when the token expires.
        iss: Issuer claim (must equal JWT_ISSUER).
        aud: Audience claim (must equal JWT_AUDIENCE).
    """

    sub: str
    role: str
    session_id: str
    jti: str
    iat: int
    exp: int
    iss: str
    aud: str


def create_access_token(
    *,
    user_id: str,
    role: str,
    session_id: str,
    jti: str | None = None,
    expires_in_seconds: int = ACCESS_TOKEN_MAX_TTL_SECONDS,
) -> tuple[str, AccessTokenPayload]:
    """Create and sign a JWT access token.

    Generates a new JTI if none is provided. The payload is both
    returned as a typed dataclass and encoded into the signed JWT
    string so callers don't need to decode the token they just created.

    Args:
        user_id: The user's UUID string (becomes the ``sub`` claim).
        role: The user's role string ("teacher" or "student").
        session_id: The UUID string of the linked UserSession record.
        jti: Optional pre-generated token ID. If None, a UUID v4 is
            generated automatically.
        expires_in_seconds: Token lifetime in seconds. Defaults to
            ``ACCESS_TOKEN_MAX_TTL_SECONDS`` (15 minutes).

    Returns:
        tuple[str, AccessTokenPayload]: The signed JWT string and
            the typed payload dataclass.
    """
    now = utcnow()
    iat = int(now.timestamp())
    exp = iat + expires_in_seconds
    token_jti = jti or generate_token_id()

    payload: dict[str, str | int] = {
        "sub": user_id,
        "role": role,
        "session_id": session_id,
        "jti": token_jti,
        "iat": iat,
        "exp": exp,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    typed_payload = AccessTokenPayload(
        sub=user_id,
        role=role,
        session_id=session_id,
        jti=token_jti,
        iat=iat,
        exp=exp,
        iss=JWT_ISSUER,
        aud=JWT_AUDIENCE,
    )

    return token, typed_payload


def decode_access_token(token: str) -> AccessTokenPayload:
    """Decode and verify a JWT access token.

    Validates:
        - Cryptographic signature (using JWT_SECRET_KEY).
        - Token expiry (exp claim).
        - Issuer claim (iss must equal JWT_ISSUER).
        - Audience claim (aud must equal JWT_AUDIENCE).

    Does NOT check the Redis blacklist — that is done by the
    ``get_current_user`` dependency after decoding.

    Args:
        token: The raw JWT string from the Authorization header.

    Returns:
        AccessTokenPayload: Typed, validated token payload.

    Raises:
        TokenExpiredError: If the token's exp claim is in the past.
        TokenRevokedError: If the token's signature or claims are invalid.
    """
    try:
        raw_payload: dict = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"verify_exp": True},
        )
    except ExpiredSignatureError:
        raise TokenExpiredError()
    except JWTError:
        # Covers: invalid signature, missing claims, wrong issuer/audience.
        raise TokenRevokedError(
            message="Access token is invalid. Please log in again."
        )

    # All required claims must be present.
    required_claims = {"sub", "role", "session_id", "jti", "iat", "exp", "iss", "aud"}
    missing = required_claims - raw_payload.keys()
    if missing:
        raise TokenRevokedError(
            message=f"Access token is missing required claims: {missing}."
        )

    return AccessTokenPayload(
        sub=raw_payload["sub"],
        role=raw_payload["role"],
        session_id=raw_payload["session_id"],
        jti=raw_payload["jti"],
        iat=raw_payload["iat"],
        exp=raw_payload["exp"],
        iss=raw_payload["iss"],
        aud=raw_payload["aud"],
    )


def get_token_remaining_seconds(payload: AccessTokenPayload) -> int:
    """Return the remaining lifetime of an access token in seconds.

    Used to set the Redis TTL when blacklisting a token on logout.
    Returns 0 (not a negative number) if the token has already expired.

    Args:
        payload: The decoded access token payload.

    Returns:
        int: Remaining seconds. Minimum 0.
    """
    from app.core.utils.timezone import utcnow as _utcnow
    now_ts = int(_utcnow().timestamp())
    return max(0, payload.exp - now_ts)
