"""WebSocket event envelope schemas for the chat module.

All WebSocket frames — both client-to-server and server-to-client — use
the typed envelope pattern::

    { "type": "<EventType>", "payload": {...}, "ts": "<ISO datetime>" }

This module defines:
    - WSEventType: All supported event type strings.
    - Inbound (client→server) event models.
    - Outbound (server→client) event models.
    - The generic WSEnvelope wrapper for serializing outbound frames.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


# ===========================================================================
# Event Type Catalog
# ===========================================================================


class WSEventType:
    """String constants for all WebSocket event types.

    Client → Server (inbound):
        MESSAGE_SEND    Send a new message.
        MESSAGE_EDIT    Edit sender's own message.
        MESSAGE_DELETE  Delete sender's own message.
        MESSAGE_REACT   Add or remove an emoji reaction.
        TYPING_START    User started typing.
        TYPING_STOP     User stopped typing.
        READ_MARK       Mark messages as read up to a cursor.
        PING            Heartbeat ping.

    Server → Client (outbound broadcast):
        MESSAGE_NEW       New message arrived in the room.
        MESSAGE_EDITED    An existing message was edited.
        MESSAGE_DELETED   A message was soft-deleted.
        MESSAGE_REACTED   Reaction map on a message changed.
        MESSAGE_PINNED    A message was pinned.
        MESSAGE_UNPINNED  A message was unpinned.
        TYPING_UPDATE     Typing indicator list changed.
        PRESENCE_UPDATE   A user's online/offline status changed.
        ROOM_LOCKED       Teacher locked the room (read-only).
        ROOM_UNLOCKED     Teacher unlocked the room.
        ROOM_ANNOUNCEMENT Teacher posted an announcement.
        MODERATION_KICKED Student was kicked (sent only to kicked user).
        MODERATION_MUTED  Student was muted.
        MODERATION_UNMUTED Student was unmuted.
        ERROR             Server-side error frame.
        PONG              Heartbeat response.
        CONNECTED         Sent once on successful WebSocket handshake.
    """

    # Client → Server
    MESSAGE_SEND = "message.send"
    MESSAGE_EDIT = "message.edit"
    MESSAGE_DELETE = "message.delete"
    MESSAGE_REACT = "message.react"
    TYPING_START = "typing.start"
    TYPING_STOP = "typing.stop"
    READ_MARK = "read.mark"
    PING = "ping"

    # Server → Client
    MESSAGE_NEW = "message.new"
    MESSAGE_EDITED = "message.edited"
    MESSAGE_DELETED = "message.deleted"
    MESSAGE_REACTED = "message.reacted"
    MESSAGE_PINNED = "message.pinned"
    MESSAGE_UNPINNED = "message.unpinned"
    TYPING_UPDATE = "typing.update"
    PRESENCE_UPDATE = "presence.update"
    ROOM_LOCKED = "room.locked"
    ROOM_UNLOCKED = "room.unlocked"
    ROOM_ANNOUNCEMENT = "room.announcement"
    MODERATION_KICKED = "moderation.kicked"
    MODERATION_MUTED = "moderation.muted"
    MODERATION_UNMUTED = "moderation.unmuted"
    ERROR = "error"
    PONG = "pong"
    CONNECTED = "connected"


# ===========================================================================
# Inbound Frames (Client → Server)
# ===========================================================================


class InboundFrame(BaseModel):
    """Base class for all client-to-server WebSocket frames.

    Attributes:
        type: The event type string from WSEventType.
        payload: Arbitrary event-specific payload dict.
    """

    type: str
    payload: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "ignore"}


class SendMessagePayload(BaseModel):
    """Payload for message.send inbound event.

    Attributes:
        content: Message text (1–4000 chars).
        content_type: Message content type (text/image/file/video/audio).
        reply_to_id: Optional parent message UUID for reply threading.
        attachments: Optional list of attachment metadata dicts.
    """

    content: str = Field(min_length=1, max_length=4000)
    content_type: str = Field(default="text")
    reply_to_id: Optional[str] = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class EditMessagePayload(BaseModel):
    """Payload for message.edit inbound event.

    Attributes:
        message_id: UUID of the message to edit.
        content: New message text.
    """

    message_id: str
    content: str = Field(min_length=1, max_length=4000)


class DeleteMessagePayload(BaseModel):
    """Payload for message.delete inbound event.

    Attributes:
        message_id: UUID of the message to delete.
    """

    message_id: str


class ReactPayload(BaseModel):
    """Payload for message.react inbound event.

    Attributes:
        message_id: UUID of the message to react to.
        emoji: Emoji string (1–10 chars).
        action: 'add' or 'remove'.
    """

    message_id: str
    emoji: str = Field(min_length=1, max_length=10)
    action: Literal["add", "remove"] = "add"


class ReadMarkPayload(BaseModel):
    """Payload for read.mark inbound event.

    Attributes:
        last_read_message_id: UUID of the last message the user has read.
    """

    last_read_message_id: str


# ===========================================================================
# Outbound Frames (Server → Client)
# ===========================================================================


class WSEnvelope(BaseModel):
    """Generic outbound WebSocket frame envelope.

    All server-to-client frames are serialized as this envelope.

    Attributes:
        type: The event type string from WSEventType.
        payload: Event-specific payload dict.
        ts: Server UTC timestamp when the event was emitted.
        room_id: Optional room scope for the event.
    """

    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    ts: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    room_id: Optional[str] = None

    def to_json(self) -> str:
        """Serialize the envelope to a JSON string for WebSocket transmission.

        Returns:
            str: JSON string representation of the envelope.
        """
        return self.model_dump_json()


def make_envelope(
    event_type: str,
    payload: dict[str, Any],
    room_id: Optional[str] = None,
) -> WSEnvelope:
    """Construct a WSEnvelope with the given type and payload.

    Args:
        event_type: One of WSEventType constants.
        payload: Event-specific data dict.
        room_id: Optional room scope string.

    Returns:
        WSEnvelope: Ready-to-serialize envelope.
    """
    return WSEnvelope(type=event_type, payload=payload, room_id=room_id)


# ---------------------------------------------------------------------------
# Specific outbound payload helpers
# ---------------------------------------------------------------------------


def message_new_payload(message: dict[str, Any]) -> dict[str, Any]:
    """Build payload for a message.new outbound event.

    Args:
        message: Serialized message dict (from MessageService.send).

    Returns:
        dict[str, Any]: Formatted payload for the message.new envelope.
    """
    return {"message": message}


def message_edited_payload(
    message_id: str,
    content: str,
    edited_at: str,
    editor_id: str,
) -> dict[str, Any]:
    """Build payload for a message.edited outbound event.

    Args:
        message_id: UUID string of the edited message.
        content: New message content.
        edited_at: ISO timestamp of the edit.
        editor_id: UUID string of the editor.

    Returns:
        dict[str, Any]: Formatted payload for message.edited.
    """
    return {
        "message_id": message_id,
        "content": content,
        "edited_at": edited_at,
        "editor_id": editor_id,
    }


def message_deleted_payload(message_id: str, deleted_by: str) -> dict[str, Any]:
    """Build payload for a message.deleted outbound event.

    Args:
        message_id: UUID string of the deleted message.
        deleted_by: UUID string of the actor who deleted it.

    Returns:
        dict[str, Any]: Formatted payload for message.deleted.
    """
    return {"message_id": message_id, "deleted_by": deleted_by}


def typing_update_payload(
    room_id: str,
    typing_user_ids: list[str],
) -> dict[str, Any]:
    """Build payload for a typing.update outbound event.

    Args:
        room_id: The chat room UUID string.
        typing_user_ids: List of user UUID strings currently typing.

    Returns:
        dict[str, Any]: Formatted payload for typing.update.
    """
    return {"room_id": room_id, "typing": typing_user_ids}


def presence_update_payload(
    user_id: str,
    status: str,
    last_seen: Optional[str] = None,
) -> dict[str, Any]:
    """Build payload for a presence.update outbound event.

    Args:
        user_id: UUID string of the affected user.
        status: 'online' | 'offline' | 'idle' | 'away'.
        last_seen: Optional ISO timestamp of last activity.

    Returns:
        dict[str, Any]: Formatted payload for presence.update.
    """
    return {"user_id": user_id, "status": status, "last_seen": last_seen}


def error_payload(code: str, detail: str) -> dict[str, Any]:
    """Build payload for an error outbound event.

    Args:
        code: Short error code string.
        detail: Human-readable error description.

    Returns:
        dict[str, Any]: Formatted payload for error event.
    """
    return {"code": code, "detail": detail}


def connected_payload(
    user_id: str,
    room_id: str,
    online_count: int,
) -> dict[str, Any]:
    """Build payload for the connected confirmation frame.

    Args:
        user_id: UUID string of the connected user.
        room_id: Room UUID string that was joined.
        online_count: Number of currently online users in the room.

    Returns:
        dict[str, Any]: Formatted payload for connected event.
    """
    return {
        "user_id": user_id,
        "room_id": room_id,
        "online_count": online_count,
    }
