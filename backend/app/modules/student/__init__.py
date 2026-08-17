"""Student module package for SpeakArena.

This module provides the complete student-facing portal:

    - Dashboard: Welcome, purchased courses, continue learning, activity feed.
    - My Courses: Enrolled course list, search, filter, sort, progress.
    - Course Detail: Full course info, curriculum, teacher, resources.
    - Video Access: Signed streaming URLs, resume position, watch history.
    - PDF Access: Signed download URLs, metadata.
    - Progress Tracking: Per-content progress, completion %, learning streak.
    - Meeting Module: Upcoming classes, meet link gated by enrollment + status.
    - Attendance: Per-meeting attendance, stats, analytics.
    - Notifications: In-app notification history, read/unread, preferences.
    - Payment History: Purchases, invoices, refund status.
    - Student Profile: Bio, avatar, language, timezone, notification settings.
    - Search: Cross-entity search scoped to enrollment.

Architecture::

    routers/*.py  ->  service.py  ->  repository.py  ->  SQLAlchemy / Redis
                           |
                    core/storage/r2.py  (Signed GET URLs for video + PDF)

Security::

    All endpoints require ``get_current_student`` from ``modules.auth.dependencies``.
    Teachers receive HTTP 403 Forbidden on all student routes.
    Every content query is double-scoped: student_id + enrollment guard.
    Meet links are stripped from responses unless enrollment is ACTIVE
    and meeting.status is SCHEDULED or LIVE.
"""
