"""Date and time formatting utilities.

Provides human-readable and machine-readable formatting helpers
beyond what the standard library offers. All functions accept and
return timezone-aware datetimes.
"""

from __future__ import annotations

from datetime import datetime

from app.core.utils.timezone import utcnow


def format_iso(dt: datetime) -> str:
    """Format a datetime as an ISO-8601 UTC string with 'Z' suffix.

    Produces a consistent, compact representation suitable for
    JSON API responses.

    Args:
        dt: A timezone-aware datetime (any timezone).

    Returns:
        str: ISO-8601 string in UTC with 'Z' suffix.
            Example: ``"2026-08-05T12:30:00.000000Z"``
    """
    from datetime import timezone
    utc_dt = dt.astimezone(timezone.utc)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def humanize_delta_seconds(seconds: int) -> str:
    """Convert a duration in seconds to a human-readable string.

    Used in error messages (e.g. "Retry after 15 minutes").

    Args:
        seconds: Duration in seconds (non-negative).

    Returns:
        str: Human-readable duration string.
            Examples: ``"45 seconds"``, ``"5 minutes"``, ``"2 hours"``.
    """
    if seconds < 60:
        unit = "second" if seconds == 1 else "seconds"
        return f"{seconds} {unit}"
    if seconds < 3600:
        minutes = seconds // 60
        unit = "minute" if minutes == 1 else "minutes"
        return f"{minutes} {unit}"
    hours = seconds // 3600
    unit = "hour" if hours == 1 else "hours"
    return f"{hours} {unit}"


def time_ago(dt: datetime) -> str:
    """Return a human-readable relative time string for a past datetime.

    Used in session listings to display last-seen times.

    Args:
        dt: A timezone-aware past datetime.

    Returns:
        str: Relative time string.
            Examples: ``"just now"``, ``"5 minutes ago"``, ``"2 days ago"``.
    """
    delta = utcnow() - dt
    total_seconds = int(delta.total_seconds())

    if total_seconds < 60:
        return "just now"
    if total_seconds < 3600:
        minutes = total_seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    if total_seconds < 86400:
        hours = total_seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"

    days = total_seconds // 86400
    return f"{days} day{'s' if days != 1 else ''} ago"
