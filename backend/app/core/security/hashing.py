"""Argon2id password hashing.

Implements password hashing using argon2-cffi with OWASP-recommended
parameters for 2024:

    memory_cost  = 65536 (64 MB) - Makes GPU cracking prohibitively expensive.
    time_cost    = 3             - 3 iterations over the memory block.
    parallelism  = 4             - 4 parallel threads.
    hash_len     = 32            - 256-bit output digest.
    salt_len     = 16            - 128-bit random salt per hash.

Why Argon2id over bcrypt/scrypt?
    - Memory-hard: requires 64 MB RAM per verification attempt.
      GPU clusters become cost-ineffective for cracking.
    - Argon2id combines Argon2i (side-channel resistance) and
      Argon2d (GPU resistance).
    - bcrypt has a 72-byte input limit (silently truncates longer passwords).
    - OWASP 2024 ranks Argon2id as the top recommendation.

Security note:
    The _hasher instance is a module-level singleton. PasswordHasher is
    thread-safe — it holds no mutable state between calls.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# ---------------------------------------------------------------------------
# Argon2id hasher — module-level singleton (thread-safe)
# ---------------------------------------------------------------------------

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password with Argon2id.

    A fresh 128-bit random salt is generated for each call, making
    identical passwords produce distinct hashes. The salt is embedded
    in the returned hash string — no separate salt storage is needed.

    Args:
        plain_password: The user's plain-text password. Must not be empty.
            The caller is responsible for enforcing length limits BEFORE
            calling this function to prevent DoS via memory exhaustion.

    Returns:
        str: Argon2id PHC string (hash + params + salt, all in one string).
            Example prefix: ``$argon2id$v=19$m=65536,t=3,p=4$...``
    """
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its Argon2id hash.

    Uses constant-time comparison internally to prevent timing attacks.
    Returns False for ANY failure (mismatch, invalid hash, unknown error)
    to avoid leaking information about the failure reason.

    Args:
        plain_password: The plain-text password submitted by the user.
        hashed_password: The stored Argon2id PHC hash string.

    Returns:
        bool: True if the password matches the hash, False otherwise.
    """
    try:
        return _hasher.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        # Correct hash, wrong password.
        return False
    except VerificationError:
        # Hash is valid Argon2 but verification failed for another reason.
        return False
    except InvalidHashError:
        # The stored value is not a valid Argon2 hash at all.
        return False
    except Exception:  # noqa: BLE001
        # Catch-all: never let an exception from the hasher propagate
        # as it could expose internals. Always return False.
        return False


def password_needs_rehash(hashed_password: str) -> bool:
    """Return True if the hash was produced with outdated parameters.

    Called after a successful ``verify_password`` to transparently upgrade
    stored hashes when the OWASP parameters are tightened. The service
    layer should re-hash and persist the new hash on the next login.

    Args:
        hashed_password: The stored Argon2id PHC hash string.

    Returns:
        bool: True if the hash should be re-computed with current parameters.
    """
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except InvalidHashError:
        # Non-Argon2 hash (e.g. migrating from bcrypt) always needs rehash.
        return True


# Alias for backward compatibility with existing tests
needs_rehash = password_needs_rehash

