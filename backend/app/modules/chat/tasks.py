"""Chat module — Background task stubs.

All task functions are designed to be:
    1. Importable and runnable as FastAPI BackgroundTasks now.
    2. Migrated to Celery tasks in the future with minimal changes.
       Just add @celery_app.task decorator and change the call-site.

Celery Migration Path::

    # Current (FastAPI BackgroundTasks)
    background_tasks.add_task(cleanup_expired_typing_indicators, redis)

    # Future (Celery)
    cleanup_expired_typing_indicators.delay(room_id)

Task Registry:
    cleanup_expired_typing_indicators  — Prune stale typing set entries.
    notify_room_members                — Fan-out notification to enrollees.
    process_attachment_cleanup         — Delete orphaned R2 attachments.
    compute_room_analytics             — Pre-compute and cache analytics.
    send_daily_unread_digest           — Daily email digest for offline users.

Note:
    Long-running tasks (digest, analytics) should always use Celery in
    production. The stubs here use asyncio for simplicity until Celery
    is configured.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ===========================================================================
# Task: cleanup_expired_typing_indicators
# ===========================================================================


async def cleanup_expired_typing_indicators(
    redis: Any,
    room_id: str,
) -> None:
    """Prune stale typing indicator entries from Redis.

    Scans the typing set for user_ids whose per-user TTL key has expired
    and removes them from the set. This ensures the typing indicator
    list is always accurate even if a client disconnects unexpectedly.

    Intended to run as a FastAPI BackgroundTask every time a typing event
    is received. Celery alternative: schedule as a periodic task.

    Args:
        redis: Async Redis client.
        room_id: UUID string of the room to clean up.
    """
    try:
        from app.modules.chat.presence import TypingService
        svc = TypingService(redis)
        await svc._get_typing_users(room_id)  # prunes stale entries internally
    except Exception as exc:
        logger.error(
            "cleanup_expired_typing_indicators failed for room=%s: %s",
            room_id,
            exc,
        )


# ===========================================================================
# Task: notify_room_members
# ===========================================================================


async def notify_room_members(
    db: Any,
    course_id: uuid.UUID,
    notification_type: str,
    title: str,
    body: str,
    entity_id: Optional[uuid.UUID] = None,
    action_url: Optional[str] = None,
    exclude_user_id: Optional[uuid.UUID] = None,
) -> None:
    """Fan-out in-app notifications to all enrolled students in a course.

    Inserts one Notification row per enrolled student in the DB session.
    Commit is the caller's responsibility.

    Celery migration: Extract the SQLAlchemy session management and
    accept only plain IDs (not ORM sessions). Use get_db_session() inside
    the Celery task.

    Args:
        db: Async SQLAlchemy session.
        course_id: UUID of the course whose enrollees receive the notification.
        notification_type: NotificationType string.
        title: Notification title text.
        body: Notification body text.
        entity_id: Optional related entity UUID.
        action_url: Optional deep link URL for the frontend.
        exclude_user_id: Optional sender UUID to exclude from notifications.
    """
    try:
        from sqlalchemy import select
        from app.models.course import CourseEnrollment
        from app.models.notification import Notification
        from app.models.enums import EnrollmentStatus, NotificationChannel

        result = await db.execute(
            select(CourseEnrollment.student_id).where(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        student_ids = result.scalars().all()

        for student_id in student_ids:
            if exclude_user_id and student_id == exclude_user_id:
                continue
            db.add(Notification(
                recipient_id=student_id,
                type=notification_type,
                title=title,
                body=body,
                entity_type="chat_message",
                entity_id=entity_id,
                action_url=action_url,
                channel=NotificationChannel.IN_APP,
            ))
    except Exception as exc:
        logger.error(
            "notify_room_members failed for course=%s: %s",
            course_id,
            exc,
        )


# ===========================================================================
# Task: process_attachment_cleanup
# ===========================================================================


async def process_attachment_cleanup(
    r2_keys: list[str],
) -> None:
    """Delete orphaned R2 attachment objects.

    Called after a message is soft-deleted to remove the binary files
    from Cloudflare R2 storage. DB-level data (attachments JSONB) is
    cleared by the repository before this task runs.

    Args:
        r2_keys: List of R2 object keys to delete.
    """
    if not r2_keys:
        return

    try:
        from app.core.storage import r2
        for key in r2_keys:
            try:
                await r2.delete_object(key)
                logger.info("Deleted R2 attachment: %s", key)
            except Exception as exc:
                logger.error("Failed to delete R2 key %s: %s", key, exc)
    except ImportError:
        logger.warning(
            "R2 storage not configured; skipping attachment cleanup for %d keys",
            len(r2_keys),
        )


# ===========================================================================
# Task: compute_room_analytics (stub)
# ===========================================================================


async def compute_room_analytics(
    course_id: uuid.UUID,
) -> None:
    """Pre-compute and cache room analytics for a course.

    Stub implementation. In production, this would:
        1. Instantiate ChatAnalyticsService with a fresh DB session.
        2. Run engagement_summary(), messages_per_day(), etc.
        3. Serialize results to JSON and cache in Redis with a 1-hour TTL.

    Celery migration: Run as a periodic task every hour.

    Args:
        course_id: UUID of the course to compute analytics for.
    """
    logger.info(
        "compute_room_analytics stub called for course=%s. "
        "Migrate to Celery periodic task for production use.",
        course_id,
    )
    # Stub: no-op until Celery is configured.
    await asyncio.sleep(0)


# ===========================================================================
# Task: send_daily_unread_digest (stub)
# ===========================================================================


async def send_daily_unread_digest(
    user_id: uuid.UUID,
    unread_summary: dict[str, Any],
) -> None:
    """Send a daily unread message digest email to an offline user.

    Stub implementation. In production:
        1. Render an HTML email template with unread_summary data.
        2. Send via SendGrid / AWS SES.
        3. Record the delivery in the notifications table.

    Celery migration: Run as a periodic beat task at 08:00 UTC daily.

    Args:
        user_id: UUID of the recipient user.
        unread_summary: Dict of {room_name: unread_count} per room.
    """
    logger.info(
        "send_daily_unread_digest stub called for user=%s with %d rooms. "
        "Migrate to Celery + email provider for production.",
        user_id,
        len(unread_summary),
    )
    # Stub: no-op until email provider is configured.
    await asyncio.sleep(0)


# ===========================================================================
# Task: prune_presence_sorted_sets (stub)
# ===========================================================================


async def prune_presence_sorted_sets(
    redis: Any,
    room_id: str,
    cutoff_seconds: int = 86400,
) -> None:
    """Remove stale entries from the room's presence sorted set.

    Removes members whose last-seen score is older than cutoff_seconds.
    Prevents unbounded sorted set growth in long-lived rooms.

    Celery migration: Schedule as a daily maintenance task.

    Args:
        redis: Async Redis client.
        room_id: UUID string of the room.
        cutoff_seconds: Remove entries older than this many seconds.
    """
    import time
    cutoff = time.time() - cutoff_seconds
    key = f"chat:presence:{room_id}"
    try:
        removed = await redis.zremrangebyscore(key, "-inf", cutoff)
        if removed:
            logger.info(
                "Pruned %d stale presence entries from room=%s",
                removed,
                room_id,
            )
    except Exception as exc:
        logger.error(
            "prune_presence_sorted_sets failed for room=%s: %s", room_id, exc
        )
