"""Feature modules package.

Each sub-package represents a bounded context of the platform:
    auth     : Authentication, authorization, and session management.
    courses  : Course catalog, enrollment, and content delivery.
    payments : Razorpay integration and payment lifecycle.
    meetings : Zoom/Jitsi live session scheduling and attendance.
    chat     : Real-time messaging between teacher and students.

Modules are independent and communicate only through service interfaces.
Direct cross-module repository access is forbidden.
"""
