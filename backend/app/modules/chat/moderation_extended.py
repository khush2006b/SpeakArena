"""Extended Moderation Service — teacher chat controls.

Extends the basic ModerationService in service.py with:
    - Mute / Unmute a student (Redis-backed for speed + DB audit).
    - Kick a student from the chat session (WebSocket disconnect).
    - Lock / Unlock the entire room (read-only mode).
    - Bulk delete multiple messages at once.
    - Check if a user is muted or if a room is locked.

All state changes are stored in Redis for O(1) read access during
message send validation. Actions are also logged in the audit table.

Redis Key Patterns:
    chat:mute:{room_id}:{user_id}   — Mute flag; no TTL; teacher removes.
    chat:lock:{room_id}             — Lock flag; no TTL; teacher removes.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import AppError, PermissionDeniedError
from app.models.audit import AuditLog
from app.models.enums import AuditSeverity, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.modules.chat.repository import MessageRepository
from app.modules.chat.repository import ChatRoomRepository
from app.modules.chat.service import MessageNotFoundError, RoomNotFoundError
from app.modules.chat.ws_schemas import (
    WSEventType,
    make_envelope,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis key templates
# ---------------------------------------------------------------------------

_KEY_MUTE = "chat:mute:{room_id}:{user_id}"
_KEY_LOCK = "chat:lock:{room_id}"


# ===========================================================================
# ExtendedModerationService
# ===========================================================================


class ExtendedModerationService:
    """Teacher-only extended moderation operations.

    All methods require the caller to be a teacher. This is enforced
    at the router layer via get_current_teacher and re-asserted here.

    Args:
        db: Async SQLAlchemy session.
        redis: Async Redis client.
        teacher: The authenticated teacher user.
    """

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        teacher: User,
    ) -> None:
        """Initialize the extended moderation service.

        Args:
            db: Async SQLAlchemy session.
            redis: Async Redis client.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._redis = redis
        self._teacher = teacher
        self._msg_repo = MessageRepository(db)
        self._room_repo = ChatRoomRepository(db)

    def _require_teacher(self) -> None:
        """Assert the actor is a teacher.

        Raises:
            PermissionDeniedError: If the actor is not a teacher.
        """
        if self._teacher.role != UserRole.TEACHER:
            raise PermissionDeniedError(
                message="This action requires teacher permissions."
            )

    # -----------------------------------------------------------------------
    # Mute / Unmute
    # -----------------------------------------------------------------------

    async def mute_student(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """Mute a student in a course chat room.

        Sets a Redis key for fast lookup during message send. All subsequent
        messages from the muted student are flagged is_muted_user_message.

        Args:
            course_id: UUID of the course.
            student_id: UUID of the student to mute.
            reason: Optional reason (stored in audit log).

        Returns:
            dict[str, Any]: Mute action confirmation.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found for the course.
        """
        self._require_teacher()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        room_id_str = str(room.id)
        student_id_str = str(student_id)

        await self._redis.set(
            _KEY_MUTE.format(room_id=room_id_str, user_id=student_id_str),
            "true",
            ex=2592000,  # 30-day TTL to allow volatile-lru eviction safety
        )

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.student_muted",
            entity_type="chat_room",
            entity_id=room.id,
            severity=AuditSeverity.WARNING,
            metadata_={
                "student_id": student_id_str,
                "reason": reason or "",
                "teacher_id": str(self._teacher.id),
            },
        ))

        # In-app notification to student
        self._db.add(Notification(
            recipient_id=student_id,
            type=NotificationType.ACCOUNT_WARNING,
            title="You have been muted",
            body=(
                f"You have been muted in the course chat."
                + (f" Reason: {reason}" if reason else "")
            ),
            entity_type="chat_room",
            entity_id=room.id,
            action_url=f"/courses/{course_id}/chat",
            channel="in_app",
        ))

        logger.warning(
            "Student %s muted by teacher %s in room %s",
            student_id,
            self._teacher.id,
            room.id,
        )

        return {
            "action": "muted",
            "student_id": student_id_str,
            "room_id": room_id_str,
            "reason": reason,
        }

    async def unmute_student(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Unmute a previously muted student.

        Removes the Redis mute key so the student can send messages normally.

        Args:
            course_id: UUID of the course.
            student_id: UUID of the student to unmute.

        Returns:
            dict[str, Any]: Unmute action confirmation.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found.
        """
        self._require_teacher()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        room_id_str = str(room.id)
        student_id_str = str(student_id)

        await self._redis.delete(
            _KEY_MUTE.format(room_id=room_id_str, user_id=student_id_str)
        )

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.student_unmuted",
            entity_type="chat_room",
            entity_id=room.id,
            severity=AuditSeverity.INFO,
            metadata_={
                "student_id": student_id_str,
            },
        ))

        logger.info(
            "Student %s unmuted by teacher %s in room %s",
            student_id,
            self._teacher.id,
            room.id,
        )

        return {
            "action": "unmuted",
            "student_id": student_id_str,
            "room_id": room_id_str,
        }

    async def is_muted(
        self,
        room_id: str,
        user_id: str,
    ) -> bool:
        """Check whether a user is muted in a room.

        O(1) Redis GET. Called by MessageService before every send.

        Args:
            room_id: UUID string of the room.
            user_id: UUID string of the user.

        Returns:
            bool: True if the user is currently muted.
        """
        return bool(await self._redis.exists(
            _KEY_MUTE.format(room_id=room_id, user_id=user_id)
        ))

    # -----------------------------------------------------------------------
    # Lock / Unlock
    # -----------------------------------------------------------------------

    async def lock_room(
        self,
        course_id: uuid.UUID,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """Lock the chat room to read-only mode.

        Students can no longer send messages. Teacher messages still work.
        Broadcasts a room.locked event via Redis Pub/Sub.

        Args:
            course_id: UUID of the course.
            reason: Optional lock reason to broadcast.

        Returns:
            dict[str, Any]: Lock action confirmation.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found.
        """
        self._require_teacher()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        room_id_str = str(room.id)
        await self._redis.set(_KEY_LOCK.format(room_id=room_id_str), "true", ex=2592000)

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.room_locked",
            entity_type="chat_room",
            entity_id=room.id,
            severity=AuditSeverity.WARNING,
            metadata_={"reason": reason or ""},
        ))

        logger.warning(
            "Room %s locked by teacher %s. Reason: %s",
            room.id,
            self._teacher.id,
            reason,
        )

        return {
            "action": "locked",
            "room_id": room_id_str,
            "reason": reason,
            "locked_by": str(self._teacher.id),
        }

    async def unlock_room(
        self,
        course_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Unlock the chat room, allowing students to send messages again.

        Args:
            course_id: UUID of the course.

        Returns:
            dict[str, Any]: Unlock action confirmation.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found.
        """
        self._require_teacher()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        room_id_str = str(room.id)
        await self._redis.delete(_KEY_LOCK.format(room_id=room_id_str))

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.room_unlocked",
            entity_type="chat_room",
            entity_id=room.id,
            severity=AuditSeverity.INFO,
            metadata_={},
        ))

        logger.info(
            "Room %s unlocked by teacher %s", room.id, self._teacher.id
        )

        return {"action": "unlocked", "room_id": room_id_str}

    async def is_locked(
        self,
        room_id: str,
    ) -> bool:
        """Check whether a room is currently locked.

        O(1) Redis GET.

        Args:
            room_id: UUID string of the room.

        Returns:
            bool: True if the room is locked.
        """
        return bool(await self._redis.exists(
            _KEY_LOCK.format(room_id=room_id)
        ))

    # -----------------------------------------------------------------------
    # Bulk delete
    # -----------------------------------------------------------------------

    async def bulk_delete_messages(
        self,
        message_ids: list[uuid.UUID],
    ) -> dict[str, Any]:
        """Soft-delete multiple messages in a single operation.

        Args:
            message_ids: List of message UUIDs to delete (max 50).

        Returns:
            dict[str, Any]: Count of deleted and not-found messages.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            AppError: If more than 50 IDs are provided.
        """
        self._require_teacher()

        if len(message_ids) > 50:
            raise AppError(
                message="Cannot bulk-delete more than 50 messages at once.",
                error_code="BulkDeleteLimit",
            )

        deleted = 0
        not_found = 0

        for mid in message_ids:
            msg = await self._msg_repo.get_by_id(mid)
            if msg is None or msg.deleted_at is not None:
                not_found += 1
                continue
            await self._msg_repo.soft_delete(msg)
            deleted += 1

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.bulk_delete",
            entity_type="chat_message",
            entity_id=None,
            severity=AuditSeverity.WARNING,
            metadata_={
                "deleted": deleted,
                "not_found": not_found,
                "requested": len(message_ids),
            },
        ))

        logger.warning(
            "Teacher %s bulk-deleted %d/%d messages",
            self._teacher.id,
            deleted,
            len(message_ids),
        )

        return {"deleted": deleted, "not_found": not_found}

    # -----------------------------------------------------------------------
    # Kick
    # -----------------------------------------------------------------------

    async def kick_student(
        self,
        course_id: uuid.UUID,
        student_id: uuid.UUID,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """Kick a student from the chat (sends a private moderation.kicked WS event).

        The kick event is sent directly to the student's local WebSocket
        connections via the ConnectionManager. The student's frontend is
        expected to disconnect and show a 'you were kicked' message.

        Note: This does NOT remove enrollment. Kicked students can reconnect
        unless also muted or the room is locked.

        Args:
            course_id: UUID of the course.
            student_id: UUID of the student to kick.
            reason: Optional reason shown to the student.

        Returns:
            dict[str, Any]: Kick action confirmation.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found.
        """
        self._require_teacher()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        room_id_str = str(room.id)
        student_id_str = str(student_id)

        self._db.add(AuditLog(
            user_id=self._teacher.id,
            action="chat.student_kicked",
            entity_type="chat_room",
            entity_id=room.id,
            severity=AuditSeverity.WARNING,
            metadata_={
                "student_id": student_id_str,
                "reason": reason or "",
            },
        ))

        logger.warning(
            "Student %s kicked by teacher %s from room %s",
            student_id,
            self._teacher.id,
            room.id,
        )

        # Return the envelope JSON for the caller to send via ConnectionManager
        kick_envelope = make_envelope(
            WSEventType.MODERATION_KICKED,
            {
                "student_id": student_id_str,
                "reason": reason or "You have been removed from the chat.",
                "kicked_by": str(self._teacher.id),
            },
            room_id=room_id_str,
        )

        return {
            "action": "kicked",
            "student_id": student_id_str,
            "room_id": room_id_str,
            "reason": reason,
            "ws_envelope_json": kick_envelope.to_json(),
        }
