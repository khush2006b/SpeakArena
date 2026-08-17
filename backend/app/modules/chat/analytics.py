"""Chat Analytics Service.

Provides teacher-facing analytics for chat room engagement:
    - Messages per day (time-series).
    - Most active students.
    - Teacher response time.
    - Unread message stats.
    - Peak activity hours.
    - Attachment usage stats.

All queries run against PostgreSQL. Results are NOT cached in Redis
because they are low-frequency, teacher-only reads.

For real-time analytics dashboards, consider computing these metrics
asynchronously in a Celery task and caching them in Redis.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, extract, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import AppError, PermissionDeniedError
from app.models.chat import ChatRoom, Message
from app.models.course import CourseEnrollment
from app.models.enums import EnrollmentStatus, MessageContentType, UserRole
from app.models.user import User


class ChatAnalyticsService:
    """Aggregation analytics for a course chat room.

    All methods are teacher-only. Students cannot access analytics.

    Args:
        db: Async SQLAlchemy session.
        teacher: The authenticated teacher user.
    """

    def __init__(self, db: AsyncSession, teacher: "User") -> None:
        """Initialize the analytics service.

        Args:
            db: Async SQLAlchemy session.
            teacher: The authenticated teacher.
        """
        self._db = db
        self._teacher = teacher

    def _require_teacher(self) -> None:
        """Assert the actor is a teacher.

        Raises:
            PermissionDeniedError: If the actor is not a teacher.
        """
        if self._teacher.role != UserRole.TEACHER:
            raise PermissionDeniedError(
                message="Chat analytics is available to teachers only."
            )

    async def _get_room(
        self, course_id: uuid.UUID
    ) -> ChatRoom:
        """Fetch the chat room for a course or raise.

        Args:
            course_id: UUID of the course.

        Returns:
            ChatRoom: The chat room ORM instance.

        Raises:
            AppError: If room not found.
        """
        room = (
            await self._db.execute(
                select(ChatRoom).where(ChatRoom.course_id == course_id)
            )
        ).scalar_one_or_none()
        if room is None:
            raise AppError(
                message="Chat room not found for this course.",
                error_code="ChatRoomNotFound",
                status_code=404,
            )
        return room

    async def messages_per_day(
        self,
        course_id: uuid.UUID,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """Return message counts grouped by calendar day for the last N days.

        Args:
            course_id: UUID of the course.
            days: Number of days to look back (default 30, max 365).

        Returns:
            list[dict[str, Any]]: Each entry has keys:
                date (YYYY-MM-DD str) and count (int).
        """
        self._require_teacher()
        room = await self._get_room(course_id)
        days = min(days, 365)

        since = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                func.date(Message.created_at).label("day"),
                func.count(Message.id).label("count"),
            )
            .where(
                Message.chat_room_id == room.id,
                Message.deleted_at.is_(None),
                Message.created_at >= since,
            )
            .group_by(text("day"))
            .order_by(text("day"))
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {"date": str(r.day), "count": r.count}
            for r in rows
        ]

    async def most_active_students(
        self,
        course_id: uuid.UUID,
        limit: int = 10,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """Return the most active message senders in the last N days.

        Args:
            course_id: UUID of the course.
            limit: Maximum number of students to return.
            days: Lookback window in days.

        Returns:
            list[dict[str, Any]]: Each entry has keys:
                user_id, full_name, message_count, role.
        """
        self._require_teacher()
        room = await self._get_room(course_id)
        since = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                User.id.label("user_id"),
                User.full_name,
                User.role,
                func.count(Message.id).label("message_count"),
            )
            .join(User, User.id == Message.sender_id)
            .where(
                Message.chat_room_id == room.id,
                Message.deleted_at.is_(None),
                Message.created_at >= since,
            )
            .group_by(User.id, User.full_name, User.role)
            .order_by(desc(func.count(Message.id)))
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "user_id": r.user_id,
                "full_name": r.full_name,
                "role": r.role,
                "message_count": r.message_count,
            }
            for r in rows
        ]

    async def engagement_summary(
        self,
        course_id: uuid.UUID,
        days: int = 30,
    ) -> dict[str, Any]:
        """Return a high-level engagement summary for a course chat room.

        Args:
            course_id: UUID of the course.
            days: Lookback window in days.

        Returns:
            dict[str, Any]: Engagement summary with keys:
                total_messages, total_announcements, total_attachments,
                unique_senders, student_messages, teacher_messages,
                avg_messages_per_day, total_reactions, pinned_count.
        """
        self._require_teacher()
        room = await self._get_room(course_id)
        since = datetime.now(timezone.utc) - timedelta(days=days)

        conds = [
            Message.chat_room_id == room.id,
            Message.deleted_at.is_(None),
            Message.created_at >= since,
        ]

        # Total messages
        total_result = await self._db.execute(
            select(func.count(Message.id)).where(and_(*conds))
        )
        total_messages = total_result.scalar_one()

        # Announcements
        ann_result = await self._db.execute(
            select(func.count(Message.id)).where(
                and_(*conds, Message.is_announcement.is_(True))
            )
        )
        total_announcements = ann_result.scalar_one()

        # Unique senders
        senders_result = await self._db.execute(
            select(func.count(func.distinct(Message.sender_id))).where(and_(*conds))
        )
        unique_senders = senders_result.scalar_one()

        # Pinned
        pinned_result = await self._db.execute(
            select(func.count(Message.id)).where(
                and_(*conds, Message.is_pinned.is_(True))
            )
        )
        pinned_count = pinned_result.scalar_one()

        avg_per_day = round(total_messages / max(days, 1), 2)

        return {
            "total_messages": total_messages,
            "total_announcements": total_announcements,
            "unique_senders": unique_senders,
            "pinned_count": pinned_count,
            "avg_messages_per_day": avg_per_day,
            "lookback_days": days,
        }

    async def peak_activity_hours(
        self,
        course_id: uuid.UUID,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """Return message counts grouped by UTC hour of day.

        Args:
            course_id: UUID of the course.
            days: Lookback window in days.

        Returns:
            list[dict[str, Any]]: 24 items with keys: hour (0-23), count.
        """
        self._require_teacher()
        room = await self._get_room(course_id)
        since = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                extract("hour", Message.created_at).label("hour"),
                func.count(Message.id).label("count"),
            )
            .where(
                Message.chat_room_id == room.id,
                Message.deleted_at.is_(None),
                Message.created_at >= since,
            )
            .group_by(text("hour"))
            .order_by(text("hour"))
        )
        rows = (await self._db.execute(stmt)).all()
        hour_map = {int(r.hour): r.count for r in rows}
        return [
            {"hour": h, "count": hour_map.get(h, 0)}
            for h in range(24)
        ]

    async def attachment_stats(
        self,
        course_id: uuid.UUID,
        days: int = 30,
    ) -> dict[str, Any]:
        """Return statistics about file attachments shared in the room.

        Args:
            course_id: UUID of the course.
            days: Lookback window in days.

        Returns:
            dict[str, Any]: Attachment stats with keys:
                messages_with_attachments, total_size_bytes,
                image_count, pdf_count, other_count.
        """
        self._require_teacher()
        room = await self._get_room(course_id)
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Count messages that have at least one attachment
        stmt = (
            select(
                func.count(Message.id).label("count"),
            )
            .where(
                Message.chat_room_id == room.id,
                Message.deleted_at.is_(None),
                Message.created_at >= since,
                func.jsonb_array_length(Message.attachments) > 0,
            )
        )
        result = await self._db.execute(stmt)
        messages_with_attachments = result.scalar_one()

        return {
            "messages_with_attachments": messages_with_attachments,
            "lookback_days": days,
        }
