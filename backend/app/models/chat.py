"""Chat module models.

ChatRoom       : One per course. Auto-created on course creation.
Message        : Full-featured messages with edit, reply, pin, announcement support.
MessageReaction: Normalized reaction store for structured queries.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MessageContentType

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class ChatRoom(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Course chat room. One per course, created at course creation time.

    pinned_message_id is a denormalized reference to the latest pinned
    message for fast header display without a JOIN. It is managed by
    the chat service and set to NULL when a message is unpinned.
    slow_mode_seconds=0 means no throttle. Non-zero values are enforced
    via Redis TTL per user+room key in the message send service.
    """

    __tablename__ = "chat_rooms"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    room_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general", server_default="general"
    )
    is_announcement_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    slow_mode_seconds: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    pinned_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="Denormalized latest pinned message for fast header render.",
    )

    # --- Relationships ---
    course: Mapped[Course] = relationship("Course", back_populates="chat_rooms")
    messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="chat_room",
        foreign_keys="Message.chat_room_id",
        lazy="raise",
    )
    pinned_message: Mapped[Optional[Message]] = relationship(
        "Message",
        foreign_keys=[pinned_message_id],
        uselist=False,
        lazy="selectin",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<ChatRoom course={self.course_id}>"


class Message(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Chat message with reply, edit, pin, and announcement support.

    Soft-deleted messages retain a tombstone row. On soft delete, the
    service layer sets content='[Message deleted]' and clears attachments
    and reactions. Raw bytes are removed from R2.

    The reactions JSONB column stores {emoji: [user_id_str, ...]} for
    O(1) read performance during message rendering. The message_reactions
    table provides normalized storage for structured queries.

    is_muted_user_message=True means the message was sent by a muted
    student. It is stored but hidden from other students; only the
    teacher can see it via the moderation panel.
    """

    __tablename__ = "messages"

    chat_room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
        comment="Recipient user UUID for 1-on-1 direct messages.",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=MessageContentType.TEXT,
        server_default="text",
    )
    reply_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
    )
    reply_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0",
        comment="Denormalized count of direct replies.",
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    pinned_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    pinned_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    is_announcement: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_edited: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    edited_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    attachments: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
        comment="Array of {r2_key, file_name, mime_type, size_bytes}.",
    )
    reactions: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment="Map of {emoji_codepoint: [user_id_str, ...]}.",
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    is_muted_user_message: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        comment="Hidden from students; visible only in teacher moderation panel.",
    )

    # --- Relationships ---
    chat_room: Mapped[ChatRoom] = relationship(
        "ChatRoom", back_populates="messages", foreign_keys=[chat_room_id]
    )
    sender: Mapped[User] = relationship(
        "User", back_populates="sent_messages", foreign_keys=[sender_id]
    )
    pinner: Mapped[Optional[User]] = relationship(
        "User", foreign_keys=[pinned_by]
    )
    reply_to: Mapped[Optional[Message]] = relationship(
        "Message",
        remote_side="Message.id",
        foreign_keys=[reply_to_id],
        uselist=False,
    )
    replies: Mapped[list[Message]] = relationship(
        "Message",
        foreign_keys=[reply_to_id],
        overlaps="reply_to",
        lazy="raise",
    )
    reactions_normalized: Mapped[list[MessageReaction]] = relationship(
        "MessageReaction",
        back_populates="message",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Message id={self.id} room={self.chat_room_id}>"


class MessageReaction(Base):
    """Normalized per-user per-emoji reaction record.

    Provides structured reaction querying (e.g. who reacted with a given
    emoji) while the messages.reactions JSONB maintains O(1) read
    performance for rendering aggregate counts in the UI.

    Composite primary key (message_id, user_id, emoji) enforces one
    reaction per emoji per user per message at the database level.
    """

    __tablename__ = "message_reactions"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    emoji: Mapped[str] = mapped_column(String(10), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    message: Mapped[Message] = relationship(
        "Message", back_populates="reactions_normalized"
    )
    user: Mapped[User] = relationship("User")

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<MessageReaction msg={self.message_id} emoji={self.emoji}>"
