"""Security sub-package.

Provides all cryptographic and authentication security primitives used
by the authentication module. No business logic lives here — only
stateless, testable cryptographic operations.

Exports:
    hash_password        : Hash a plain-text password with Argon2id.
    verify_password      : Verify a plain-text password against its hash.
    password_needs_rehash: Check if a stored hash needs upgrading.
    PasswordPolicy       : Password strength and complexity validator.
    PasswordStrength     : Dataclass returned by PasswordPolicy.validate.
    create_access_token  : Sign and encode a JWT access token.
    decode_access_token  : Decode and verify a JWT access token.
    AccessTokenPayload   : Typed dataclass for access token claims.
    generate_raw_token   : Generate a cryptographically secure random token.
    hash_token           : Compute the SHA-256 hash of a raw token.
    generate_otp         : Generate a numeric one-time password.
"""

from app.core.security.hashing import (
    hash_password,
    password_needs_rehash,
    verify_password,
)
from app.core.security.jwt import AccessTokenPayload, create_access_token, decode_access_token
from app.core.security.password_policy import PasswordPolicy, PasswordStrength
from app.core.security.tokens import generate_otp, generate_raw_token, hash_token

__all__ = [
    # Hashing
    "hash_password",
    "verify_password",
    "password_needs_rehash",
    # Password policy
    "PasswordPolicy",
    "PasswordStrength",
    # JWT
    "create_access_token",
    "decode_access_token",
    "AccessTokenPayload",
    # Token generation
    "generate_raw_token",
    "hash_token",
    "generate_otp",
]
