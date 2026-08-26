"""Chat module — service layer.

All business logic for the chat module.

    ChatRoomService   Manages room settings, enrollment gate, and slow mode.
    MessageService    Send, edit, delete, pin, react, announce.
    ModerationService Teacher-only moderation actions.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.errors import (
    AppError,
    PermissionDeniedError,
    ResourceNotFoundError,
)
from app.models.audit import AuditLog
from app.models.chat import ChatRoom
from app.models.enums import AuditSeverity, MessageContentType, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.modules.chat.repository import (
    ChatRoomRepository,
    MessageRepository,
    ModerationRepository,
)
from app.modules.chat.schemas import (
    CreateAnnouncementRequest,
    EditMessageRequest,
    SendMessageRequest,
    UpdateRoomSettingsRequest,
)

logger = logging.getLogger(__name__)

# Redis key patterns
_SLOW_MODE_KEY = "chat:slow_mode:{room_id}:{user_id}"  # TTL = slow_mode_seconds


# ---------------------------------------------------------------------------
# Chat-specific domain errors
# ---------------------------------------------------------------------------


class RoomNotFoundError(AppError):
    """Chat room not found for the given course."""

    status_code = 404
    error_code = "ChatRoomNotFound"
    message = "Chat room not found."


class ChatRoomInactiveError(AppError):
    """The chat room is currently disabled by the teacher."""

    status_code = 403
    error_code = "ChatRoomInactive"
    message = "The chat room for this course is currently inactive."


class SlowModeError(AppError):
    """Student is sending messages too fast."""

    status_code = 429
    error_code = "SlowModeActive"
    message = "Slow mode is active. Please wait before sending another message."


class MessageNotFoundError(AppError):
    """Message not found or already deleted."""

    status_code = 404
    error_code = "MessageNotFound"
    message = "Message not found."


class NotEnrolledError(AppError):
    """Student is not enrolled in the course."""

    status_code = 403
    error_code = "NotEnrolled"
    message = "You must be enrolled in this course to access the chat."


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------


def _audit(
    db: AsyncSession,
    actor_id: Optional[uuid.UUID],
    actor_role: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    severity: Any = AuditSeverity.INFO,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append an audit log record to the session (no flush)."""
    sev_str = severity.value if hasattr(severity, "value") else str(severity)
    db.add(
        AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            severity=sev_str,
            metadata_=metadata or {},
        )
    )


# ===========================================================================
# ChatRoomService
# ===========================================================================


class ChatRoomService:
    """Manages chat room settings and access control."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        actor: User,
    ) -> None:
        """Initialize ChatRoomService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            actor: The authenticated user.
        """
        self._db = db
        self._redis = redis
        self._actor = actor
        self._room_repo = ChatRoomRepository(db)
        self._mod_repo = ModerationRepository(db)

    async def ensure_course_rooms(self, course_id: uuid.UUID) -> list[ChatRoom]:
        """Ensure Announcement, General, and Global Announcement rooms exist for a course."""
        from app.models.course import Course
        rooms = await self._room_repo.list_by_course_id(course_id)
        types = {r.room_type for r in rooms}
        
        course = await self._db.get(Course, course_id)
        if course is None:
            raise RoomNotFoundError()

        created_any = False
        if "announcement" not in types:
            ann = ChatRoom(
                course_id=course_id,
                name=f"{course.title} — Announcements",
                room_type="announcement",
                is_announcement_only=True,
            )
            self._db.add(ann)
            created_any = True

        if "general" not in types:
            gen = ChatRoom(
                course_id=course_id,
                name=f"{course.title} — General",
                room_type="general",
                is_announcement_only=False,
            )
            self._db.add(gen)
            created_any = True

        if "global_announcement" not in types:
            gann = ChatRoom(
                course_id=course_id,
                name=f"{course.title} — Global Announcements",
                room_type="global_announcement",
                is_announcement_only=True,
            )
            self._db.add(gann)
            created_any = True

        if created_any:
            try:
                await self._db.flush()
            except Exception:
                await self._db.rollback()
            rooms = await self._room_repo.list_by_course_id(course_id)

        return rooms

    async def get_room(
        self,
        course_id: uuid.UUID,
        room_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """Return the chat room for a course after access verification.

        Students must be actively enrolled. Teachers must own the course.

        Args:
            course_id: The course UUID.
            room_type: Optional room type ('general' or 'announcement').

        Returns:
            dict: ChatRoomResponse payload.

        Raises:
            RoomNotFoundError: If no room exists for the course.
            NotEnrolledError: If the student is not enrolled.
        """
        rooms = await self.ensure_course_rooms(course_id)

        if self._actor.role == UserRole.STUDENT:
            enrolled = await self._mod_repo.is_enrolled(self._actor.id, course_id)
            if not enrolled:
                raise NotEnrolledError()

        target_type = room_type or "general"
        room = next((r for r in rooms if r.room_type == target_type), rooms[0])

        pinned = None
        if room.pinned_message_id and room.pinned_message:
            msg = room.pinned_message
            pinned = {
                "id": msg.id,
                "content": msg.content,
                "is_pinned": msg.is_pinned,
                "created_at": msg.created_at,
            }

        return {
            "id": room.id,
            "course_id": room.course_id,
            "name": room.name,
            "room_type": room.room_type,
            "is_announcement_only": room.is_announcement_only,
            "description": room.description,
            "is_active": room.is_active,
            "slow_mode_seconds": room.slow_mode_seconds,
            "pinned_message": pinned,
            "created_at": room.created_at,
        }

    async def get_rooms_for_course(
        self,
        course_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Return all chat rooms for a course (Announcements + General)."""
        rooms = await self.ensure_course_rooms(course_id)

        if self._actor.role == UserRole.STUDENT:
            enrolled = await self._mod_repo.is_enrolled(self._actor.id, course_id)
            if not enrolled:
                raise NotEnrolledError()

        return [
            {
                "id": room.id,
                "course_id": room.course_id,
                "name": room.name,
                "room_type": room.room_type,
                "is_announcement_only": room.is_announcement_only,
                "description": room.description,
                "is_active": room.is_active,
                "slow_mode_seconds": room.slow_mode_seconds,
                "created_at": room.created_at,
            }
            for room in rooms
        ]

    async def get_all_rooms(self) -> list[dict[str, Any]]:
        """Return all chat rooms in the platform (teacher-only)."""
        if self._actor.role != UserRole.TEACHER:
            raise PermissionDeniedError(message="Only teachers can view all chat rooms.")
        return await self._room_repo.list_all_rooms()


    async def update_settings(
        self,
        course_id: uuid.UUID,
        body: UpdateRoomSettingsRequest,
    ) -> dict[str, Any]:
        """Update room settings (teacher-only).

        Args:
            course_id: The course UUID.
            body: The update payload.

        Returns:
            dict: Updated ChatRoomResponse payload.

        Raises:
            RoomNotFoundError: If room not found.
            PermissionDeniedError: If caller is not a teacher.
        """
        if self._actor.role != UserRole.TEACHER:
            raise PermissionDeniedError()

        room = await self._room_repo.get_by_course_id(course_id)
        if room is None:
            raise RoomNotFoundError()

        updated = await self._room_repo.update(
            room,
            name=body.name,
            description=body.description,
            slow_mode_seconds=body.slow_mode_seconds,
            is_active=body.is_active,
        )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.room_settings_updated",
            entity_type="chat_room",
            entity_id=room.id,
        )

        return {
            "id": updated.id,
            "course_id": updated.course_id,
            "name": updated.name,
            "description": updated.description,
            "is_active": updated.is_active,
            "slow_mode_seconds": updated.slow_mode_seconds,
            "created_at": updated.created_at,
        }


# ===========================================================================
# MessageService
# ===========================================================================


class MessageService:
    """Handles message send, edit, delete, pin, react, and announce."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        actor: User,
    ) -> None:
        """Initialize MessageService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            actor: The authenticated user.
        """
        self._db = db
        self._redis = redis
        self._actor = actor
        self._room_repo = ChatRoomRepository(db)
        self._msg_repo = MessageRepository(db)
        self._mod_repo = ModerationRepository(db)

    async def _get_room_and_verify_access(
        self,
        course_id: uuid.UUID,
        room_id: Optional[uuid.UUID] = None,
        room_type: Optional[str] = None,
        is_announcement: bool = False,
    ) -> Any:  # ChatRoom ORM
        """Get and validate the chat room, enrollment, and announcement permission for the actor."""
        from app.models.course import Course

        if room_id:
            room = await self._room_repo.get_by_id(room_id)
        else:
            target_type = room_type if room_type else ("announcement" if is_announcement else "general")
            room = await self._room_repo.get_by_course_id(course_id, room_type=target_type)

        if room is None:
            room_svc = ChatRoomService(self._db, self._redis, self._actor)
            rooms = await room_svc.ensure_course_rooms(course_id)
            target_type = room_type if room_type else ("announcement" if is_announcement else "general")
            room = next((r for r in rooms if r.room_type == target_type), rooms[0])

        if not room.is_active:
            raise ChatRoomInactiveError()

        if self._actor.role == UserRole.STUDENT:
            enrolled = await self._mod_repo.is_enrolled(self._actor.id, room.course_id)
            if not enrolled:
                raise NotEnrolledError()

        # Permission check: Announcement channels allow ONLY the course teacher to post
        if room.is_announcement_only or room.room_type in ("announcement", "global_announcement"):
            course = await self._db.get(Course, room.course_id)
            if course is None or self._actor.id != course.teacher_id:
                raise PermissionDeniedError(message="Only teachers can post announcements in this channel.")

        return room

    async def _enforce_slow_mode(
        self,
        room_id: uuid.UUID,
        slow_mode_seconds: int,
    ) -> None:
        """Enforce slow mode via Redis TTL."""
        if slow_mode_seconds == 0:
            return

        key = _SLOW_MODE_KEY.format(
            room_id=room_id, user_id=self._actor.id
        )
        if await self._redis.exists(key):
            raise SlowModeError()

        await self._redis.setex(key, slow_mode_seconds, "1")

    async def list_messages(
        self,
        course_id: uuid.UUID,
        *,
        before: Optional[datetime] = None,
        limit: int = 50,
        announcements_only: bool = False,
        recipient_id: Optional[uuid.UUID] = None,
        public_only: bool = False,
        dm_student_id: Optional[uuid.UUID] = None,
        room_id: Optional[uuid.UUID] = None,
        room_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """List messages for a course's chat room."""
        if room_id:
            room = await self._room_repo.get_by_id(room_id)
        else:
            target_type = room_type if room_type else ("announcement" if announcements_only else "general")
            room = await self._room_repo.get_by_course_id(course_id, room_type=target_type)

        if room is None:
            room_svc = ChatRoomService(self._db, self._redis, self._actor)
            rooms = await room_svc.ensure_course_rooms(course_id)
            target_type = room_type if room_type else ("announcement" if announcements_only else "general")
            room = next((r for r in rooms if r.room_type == target_type), rooms[0])

        if self._actor.role == UserRole.STUDENT:
            enrolled = await self._mod_repo.is_enrolled(self._actor.id, room.course_id)
            if not enrolled:
                raise NotEnrolledError()

        include_muted = self._actor.role == UserRole.TEACHER
        is_announcement_room = (
            room.room_type in ("announcement", "global_announcement")
            or room.is_announcement_only
            or announcements_only
        )

        return await self._msg_repo.list_messages(
            room.id,
            before=before,
            limit=limit,
            announcements_only=announcements_only,
            include_muted=include_muted,
            recipient_id=recipient_id,
            public_only=public_only,
            dm_student_id=dm_student_id,
            actor_id=self._actor.id,
            is_announcement_room=is_announcement_room,
        )

    async def send(
        self,
        course_id: uuid.UUID,
        body: SendMessageRequest,
        room_id: Optional[uuid.UUID] = None,
        room_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """Send a message to a course chat room."""
        is_announcement = getattr(body, "is_announcement", False) or False
        room = await self._get_room_and_verify_access(
            course_id,
            room_id=room_id,
            room_type=room_type,
            is_announcement=is_announcement,
        )

        # If the room itself is an announcement room, every message in it is an announcement
        is_announcement = is_announcement or bool(
            room.room_type in ("announcement", "global_announcement") or room.is_announcement_only
        )

        # Enforce slow mode for students only
        if self._actor.role == UserRole.STUDENT:
            await self._enforce_slow_mode(room.id, room.slow_mode_seconds)

        # Validate reply_to exists in the same room
        if body.reply_to_id:
            parent = await self._msg_repo.get_by_id(body.reply_to_id)
            if parent is None or parent.chat_room_id != room.id:
                raise ResourceNotFoundError(message="Reply-to message not found.")

        message = await self._msg_repo.create(
            chat_room_id=room.id,
            sender_id=self._actor.id,
            recipient_id=body.recipient_id,
            content=body.content,
            content_type=body.content_type,
            reply_to_id=body.reply_to_id,
            attachments=body.attachments,
            is_announcement=is_announcement,  # ← was always False before
        )

        # Increment parent reply count
        if body.reply_to_id:
            await self._msg_repo.increment_reply_count(body.reply_to_id)

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.message_sent",
            entity_type="message",
            entity_id=message.id,
        )

        return {
            "id": str(message.id),
            "chat_room_id": str(message.chat_room_id),
            "sender_id": str(self._actor.id),
            "recipient_id": str(message.recipient_id) if message.recipient_id else None,
            "sender": {
                "id": str(self._actor.id),
                "full_name": self._actor.full_name,
                "avatar_r2_key": self._actor.avatar_r2_key,
                "role": self._actor.role.value if hasattr(self._actor.role, "value") else str(self._actor.role),
            },
            "content": message.content,
            "content_type": message.content_type,
            "reply_to": None,
            "reply_count": 0,
            "is_pinned": False,
            "pinned_at": None,
            "is_announcement": is_announcement,  # ← fixed: reflects actual value
            "is_edited": False,
            "edited_at": None,
            "attachments": message.attachments or [],
            "reactions": {},
            "is_deleted": False,
            "created_at": message.created_at.isoformat() if message.created_at else datetime.utcnow().isoformat(),
            "updated_at": None,
        }


    async def edit(
        self,
        message_id: uuid.UUID,
        body: EditMessageRequest,
    ) -> dict[str, Any]:
        """Edit a message's content.

        Only the original sender or the teacher can edit.

        Args:
            message_id: The message UUID.
            body: The edit payload.

        Returns:
            dict: Updated message payload.

        Raises:
            MessageNotFoundError: If message not found or deleted.
            PermissionDeniedError: If actor is not the sender or teacher.
        """
        message = await self._msg_repo.get_by_id(message_id, with_sender=True)
        if message is None or message.deleted_at is not None:
            raise MessageNotFoundError()

        is_sender = message.sender_id == self._actor.id
        is_teacher = self._actor.role == UserRole.TEACHER
        if not (is_sender or is_teacher):
            raise PermissionDeniedError(
                message="You can only edit your own messages."
            )

        updated = await self._msg_repo.edit(message, body.content)

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.message_edited",
            entity_type="message",
            entity_id=message.id,
        )

        return {"id": updated.id, "content": updated.content, "is_edited": True, "edited_at": updated.edited_at}

    async def delete(
        self,
        message_id: uuid.UUID,
    ) -> None:
        """Soft-delete a message.

        Only the original sender or the teacher can delete.

        Args:
            message_id: The message UUID.

        Raises:
            MessageNotFoundError: If message not found or already deleted.
            PermissionDeniedError: If actor is not the sender or teacher.
        """
        message = await self._msg_repo.get_by_id(message_id, with_sender=True)
        if message is None or message.deleted_at is not None:
            raise MessageNotFoundError()

        is_sender = message.sender_id == self._actor.id
        is_teacher = self._actor.role == UserRole.TEACHER
        if not (is_sender or is_teacher):
            raise PermissionDeniedError(
                message="You can only delete your own messages."
            )

        await self._msg_repo.soft_delete(message)

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.message_deleted",
            entity_type="message",
            entity_id=message.id,
            severity=AuditSeverity.WARNING,
        )

    async def pin(
        self,
        course_id: uuid.UUID,
        message_id: uuid.UUID,
        *,
        pin: bool,
    ) -> dict[str, Any]:
        """Pin or unpin a message (teacher-only).

        Also updates the denormalized room.pinned_message_id.

        Args:
            course_id: The course UUID.
            message_id: The message UUID.
            pin: True to pin, False to unpin.

        Returns:
            dict: Updated message payload.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            MessageNotFoundError: If message not found.
        """
        if self._actor.role != UserRole.TEACHER:
            raise PermissionDeniedError()

        message = await self._msg_repo.get_by_id(message_id)
        if message is None or message.deleted_at is not None:
            raise MessageNotFoundError()

        updated = await self._msg_repo.pin(message, self._actor.id, pin=pin)

        # Update room's pinned_message_id
        room = await self._room_repo.get_by_course_id(course_id)
        if room is not None:
            await self._room_repo.set_pinned_message(
                room, message_id if pin else None
            )

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.message_pinned" if pin else "chat.message_unpinned",
            entity_type="message",
            entity_id=message.id,
        )

        return {"id": updated.id, "is_pinned": updated.is_pinned, "pinned_at": updated.pinned_at}

    async def react(
        self,
        message_id: uuid.UUID,
        emoji: str,
        *,
        add: bool,
    ) -> dict[str, Any]:
        """Add or remove a reaction on a message.

        Args:
            message_id: The message UUID.
            emoji: The emoji string.
            add: True to add, False to remove.

        Returns:
            dict: Updated reactions payload.

        Raises:
            MessageNotFoundError: If message not found or deleted.
        """
        message = await self._msg_repo.get_by_id(message_id)
        if message is None or message.deleted_at is not None:
            raise MessageNotFoundError()

        if add:
            await self._msg_repo.add_reaction(message, self._actor.id, emoji)
        else:
            await self._msg_repo.remove_reaction(message, self._actor.id, emoji)

        return {"message_id": message.id, "reactions": message.reactions}

    async def create_announcement(
        self,
        course_id: uuid.UUID,
        body: CreateAnnouncementRequest,
    ) -> dict[str, Any]:
        """Create a teacher-only announcement in the course chat.

        Optionally pins the announcement to the room header.
        Also inserts a notification for all enrolled students.

        Args:
            course_id: The course UUID.
            body: The announcement payload.

        Returns:
            dict: The created announcement message payload.

        Raises:
            PermissionDeniedError: If caller is not a teacher.
            RoomNotFoundError: If room not found.
        """
        if self._actor.role != UserRole.TEACHER:
            raise PermissionDeniedError()

        room = await self._room_repo.get_by_course_id(course_id, room_type="announcement")
        if room is None:
            room_svc = ChatRoomService(self._db, self._redis, self._actor)
            rooms = await room_svc.ensure_course_rooms(course_id)
            room = next((r for r in rooms if r.room_type == "announcement"), rooms[0])

        message = await self._msg_repo.create(
            chat_room_id=room.id,
            sender_id=self._actor.id,
            content=body.content,
            content_type=MessageContentType.TEXT,
            is_announcement=True,
        )

        if body.pin:
            await self._msg_repo.pin(message, self._actor.id, pin=True)
            await self._room_repo.set_pinned_message(room, message.id)

        _audit(
            self._db,
            actor_id=self._actor.id,
            actor_role=self._actor.role,
            action="chat.announcement_created",
            entity_type="message",
            entity_id=message.id,
        )

        logger.info(
            "Announcement created by teacher %s in course %s",
            self._actor.id,
            course_id,
        )

        return {
            "id": message.id,
            "chat_room_id": message.chat_room_id,
            "sender": {
                "id": self._actor.id,
                "full_name": self._actor.full_name,
                "avatar_r2_key": self._actor.avatar_r2_key,
                "role": self._actor.role,
            },
            "content": message.content,
            "content_type": message.content_type,
            "is_announcement": True,
            "is_pinned": body.pin,
            "pinned_at": message.pinned_at,
            "is_edited": False,
            "edited_at": None,
            "attachments": [],
            "reactions": {},
            "is_deleted": False,
            "created_at": message.created_at,
            "updated_at": None,
        }


# ===========================================================================
# ModerationService
# ===========================================================================


class ModerationService:
    """Teacher-only moderation: delete any message by ID."""

    def __init__(
        self,
        db: AsyncSession,
        teacher: User,
    ) -> None:
        """Initialize ModerationService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._msg_repo = MessageRepository(db)

    async def delete_message(
        self,
        message_id: uuid.UUID,
    ) -> None:
        """Teacher force-deletes any message.

        Args:
            message_id: The message UUID to delete.

        Raises:
            MessageNotFoundError: If not found or already deleted.
        """
        message = await self._msg_repo.get_by_id(message_id)
        if message is None or message.deleted_at is not None:
            raise MessageNotFoundError()

        await self._msg_repo.soft_delete(message)

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="chat.moderation_delete",
            entity_type="message",
            entity_id=message.id,
            severity=AuditSeverity.WARNING,
        )
