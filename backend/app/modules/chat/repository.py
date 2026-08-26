"""Chat module — repository layer.

All database I/O for the chat module. No business logic.

Repositories:
    ChatRoomRepository    CRUD for ChatRoom.
    MessageRepository     CRUD for Message and MessageReaction.
    ModerationRepository  Read access for muted/banned student lists.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatRoom, Message, MessageReaction
from app.models.course import Course, CourseEnrollment
from app.models.enums import EnrollmentStatus, MessageContentType
from app.models.user import User


# ===========================================================================
# ChatRoomRepository
# ===========================================================================


class ChatRoomRepository:
    """CRUD for ChatRoom records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        course_id: uuid.UUID,
        name: str,
        description: Optional[str] = None,
        room_type: str = "general",
        is_announcement_only: bool = False,
    ) -> ChatRoom:
        """Create a new chat room for a course.

        Args:
            course_id: The course UUID.
            name: Room display name.
            description: Optional room description.
            room_type: 'announcement' or 'general'.
            is_announcement_only: Whether only teachers can send messages.

        Returns:
            ChatRoom: The newly created room.
        """
        room = ChatRoom(
            course_id=course_id,
            name=name,
            description=description,
            room_type=room_type,
            is_announcement_only=is_announcement_only,
        )
        self._db.add(room)
        await self._db.flush()
        return room

    async def list_by_course_id(
        self,
        course_id: uuid.UUID,
    ) -> list[ChatRoom]:
        """Fetch all chat rooms for a given course.

        Args:
            course_id: The course UUID.

        Returns:
            list[ChatRoom]: List of active rooms for the course.
        """
        stmt = (
            select(ChatRoom)
            .where(ChatRoom.course_id == course_id, ChatRoom.is_active.is_(True))
            .order_by(ChatRoom.room_type.asc(), ChatRoom.created_at.asc())
        )
        return list((await self._db.scalars(stmt)).all())

    async def get_by_course_id(
        self,
        course_id: uuid.UUID,
        room_type: Optional[str] = None,
    ) -> Optional[ChatRoom]:
        """Fetch a specific chat room for a given course by type.

        Args:
            course_id: The course UUID.
            room_type: Optional room type ('general' or 'announcement').

        Returns:
            ChatRoom | None: The room, or None.
        """
        stmt = select(ChatRoom).where(ChatRoom.course_id == course_id, ChatRoom.is_active.is_(True))
        if room_type:
            stmt = stmt.where(ChatRoom.room_type == room_type)
        stmt = stmt.order_by(ChatRoom.created_at.asc())
        rooms = (await self._db.scalars(stmt)).all()
        return rooms[0] if rooms else None

    async def list_all_rooms(self) -> list[dict[str, Any]]:
        """Return all chat rooms with joined course details."""
        stmt = (
            select(
                ChatRoom,
                Course.title.label("course_title"),
                Course.teacher_id.label("teacher_id"),
                Course.status.label("course_status"),
            )
            .join(Course, Course.id == ChatRoom.course_id)
            .where(ChatRoom.is_active.is_(True), Course.deleted_at.is_(None))
            .order_by(Course.title.asc(), ChatRoom.room_type.asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "id": str(r.ChatRoom.id),
                "course_id": str(r.ChatRoom.course_id),
                "name": r.ChatRoom.name,
                "room_type": r.ChatRoom.room_type,
                "is_announcement_only": r.ChatRoom.is_announcement_only,
                "description": r.ChatRoom.description,
                "is_active": r.ChatRoom.is_active,
                "slow_mode_seconds": r.ChatRoom.slow_mode_seconds,
                "course_title": r.course_title,
                "teacher_id": str(r.teacher_id),
                "course_status": r.course_status,
                "created_at": r.ChatRoom.created_at.isoformat() if r.ChatRoom.created_at else None,
            }
            for r in rows
        ]


    async def get_by_id(
        self,
        room_id: uuid.UUID,
    ) -> Optional[ChatRoom]:
        """Fetch a chat room by primary key.

        Args:
            room_id: The chat room UUID.

        Returns:
            ChatRoom | None: The room, or None.
        """
        return (
            await self._db.execute(
                select(ChatRoom).where(ChatRoom.id == room_id)
            )
        ).scalar_one_or_none()

    async def update(
        self,
        room: ChatRoom,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        slow_mode_seconds: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> ChatRoom:
        """Update room settings.

        Args:
            room: The ChatRoom ORM instance.
            name: New display name.
            description: New description.
            slow_mode_seconds: New slow mode cooldown.
            is_active: New active state.

        Returns:
            ChatRoom: The updated room.
        """
        if name is not None:
            room.name = name
        if description is not None:
            room.description = description
        if slow_mode_seconds is not None:
            room.slow_mode_seconds = slow_mode_seconds
        if is_active is not None:
            room.is_active = is_active
        await self._db.flush()
        return room

    async def set_pinned_message(
        self,
        room: ChatRoom,
        message_id: Optional[uuid.UUID],
    ) -> None:
        """Set or clear the pinned_message_id on the room.

        Args:
            room: The ChatRoom ORM instance.
            message_id: The message UUID to pin, or None to clear.
        """
        room.pinned_message_id = message_id
        await self._db.flush()


# ===========================================================================
# MessageRepository
# ===========================================================================


def _format_attachments(attachments: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    from app.core.storage.r2 import get_public_url
    formatted = []
    for att in attachments or []:
        if isinstance(att, dict):
            att_copy = dict(att)
            r2_key = att_copy.get("r2_key") or ""
            url = att_copy.get("url") or ""
            if not (url.startswith("http://") or url.startswith("https://") or url.startswith("data:")):
                public_url = get_public_url(r2_key) if r2_key else None
                if not public_url and r2_key:
                    public_url = f"https://storage.speakarena.com/{r2_key.lstrip('/')}"
                att_copy["url"] = public_url or url or r2_key
            formatted.append(att_copy)
    return formatted


class MessageRepository:
    """CRUD for Message and MessageReaction records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        chat_room_id: uuid.UUID,
        sender_id: uuid.UUID,
        content: str,
        content_type: str = MessageContentType.TEXT,
        reply_to_id: Optional[uuid.UUID] = None,
        recipient_id: Optional[uuid.UUID] = None,
        attachments: Optional[list[dict[str, Any]]] = None,
        is_announcement: bool = False,
        is_muted_user_message: bool = False,
    ) -> Message:
        """Create and persist a new message."""
        message = Message(
            chat_room_id=chat_room_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            content=content,
            content_type=content_type,
            reply_to_id=reply_to_id,
            attachments=attachments or [],
            is_announcement=is_announcement,
            is_muted_user_message=is_muted_user_message,
        )
        self._db.add(message)
        await self._db.flush()
        return message

    async def get_by_id(
        self,
        message_id: uuid.UUID,
        *,
        with_sender: bool = False,
    ) -> Optional[Message]:
        """Fetch a message by primary key.

        Args:
            message_id: The message UUID.
            with_sender: If True, eagerly load sender relationship.

        Returns:
            Message | None: The message, or None.
        """
        stmt = select(Message).where(Message.id == message_id)
        if with_sender:
            stmt = stmt.options(selectinload(Message.sender))
        return (
            await self._db.execute(stmt)
        ).scalar_one_or_none()

    async def list_messages(
        self,
        chat_room_id: uuid.UUID,
        *,
        before: Optional[datetime] = None,
        limit: int = 50,
        announcements_only: bool = False,
        include_muted: bool = False,
        recipient_id: Optional[uuid.UUID] = None,
        public_only: bool = False,
        dm_student_id: Optional[uuid.UUID] = None,
        actor_id: Optional[uuid.UUID] = None,
        is_announcement_room: bool = False,
    ) -> list[dict[str, Any]]:
        """Return messages for a chat room with cursor-based pagination."""
        target_dm_user_id = dm_student_id or recipient_id

        conditions = [
            Message.deleted_at.is_(None),
        ]
        # For DM threads, search across all rooms for the user pair.
        # For course discussions or announcements, scope to the specific chat room.
        if not (target_dm_user_id and actor_id):
            conditions.append(Message.chat_room_id == chat_room_id)

        if before:
            conditions.append(Message.created_at < before)
        if not include_muted:
            conditions.append(Message.is_muted_user_message.is_(False))

        if announcements_only or is_announcement_room:
            conditions.append(Message.recipient_id.is_(None))
        elif public_only:
            conditions.append(Message.recipient_id.is_(None))
            conditions.append(Message.is_announcement.is_(False))
        elif target_dm_user_id and actor_id:
            conditions.append(Message.is_announcement.is_(False))
            conditions.append(
                or_(
                    and_(Message.sender_id == actor_id, Message.recipient_id == target_dm_user_id),
                    and_(Message.sender_id == target_dm_user_id, Message.recipient_id == actor_id),
                )
            )

        # Sender alias
        SenderUser = User

        stmt = (
            select(
                Message.id,
                Message.chat_room_id,
                Message.recipient_id,
                Message.content,
                Message.content_type,
                Message.reply_to_id,
                Message.reply_count,
                Message.is_pinned,
                Message.pinned_at,
                Message.is_announcement,
                Message.is_edited,
                Message.edited_at,
                Message.attachments,
                Message.reactions,
                Message.created_at,
                Message.updated_at,
                SenderUser.id.label("sender_id"),
                SenderUser.full_name.label("sender_name"),
                SenderUser.avatar_r2_key.label("sender_avatar"),
                SenderUser.role.label("sender_role"),
            )
            .join(SenderUser, SenderUser.id == Message.sender_id)
            .where(and_(*conditions))
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()

        # Resolve reply_to previews in bulk
        reply_ids = {r.reply_to_id for r in rows if r.reply_to_id}
        reply_map: dict[uuid.UUID, dict[str, Any]] = {}
        if reply_ids:
            reply_stmt = (
                select(
                    Message.id,
                    Message.content,
                    User.full_name.label("sender_name"),
                )
                .join(User, User.id == Message.sender_id)
                .where(Message.id.in_(reply_ids))
            )
            for r in (await self._db.execute(reply_stmt)).all():
                reply_map[r.id] = {
                    "id": str(r.id),
                    "content": r.content[:100],
                    "sender_name": r.sender_name,
                }

        return [
            {
                "id": str(r.id),
                "chat_room_id": str(r.chat_room_id),
                "sender_id": str(r.sender_id),
                "recipient_id": str(r.recipient_id) if r.recipient_id else None,
                "sender": {
                    "id": str(r.sender_id),
                    "full_name": r.sender_name,
                    "avatar_r2_key": r.sender_avatar,
                    "role": r.sender_role.value if hasattr(r.sender_role, "value") else str(r.sender_role),
                },
                "content": r.content,
                "content_type": r.content_type,
                "reply_to": reply_map.get(r.reply_to_id) if r.reply_to_id else None,
                "reply_count": r.reply_count,
                "is_pinned": r.is_pinned,
                "pinned_at": r.pinned_at.isoformat() if r.pinned_at else None,
                "is_announcement": r.is_announcement,
                "is_edited": r.is_edited,
                "edited_at": r.edited_at.isoformat() if r.edited_at else None,
                "attachments": _format_attachments(r.attachments),
                "reactions": r.reactions or {},
                "is_deleted": False,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]

    async def soft_delete(
        self,
        message: Message,
    ) -> None:
        """Soft-delete a message, replacing content with a tombstone.

        Sets deleted_at, replaces content with '[Message deleted]',
        and clears attachments and reactions.

        Args:
            message: The Message ORM instance to soft-delete.
        """
        message.deleted_at = datetime.now(timezone.utc)
        message.content = "[Message deleted]"
        message.attachments = []
        message.reactions = {}
        await self._db.flush()

    async def edit(
        self,
        message: Message,
        content: str,
    ) -> Message:
        """Edit a message's content and mark it as edited.

        Args:
            message: The Message ORM instance.
            content: New message content.

        Returns:
            Message: The updated message.
        """
        message.content = content
        message.is_edited = True
        message.edited_at = datetime.now(timezone.utc)
        await self._db.flush()
        return message

    async def pin(
        self,
        message: Message,
        pinned_by: uuid.UUID,
        *,
        pin: bool,
    ) -> Message:
        """Pin or unpin a message.

        Args:
            message: The Message ORM instance.
            pinned_by: UUID of the teacher performing the action.
            pin: True to pin, False to unpin.

        Returns:
            Message: The updated message.
        """
        message.is_pinned = pin
        if pin:
            message.pinned_at = datetime.now(timezone.utc)
            message.pinned_by = pinned_by
        else:
            message.pinned_at = None
            message.pinned_by = None
        await self._db.flush()
        return message

    async def increment_reply_count(
        self,
        parent_id: uuid.UUID,
    ) -> None:
        """Increment the reply_count denormalized counter on a parent message.

        Args:
            parent_id: UUID of the parent message.
        """
        await self._db.execute(
            update(Message)
            .where(Message.id == parent_id)
            .values(reply_count=Message.reply_count + 1)
        )
        await self._db.flush()

    async def add_reaction(
        self,
        message: Message,
        user_id: uuid.UUID,
        emoji: str,
    ) -> bool:
        """Add a reaction to a message.

        Updates both the JSONB reactions column and the normalized
        message_reactions table. Returns False if the reaction already exists.

        Args:
            message: The Message ORM instance.
            user_id: The reacting user's UUID.
            emoji: The emoji string.

        Returns:
            bool: True if added, False if already exists (idempotent).
        """
        user_id_str = str(user_id)
        reactions: dict[str, list[str]] = dict(message.reactions)

        existing = reactions.get(emoji, [])
        if user_id_str in existing:
            return False

        reactions[emoji] = existing + [user_id_str]
        message.reactions = reactions
        await self._db.flush()

        # Normalized table insert (idempotent via PK)
        try:
            reaction_record = MessageReaction(
                message_id=message.id,
                user_id=user_id,
                emoji=emoji,
            )
            self._db.add(reaction_record)
            await self._db.flush()
        except Exception:
            # PK conflict — reaction already in normalized table.
            await self._db.rollback()
        return True

    async def remove_reaction(
        self,
        message: Message,
        user_id: uuid.UUID,
        emoji: str,
    ) -> bool:
        """Remove a reaction from a message.

        Args:
            message: The Message ORM instance.
            user_id: The reacting user's UUID.
            emoji: The emoji string.

        Returns:
            bool: True if removed, False if reaction did not exist.
        """
        user_id_str = str(user_id)
        reactions: dict[str, list[str]] = dict(message.reactions)

        existing = reactions.get(emoji, [])
        if user_id_str not in existing:
            return False

        updated = [u for u in existing if u != user_id_str]
        if updated:
            reactions[emoji] = updated
        else:
            del reactions[emoji]
        message.reactions = reactions
        await self._db.flush()

        # Delete from normalized table
        from sqlalchemy import delete
        await self._db.execute(
            delete(MessageReaction).where(
                MessageReaction.message_id == message.id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji,
            )
        )
        await self._db.flush()
        return True

    async def count_in_room(
        self,
        chat_room_id: uuid.UUID,
    ) -> int:
        """Return the total non-deleted message count for a room.

        Args:
            chat_room_id: The chat room UUID.

        Returns:
            int: Total message count.
        """
        return (
            await self._db.execute(
                select(func.count(Message.id)).where(
                    Message.chat_room_id == chat_room_id,
                    Message.deleted_at.is_(None),
                )
            )
        ).scalar_one()


# ===========================================================================
# ModerationRepository
# ===========================================================================


class ModerationRepository:
    """Reads enrollment data for moderation checks."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def is_enrolled(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> bool:
        """Check if a student has an active enrollment in a course.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            bool: True if the student is actively enrolled.
        """
        count = (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == course_id,
                    CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                )
            )
        ).scalar_one()
        return count > 0
