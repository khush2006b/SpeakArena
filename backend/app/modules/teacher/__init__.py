"""Teacher module package for SpeakArena.

This module provides the complete teacher (admin) portal functionality:

    - Dashboard: Aggregated statistics and quick-action data.
    - Course Management: Full CRUD, publish/archive lifecycle.
    - Meeting Management: Live session scheduling and tracking.
    - Resource Management: Video + PDF upload pipeline via Cloudflare R2.
    - Announcements: Pinned announcement messages in course chat rooms.
    - Student Management: View, search, suspend, and block enrolled students.
    - Attendance: Per-meeting attendance tracking and CSV export.
    - Analytics: Revenue, enrollment, attendance, and course performance charts.
    - Teacher Profile: Bio, avatar, social links, and qualification management.

Architecture::

    router.py  ->  service.py  ->  repository.py  ->  SQLAlchemy / Redis
                       |
                  core/storage/r2.py  (Cloudflare R2 presign / delete)

All endpoints require ``get_current_teacher`` from ``modules.auth.dependencies``.
Students receive HTTP 403 Forbidden on all routes in this module.
"""
