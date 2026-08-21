"""Aggregate router for API v1.

All feature routers are registered here and mounted under /api/v1
by main.py. This is the single source of truth for route prefixes
and tags.

Registration order determines the order in the OpenAPI documentation.
Business logic never lives in this file.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routers.health import router as health_router
from app.modules.auth.router import router as auth_router
from app.modules.teacher.router import router as teacher_router

# Student module routers (one file per route prefix)
from app.modules.student.routers.dashboard import router as student_dashboard_router
from app.modules.student.routers.courses import router as student_courses_router
from app.modules.student.routers.resources import router as student_resources_router
from app.modules.student.routers.progress import router as student_progress_router
from app.modules.student.routers.meetings import router as student_meetings_router
from app.modules.student.routers.attendance import router as student_attendance_router
from app.modules.student.routers.profile import router as student_profile_router
from app.modules.student.routers.notifications import router as student_notifications_router
from app.modules.payment.router import router as payment_router
from app.modules.chat.router import router as chat_router
from app.modules.resource.router import (
    video_router,
    pdf_router,
    storage_router,
)
from app.modules.assignment.router import router as assignment_router

api_router = APIRouter()

# ── Infrastructure ────────────────────────────────────────────────────────
api_router.include_router(health_router)

# ── Authentication ────────────────────────────────────────────────────────
# The auth_router declares prefix="/auth" internally; no prefix added here.
api_router.include_router(auth_router)

# ── Teacher (Admin) Portal ────────────────────────────────────────────────
# The teacher_router declares prefix="/teacher" internally.
# All endpoints require teacher role — students receive HTTP 403.
api_router.include_router(teacher_router)

# ── Student Portal ────────────────────────────────────────────────────────
# All student routers declare their own prefixes internally.
# All endpoints require student role — teachers receive HTTP 403.
#
# /student   — dashboard aggregation + global search
# /courses   — enrolled course listing, detail, announcements
# /resources — video streaming URLs + PDF access URLs + progress heartbeat
# /progress  — course-level progress summary
# /meetings  — meeting list + detail with meet link gating
# /attendance — attendance records + summary stats
# /profile   — student profile read/update + avatar upload + password change
# /notifications — notification history + mark-read + delete
api_router.include_router(student_dashboard_router)
api_router.include_router(student_courses_router)
api_router.include_router(student_resources_router)
api_router.include_router(student_progress_router)
api_router.include_router(student_meetings_router)
api_router.include_router(student_attendance_router)
api_router.include_router(student_profile_router)
api_router.include_router(student_notifications_router)

# ── Payment Module ────────────────────────────────────────────────────────
# /payments — serves both student checkout and teacher refund/analytics.
# Per-endpoint role enforcement via get_current_student / get_current_teacher.
# Webhook endpoint is unauthenticated but HMAC-SHA256 verified.
api_router.include_router(payment_router)

# ── Chat Module ───────────────────────────────────────────────────────────
# /chat/{course_id} — one room per course.
# All endpoints require authentication. Enrollment verified in service layer.
# Teacher-only: settings, pin, announce, moderate.
api_router.include_router(chat_router)

# ── Resource Module ───────────────────────────────────────────────────────
# /videos  — presigned upload, confirm, list, stream, progress (teacher+student)
# /pdfs    — presigned upload, confirm, list, access URL  (teacher+student)
# /storage — storage statistics per course                (teacher only)
# Enrollment verified per-request in service layer.
api_router.include_router(video_router)
api_router.include_router(pdf_router)
api_router.include_router(storage_router)

# ── Assignment Module ─────────────────────────────────────────────────────
# /assignments — teacher CRUD + publish; student submit + grade view.
# Enrollment + ownership enforced in service layer per endpoint.
# File submissions use presigned R2 PUT URLs (max 50 MB).
api_router.include_router(assignment_router)

# ── Meeting Module (Phase 10) ─────────────────────────────────────────────
# /meetings    — teacher meeting CRUD, lifecycle, recurring, analytics.
# /live        — student join/leave pipeline (enrollment + time + capacity).
# /attendance  — teacher attendance read/override; student own-history.
# /calendar    — today, upcoming, weekly, monthly, past views.
#
# Security contract: meet_link is NEVER returned by any list/detail endpoint.
# The raw link is only emitted by /live/{id}/join after full verification.
from app.modules.meeting.router import (  # noqa: E402
    attendance_router as meeting_attendance_router,
    calendar_router,
    live_router,
    meeting_router,
)

api_router.include_router(meeting_router)
api_router.include_router(live_router)
api_router.include_router(meeting_attendance_router)
api_router.include_router(calendar_router)

# ── Phase 11: Real-Time Chat WebSocket + Extended REST ────────────────────
# WS  /ws/chat/{room_id}?token=<JWT>   — real-time bidirectional channel.
# REST /chat/{course_id}/search        — full-text message search.
# REST /chat/{course_id}/files         — attachment file search.
# REST /chat/{course_id}/analytics     — teacher engagement analytics.
# REST /chat/{course_id}/presence      — online user list.
# REST /chat/{course_id}/moderation/*  — mute, unmute, kick, lock, unlock.
#
# Security contract for WebSocket:
#   - JWT passed as ?token= query param (header not available on WS handshake).
#   - Enrollment verified at connect time.
#   - Mute + lock checked per message.send via O(1) Redis lookups.
#   - All events broadcast via Redis Pub/Sub for multi-instance safety.
from app.modules.chat.ws_router import ws_router  # noqa: E402
from app.modules.test.router import router as test_router  # noqa: E402

api_router.include_router(ws_router)
api_router.include_router(test_router)
