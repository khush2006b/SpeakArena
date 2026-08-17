"""Timezone-aware datetime utilities.

All datetimes in this application are UTC and timezone-aware.
Naive datetimes (those without tzinfo) are NEVER used — they are
ambiguous and cause subtle bugs when stored in PostgreSQL TIMESTAMPTZ
columns and compared against ``NOW()``.

Rule: Every datetime created by application code must be created via
functions in this module or by ``datetime.now(timezone.utc)``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def utcnow() -> datetime:
    """Return the current UTC time as a timezone-aware datetime.

    Prefer this function over ``datetime.utcnow()`` (which returns a naive
    datetime) and ``datetime.now()`` (which returns local time).

    Returns:
        datetime: Current UTC time with ``tzinfo=timezone.utc``.
    """
    return datetime.now(timezone.utc)


def utcfromtimestamp(timestamp: float) -> datetime:
    """Convert a Unix timestamp to a timezone-aware UTC datetime.

    Args:
        timestamp: Unix timestamp (seconds since epoch).

    Returns:
        datetime: Timezone-aware UTC datetime.
    """
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def utcfromiso(iso_string: str) -> datetime:
    """Parse an ISO-8601 string into a timezone-aware UTC datetime.

    Accepts both offset-aware strings (e.g. ``2026-08-05T12:00:00+05:30``)
    and UTC strings with 'Z' suffix (e.g. ``2026-08-05T12:00:00Z``).

    Args:
        iso_string: ISO-8601 formatted datetime string.

    Returns:
        datetime: Timezone-aware UTC datetime.

    Raises:
        ValueError: If the string cannot be parsed.
    """
    # Python 3.11+ supports 'Z' suffix natively in fromisoformat.
    dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc)


def add_seconds(dt: datetime, seconds: int) -> datetime:
    """Return a new datetime ``seconds`` seconds in the future.

    Args:
        dt: Base timezone-aware datetime.
        seconds: Number of seconds to add.

    Returns:
        datetime: New timezone-aware datetime.
    """
    return dt + timedelta(seconds=seconds)


def seconds_until(dt: datetime) -> int:
    """Return the number of whole seconds until a future datetime.

    Used to compute Redis TTL values from absolute expiry datetimes.
    Returns 0 if ``dt`` is in the past.

    Args:
        dt: Target timezone-aware UTC datetime.

    Returns:
        int: Seconds remaining until ``dt``. Minimum 0.
    """
    remaining = (dt - utcnow()).total_seconds()
    return max(0, int(remaining))


def is_past(dt: datetime) -> bool:
    """Return True if the given datetime is in the past.

    Args:
        dt: A timezone-aware datetime to check.

    Returns:
        bool: True if ``dt`` < current UTC time.
    """
    return dt < utcnow()
