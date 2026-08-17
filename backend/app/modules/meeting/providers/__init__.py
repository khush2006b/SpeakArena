"""Meeting provider package.

Exposes the abstract interface and the concrete Google Meet implementation.
"""

from app.modules.meeting.providers.base import MeetingProvider
from app.modules.meeting.providers.google_meet import GoogleMeetProvider

__all__ = ["MeetingProvider", "GoogleMeetProvider"]
