"""Google Meet provider implementation.

Implements the ``MeetingProvider`` interface for Google Meet.

Google Meet URL formats supported:
    https://meet.google.com/abc-defg-hij          (standard)
    https://meet.google.com/lookup/abc-defg-hij   (lookup format)
    http://meet.google.com/abc-defg-hij           (HTTP — normalized to HTTPS)
    https://meet.google.com/abc-defg-hij?authuser=0  (query stripped)

All formats are normalized to:
    https://meet.google.com/<room-code>

The room code pattern: three groups of lowercase letters separated by hyphens.
    - Group 1: 3 letters
    - Group 2: 4 letters
    - Group 3: 3 letters
    Total: abc-defg-hij
"""

from __future__ import annotations

import re
import uuid
from typing import Any
from urllib.parse import urlparse

from app.core.exceptions.errors import InvalidMeetingLinkError
from app.modules.meeting.providers.base import MeetingProvider

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_GOOGLE_MEET_HOST = "meet.google.com"

# Matches the canonical room code: abc-defg-hij
_ROOM_CODE_PATTERN = re.compile(r"^[a-z]{3}-[a-z]{4}-[a-z]{3}$")

# Matches the room code anywhere in the path (handles /lookup/ prefix)
_PATH_ROOM_CODE_PATTERN = re.compile(r"([a-z]{3}-[a-z]{4}-[a-z]{3})")


class GoogleMeetProvider(MeetingProvider):
    """Google Meet implementation of the MeetingProvider interface.

    Stateless. All methods are pure functions of their arguments.
    No network calls are made — Google Meet link management is entirely
    URL-based; actual meeting state is managed by Google.
    """

    @property
    def provider_name(self) -> str:
        """Return the canonical provider identifier.

        Returns:
            str: Always ``'google_meet'``.
        """
        return "google_meet"

    def validate_link(self, url: str) -> None:
        """Validate the URL is a properly formatted Google Meet link.

        Checks:
            1. URL is parseable.
            2. Host is ``meet.google.com``.
            3. Path contains a valid room code (``abc-defg-hij`` format).

        Args:
            url: The raw meeting URL submitted by the teacher.

        Raises:
            InvalidMeetingLinkError: If any validation check fails.
        """
        if not url or not isinstance(url, str):
            raise InvalidMeetingLinkError()

        url = url.strip()

        try:
            parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        except Exception:
            raise InvalidMeetingLinkError(
                message="Could not parse the provided meeting URL."
            )

        if parsed.hostname != _GOOGLE_MEET_HOST:
            raise InvalidMeetingLinkError(
                message=f"Meeting link must be a Google Meet URL (meet.google.com). Got: {parsed.hostname}"
            )

        # Extract room code from path
        room_code = self._extract_room_code(parsed.path)
        if room_code is None:
            raise InvalidMeetingLinkError(
                message="Could not find a valid Google Meet room code in the URL. "
                        "Expected format: https://meet.google.com/abc-defg-hij"
            )

    def normalize_link(self, url: str) -> str:
        """Normalize a Google Meet URL to its canonical form.

        Normalizes to: ``https://meet.google.com/<room-code>``
        Strips query strings, fragments, and the /lookup/ path prefix.
        Enforces HTTPS.

        Args:
            url: Raw meeting URL (assumed to have already passed ``validate_link``).

        Returns:
            str: Canonical Google Meet URL.
        """
        url = url.strip()
        if not url.startswith("http"):
            url = f"https://{url}"

        parsed = urlparse(url)
        room_code = self._extract_room_code(parsed.path)

        # If no valid room code found, return HTTPS URL as-is (validate_link
        # would have caught this in normal flow)
        if room_code is None:
            return f"https://{_GOOGLE_MEET_HOST}{parsed.path}"

        return f"https://{_GOOGLE_MEET_HOST}/{room_code}"

    def generate_join_response(
        self,
        meet_link: str,
        meeting_id: uuid.UUID,
        user_id: uuid.UUID,
        display_name: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate the secure join response payload for Google Meet.

        For Google Meet, the join URL IS the meet link because Google
        handles all authentication. We return it with structured metadata
        so the frontend can pre-populate the display name prompt.

        The meet_link is ONLY returned through this controlled method,
        which is only called after full verification in AttendanceService.

        Args:
            meet_link: Canonical Google Meet URL from DB.
            meeting_id: UUID of the meeting being joined.
            user_id: UUID of the joining user.
            display_name: User's full name for pre-population.
            metadata: Optional extra context dict.

        Returns:
            dict[str, Any]: Join payload containing:
                - ``provider``: ``'google_meet'``
                - ``join_url``: The Google Meet URL to open.
                - ``display_name``: User's display name.
                - ``meeting_id``: String UUID of the meeting.
                - ``instructions``: Human-readable join instructions.
        """
        return {
            "provider": self.provider_name,
            "join_url": meet_link,
            "display_name": display_name,
            "meeting_id": str(meeting_id),
            "instructions": (
                "Click the join URL to open Google Meet. "
                "Allow camera and microphone access when prompted. "
                "Your display name has been pre-filled."
            ),
            **(metadata or {}),
        }

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    @staticmethod
    def _extract_room_code(path: str) -> str | None:
        """Extract and validate the room code from a URL path.

        Args:
            path: The path component of the parsed URL.

        Returns:
            str | None: The room code (e.g. ``'abc-defg-hij'``) if found,
                or None if no valid code is present.
        """
        match = _PATH_ROOM_CODE_PATTERN.search(path)
        if match:
            code = match.group(1)
            if _ROOM_CODE_PATTERN.match(code):
                return code
        return None
