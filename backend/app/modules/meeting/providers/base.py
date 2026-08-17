"""Abstract MeetingProvider interface.

All meeting platform integrations (Google Meet, Zoom, Jitsi, LiveKit)
MUST implement this interface. The service layer depends only on this
abstraction, never on a concrete provider, enabling zero-business-logic
change when switching providers.

Usage::

    provider: MeetingProvider = GoogleMeetProvider()
    link = provider.normalize_link(raw_url)
    provider.validate_link(link)          # raises InvalidMeetingLinkError on failure
    join_data = provider.generate_join_response(link, meeting_id, user_id)
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Any


class MeetingProvider(ABC):
    """Abstract base class for all live meeting platform integrations.

    Each provider implements three responsibilities:
        1. Validating that a URL matches the provider's format.
        2. Normalizing raw URLs to a canonical stored form.
        3. Generating a secure join response for an authenticated user.

    Implementations must be stateless (no instance state, no DB access).
    DB access belongs in the service layer.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the canonical provider identifier string.

        This value is stored in Meeting.provider and used for
        provider routing. Must be stable across releases.

        Returns:
            str: e.g. ``'google_meet'``, ``'zoom'``, ``'jitsi'``.
        """

    @abstractmethod
    def validate_link(self, url: str) -> None:
        """Validate that the URL matches this provider's expected format.

        Args:
            url: The raw meeting URL submitted by the teacher.

        Raises:
            InvalidMeetingLinkError: If the URL does not match the
                provider's expected format.
        """

    @abstractmethod
    def normalize_link(self, url: str) -> str:
        """Normalize a raw meeting URL to its canonical form.

        Strips unnecessary query parameters, enforces HTTPS, removes
        trailing slashes, and applies any provider-specific formatting.
        Should be called after ``validate_link`` succeeds.

        Args:
            url: The raw meeting URL.

        Returns:
            str: The normalized, canonical URL for DB storage.
        """

    @abstractmethod
    def generate_join_response(  # noqa: PLR0913
        self,
        meet_link: str,
        meeting_id: uuid.UUID,
        user_id: uuid.UUID,
        display_name: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate the secure join response payload for the given user.

        The raw meet_link must NEVER be returned as-is. The provider
        decides how to expose the join information — this might be a
        signed redirect URL, a one-time token, or a structured payload.

        Args:
            meet_link: The stored canonical meeting URL (from DB).
            meeting_id: The UUID of the meeting being joined.
            user_id: The UUID of the user joining.
            display_name: The full name of the joining user.
            metadata: Optional extra context (e.g. course_id, role).

        Returns:
            dict[str, Any]: Provider-specific join payload. Always includes:
                - ``provider``: Provider name string.
                - ``join_url``: The URL the client should open.
                - ``display_name``: Pre-populated display name.
        """

    def is_duplicate(self, url_a: str, url_b: str) -> bool:
        """Return True if two URLs resolve to the same meeting room.

        The default implementation compares normalized forms. Override
        if the provider has additional duplicate-detection logic
        (e.g. Zoom meeting IDs extracted from URLs).

        Args:
            url_a: First meeting URL (already normalized).
            url_b: Second meeting URL (already normalized).

        Returns:
            bool: True if both URLs point to the same session.
        """
        return self.normalize_link(url_a) == self.normalize_link(url_b)
