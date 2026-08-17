"""Meeting module — Live Meeting Management System.

This module manages the full lifecycle of scheduled live class sessions:
    - Meeting CRUD (teacher)
    - Google Meet link validation and secure reveal
    - Attendance tracking (join/leave events, aggregate summaries)
    - Calendar views (today, weekly, monthly)
    - Analytics (attendance rates, missed classes, peak attendance)
    - Notifications (created, updated, cancelled, reminders, live)

Provider abstraction:
    MeetingProvider (providers/base.py) defines the interface.
    GoogleMeetProvider (providers/google_meet.py) implements it.
    Future providers (Zoom, Jitsi, LiveKit) implement MeetingProvider
    without touching any service or router code.

Security contract:
    The raw ``meet_link`` stored in the Meeting ORM row is NEVER
    included in any API response. The join endpoint performs a full
    verification pipeline before returning a one-time join payload.
"""
