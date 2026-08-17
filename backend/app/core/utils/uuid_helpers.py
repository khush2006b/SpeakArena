"""UUID generation and validation utilities.

All UUID generation goes through this module to make it easy to swap
the underlying strategy (e.g. migrating from UUID v4 to UUID v7 for
request IDs) without touching call sites.
"""

from __future__ import annotations

import uuid as _uuid_module
from uuid import UUID


def generate_request_id() -> str:
    """Generate a unique request identifier (UUID v4).

    Request IDs use UUID v4 (random) rather than UUID v7 (time-ordered)
because they are not stored in the database and don't benefit from
    monotonic ordering. Randomness prevents predictability.

    Returns:
        str: A lowercase hyphenated UUID v4 string.
            Example: ``"550e8400-e29b-41d4-a716-446655440000"``
    """
    return str(_uuid_module.uuid4())


def generate_token_id() -> str:
    """Generate a unique JWT token identifier (jti claim).

    Used as the ``jti`` claim in access tokens and as the primary key
    for refresh token records before the database assigns a UUIDv7.

    Returns:
        str: A lowercase hyphenated UUID v4 string.
    """
    return str(_uuid_module.uuid4())


def is_valid_uuid(value: str) -> bool:
    """Return True if the string is a valid UUID in any version or variant.

    Used to validate path parameters before passing to repository methods
    to avoid malformed-UUID errors at the database driver level.

    Args:
        value: String to validate.

    Returns:
        bool: True if ``value`` is a valid UUID string.
    """
    try:
        _uuid_module.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def str_to_uuid(value: str) -> UUID:
    """Parse a string into a ``uuid.UUID`` object.

    Args:
        value: UUID string in any standard format.

    Returns:
        UUID: Parsed UUID object.

    Raises:
        ValueError: If ``value`` is not a valid UUID string.
    """
    return _uuid_module.UUID(value)
