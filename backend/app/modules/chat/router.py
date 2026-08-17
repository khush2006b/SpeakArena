"""Chat module — router.

Mounts at /api/v1/chat.

Endpoints:
    GET  /chat/{course_id}                 Room detail (student+teacher).
    PATCH /chat/{course_id}/settings        Update room settings (teacher).
    GET  /chat/{course_id}/messages         List messages (cursor-based).
    POST /chat/{course_id}/messages         Send a message (student+teacher).
    PATCH /chat/{course_id}/messages/{id}   Edit a message.
    DELETE /chat/{course_id}/messages/{id}  Delete a message.
    POST /chat/{course_id}/messages/{id}/pin    Pin (teacher).
    DELETE /chat/{course_id}/messages/{id}/pin  Unpin (teacher).
    POST /chat/{course_id}/messages/{id}/react  Add reaction.
    DELETE /chat/{course_id}/messages/{id}/react Remove reaction.
    POST /chat/{course_id}/announcements    Create announcement (teacher).
    DELETE /chat/{course_id}/messages/{id}/moderate  Teacher force-delete.
    POST /chat/{course_id}/attachments/presign  Get R2 upload URL.

Access:
    All endpoints require authentication.
    Students must be enrolled in the course.
    Teacher-only endpoints use get_current_teacher.
    Mixed-access endpoints use get_current_user and enforce role checks
    in the service layer.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis.client import get_redis
from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import get_current_teacher, get_current_user
from app.modules.chat.repository import ChatRoomRepository
from app.modules.chat.schemas import (
    AttachmentPresignRequest,
    CreateAnnouncementRequest,
    EditMessageRequest,
    MessageListParams,
    ReactRequest,
    SendMessageRequest,
    UpdateRoomSettingsRequest,
)
from app.modules.chat.service import (
    ChatRoomService,
    MessageService,
    ModerationService,
)
from app.modules.chat.ws_manager import ConnectionManager
from app.modules.chat.ws_schemas import WSEventType, make_envelope, message_new_payload

router = APIRouter(prefix="/chat", tags=["Chat"])


def _json_ready(val: Any) -> Any:
    if isinstance(val, dict):
        return {k: _json_ready(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_json_ready(v) for v in val]
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, enum.Enum):
        return val.value
    return val


async def _broadcast_new_message(db: AsyncSession, redis: Redis, course_id: uuid.UUID, data: dict[str, Any]) -> None:
    try:
        json_data = _json_ready(data)
        recipient_id = json_data.get("recipient_id")
        manager = ConnectionManager()

        if recipient_id:
            # For direct messages: broadcast across all chat rooms so whichever course room
            # socket the sender or recipient is connected to, they receive the real-time frame
            stmt = select(ChatRoom.id)
            room_ids = (await db.execute(stmt)).scalars().all()
            for rid in room_ids:
                envelope = make_envelope(
                    WSEventType.MESSAGE_NEW,
                    message_new_payload(json_data),
                    room_id=str(rid),
                )
                await manager.broadcast_to_room(redis, str(rid), envelope)
        else:
            room = await ChatRoomRepository(db).get_by_course_id(course_id)
            if room:
                envelope = make_envelope(
                    WSEventType.MESSAGE_NEW,
                    message_new_payload(json_data),
                    room_id=str(room.id),
                )
                await manager.broadcast_to_room(redis, str(room.id), envelope)
    except Exception as exc:
        logger.error("Error broadcasting message: %s", exc)


# ===========================================================================
# Room Endpoints
# ===========================================================================


@router.get(
    "/rooms/all",
    summary="Get all chat rooms (teacher only)",
    description="Returns all course chat rooms on the platform for teachers.",
)
async def get_all_rooms(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return all platform chat rooms."""
    svc = ChatRoomService(db, redis, teacher)
    data = await svc.get_all_rooms()
    return success_response(data)


@router.get(
    "/{course_id}",
    summary="Get chat room",
    description=(
        "Returns the chat room for a course. "
        "Students must be enrolled. Teachers have unrestricted access."
    ),
)
async def get_room(

    course_id: uuid.UUID,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return chat room detail."""
    svc = ChatRoomService(db, redis, actor)
    data = await svc.get_room(course_id)
    return success_response(data)


@router.patch(
    "/{course_id}/settings",
    summary="Update room settings (teacher)",
    description="Update chat room name, description, slow mode, and active state.",
)
async def update_room_settings(
    course_id: uuid.UUID,
    body: UpdateRoomSettingsRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Update chat room settings."""
    svc = ChatRoomService(db, redis, teacher)
    data = await svc.update_settings(course_id, body)
    await db.commit()
    return success_response(data, message="Room settings updated.")


# ===========================================================================
# Message Endpoints
# ===========================================================================


@router.get(
    "/{course_id}/messages",
    summary="List messages",
    description=(
        "Returns messages for the course chat room, newest-first. "
        "Use the 'before' cursor for infinite scroll pagination. "
        "Students see non-muted messages only. Teachers see all messages."
    ),
)
async def list_messages(
    course_id: uuid.UUID,
    params: MessageListParams = Depends(),
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """List messages for a course chat room."""
    svc = MessageService(db, redis, actor)
    messages = await svc.list_messages(
        course_id,
        before=params.before,
        limit=params.limit,
        announcements_only=params.announcements_only,
        recipient_id=params.recipient_id,
        public_only=params.public_only,
        dm_student_id=params.dm_student_id,
    )

    return success_response({"messages": messages, "count": len(messages)})


@router.post(
    "/{course_id}/messages",
    summary="Send a message",
    description=(
        "Send a message to the course chat room. "
        "Slow mode is enforced for students if configured. "
        "Supports text, image, file, video, audio content types."
    ),
    status_code=201,
)
async def send_message(
    course_id: uuid.UUID,
    body: SendMessageRequest,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Send a message."""
    svc = MessageService(db, redis, actor)
    data = await svc.send(course_id, body)
    await db.commit()
    await _broadcast_new_message(db, redis, course_id, data)
    return success_response(data, status_code=201)


@router.patch(
    "/{course_id}/messages/{message_id}",
    summary="Edit a message",
    description="Edit the content of a message. Only the sender or teacher can edit.",
)
async def edit_message(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    body: EditMessageRequest,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Edit a message."""
    svc = MessageService(db, redis, actor)
    data = await svc.edit(message_id, body)
    await db.commit()
    return success_response(data)


@router.delete(
    "/{course_id}/messages/{message_id}",
    summary="Delete a message",
    description="Soft-delete a message. Only the sender or teacher can delete.",
    status_code=204,
)
async def delete_message(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Response:
    """Soft-delete a message."""
    svc = MessageService(db, redis, actor)
    await svc.delete(message_id)
    await db.commit()
    return Response(status_code=204)


# ===========================================================================
# Pin Endpoints (teacher-only)
# ===========================================================================


@router.post(
    "/{course_id}/messages/{message_id}/pin",
    summary="Pin a message (teacher)",
    description=(
        "Pin a message to the room header. "
        "Also updates the room's pinned_message_id denormalized field."
    ),
)
async def pin_message(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Pin a message."""
    svc = MessageService(db, redis, teacher)
    data = await svc.pin(course_id, message_id, pin=True)
    await db.commit()
    return success_response(data, message="Message pinned.")


@router.delete(
    "/{course_id}/messages/{message_id}/pin",
    summary="Unpin a message (teacher)",
    status_code=204,
)
async def unpin_message(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Response:
    """Unpin a message."""
    svc = MessageService(db, redis, teacher)
    await svc.pin(course_id, message_id, pin=False)
    await db.commit()
    return Response(status_code=204)


# ===========================================================================
# Reaction Endpoints
# ===========================================================================


@router.post(
    "/{course_id}/messages/{message_id}/react",
    summary="Add reaction",
    description="Add an emoji reaction to a message.",
)
async def add_reaction(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    body: ReactRequest,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Add a reaction."""
    svc = MessageService(db, redis, actor)
    data = await svc.react(message_id, body.emoji, add=True)
    await db.commit()
    return success_response(data)


@router.delete(
    "/{course_id}/messages/{message_id}/react",
    summary="Remove reaction",
    description="Remove an emoji reaction from a message.",
    status_code=204,
)
async def remove_reaction(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    body: ReactRequest,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> Response:
    """Remove a reaction."""
    svc = MessageService(db, redis, actor)
    await svc.react(message_id, body.emoji, add=False)
    await db.commit()
    return Response(status_code=204)


# ===========================================================================
# Announcement Endpoint (teacher-only)
# ===========================================================================


@router.post(
    "/{course_id}/announcements",
    summary="Create announcement (teacher)",
    description=(
        "Create a teacher-only announcement in the course chat. "
        "Announcements are pinned to the room header by default."
    ),
    status_code=201,
)
async def create_announcement(
    course_id: uuid.UUID,
    body: CreateAnnouncementRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Create a course announcement."""
    svc = MessageService(db, redis, teacher)
    data = await svc.create_announcement(course_id, body)
    await db.commit()
    await _broadcast_new_message(db, redis, course_id, data)
    return success_response(data, status_code=201)


# ===========================================================================
# Moderation Endpoint (teacher-only)
# ===========================================================================


@router.delete(
    "/{course_id}/messages/{message_id}/moderate",
    summary="Force-delete message (teacher)",
    description="Teacher permanently soft-deletes any message. Logged in audit trail.",
    status_code=204,
)
async def moderate_delete(
    course_id: uuid.UUID,
    message_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Teacher force-deletes a message."""
    svc = ModerationService(db, teacher)
    await svc.delete_message(message_id)
    await db.commit()
    return Response(status_code=204)


# ===========================================================================
# Attachment Presign Endpoint
# ===========================================================================


@router.post(
    "/{course_id}/attachments/presign",
    summary="Get attachment upload URL",
    description=(
        "Generates a presigned R2 PUT URL for uploading a chat attachment. "
        "Supports images, PDFs, and audio files up to 50 MB."
    ),
)
async def get_attachment_upload_url(
    course_id: uuid.UUID,
    body: AttachmentPresignRequest,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return a presigned URL for chat attachment upload."""
    from app.core.storage import r2
    import re

    # Validate MIME type
    allowed_prefixes = ("image/", "application/pdf", "audio/", "video/")
    if not any(body.content_type.startswith(p) for p in allowed_prefixes):
        from app.core.exceptions.errors import AppError
        raise AppError(
            message="Unsupported file type for chat attachments.",
            error_code="UnsupportedMimeType",
        )

    r2_key = f"chat/{course_id}/attachments/{actor.id}/{body.file_name}"
    upload_url = await r2.generate_presigned_upload_url(
        r2_key,
        content_type=body.content_type,
        expiry_seconds=900,
    )
    return success_response({
        "upload_url": upload_url,
        "r2_key": r2_key,
        "expires_in_seconds": 900,
    })


# ===========================================================================
# Phase 11 — Search Endpoints
# ===========================================================================


@router.get(
    "/{course_id}/search",
    summary="Search messages",
    description=(
        "Full-text message search within a course chat room. "
        "Supports date filters, sender filter, content type filter, "
        "and announcements-only mode. Students see non-muted messages only."
    ),
)
async def search_messages(
    course_id: uuid.UUID,
    q: str,
    before: Optional[datetime] = None,
    after: Optional[datetime] = None,
    sender_id: Optional[uuid.UUID] = None,
    content_type: Optional[str] = None,
    announcements_only: bool = False,
    page: int = 1,
    page_size: int = 30,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Search messages in a course chat room."""
    from app.modules.chat.search import ChatSearchService
    svc = ChatSearchService(db, actor)
    results = await svc.search_messages(
        course_id,
        q,
        before=before,
        after=after,
        sender_id=sender_id,
        content_type=content_type,
        announcements_only=announcements_only,
        page=page,
        page_size=page_size,
    )
    return success_response(results)


@router.get(
    "/{course_id}/files",
    summary="Search file attachments",
    description="Search files shared in a course chat room by filename or MIME type.",
)
async def search_files(
    course_id: uuid.UUID,
    q: Optional[str] = None,
    mime_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Search file attachments in a course chat room."""
    from app.modules.chat.search import ChatSearchService
    svc = ChatSearchService(db, actor)
    results = await svc.search_files(
        course_id,
        query=q,
        mime_type_prefix=mime_type,
        page=page,
        page_size=page_size,
    )
    return success_response(results)


@router.get(
    "/{course_id}/members",
    summary="Search room members",
    description="Return enrolled students in a course chat room matching an optional name query.",
)
async def search_members(
    course_id: uuid.UUID,
    q: Optional[str] = None,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return course chat room members."""
    from app.modules.chat.search import ChatSearchService
    svc = ChatSearchService(db, actor)
    members = await svc.search_room_members(course_id, query=q)
    return success_response({"members": members})


# ===========================================================================
# Phase 11 — Analytics Endpoints (teacher-only)
# ===========================================================================


@router.get(
    "/{course_id}/analytics/summary",
    summary="Engagement summary (teacher)",
    description="Return a high-level engagement summary for a course chat room.",
)
async def analytics_summary(
    course_id: uuid.UUID,
    days: int = 30,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return chat engagement summary."""
    from app.modules.chat.analytics import ChatAnalyticsService
    svc = ChatAnalyticsService(db, teacher)
    data = await svc.engagement_summary(course_id, days=days)
    return success_response(data)


@router.get(
    "/{course_id}/analytics/messages-per-day",
    summary="Messages per day (teacher)",
    description="Return message counts grouped by day for the last N days.",
)
async def analytics_messages_per_day(
    course_id: uuid.UUID,
    days: int = 30,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return messages-per-day time-series."""
    from app.modules.chat.analytics import ChatAnalyticsService
    svc = ChatAnalyticsService(db, teacher)
    data = await svc.messages_per_day(course_id, days=days)
    return success_response({"data": data, "days": days})


@router.get(
    "/{course_id}/analytics/active-students",
    summary="Most active students (teacher)",
    description="Return the top N most active message senders in the last N days.",
)
async def analytics_active_students(
    course_id: uuid.UUID,
    limit: int = 10,
    days: int = 30,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return most active students."""
    from app.modules.chat.analytics import ChatAnalyticsService
    svc = ChatAnalyticsService(db, teacher)
    data = await svc.most_active_students(course_id, limit=limit, days=days)
    return success_response({"students": data})


@router.get(
    "/{course_id}/analytics/peak-hours",
    summary="Peak activity hours (teacher)",
    description="Return message counts grouped by UTC hour of day.",
)
async def analytics_peak_hours(
    course_id: uuid.UUID,
    days: int = 30,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return hourly message distribution."""
    from app.modules.chat.analytics import ChatAnalyticsService
    svc = ChatAnalyticsService(db, teacher)
    data = await svc.peak_activity_hours(course_id, days=days)
    return success_response({"data": data})


# ===========================================================================
# Phase 11 — Presence Endpoint
# ===========================================================================


@router.get(
    "/{course_id}/presence",
    summary="Online users",
    description="Return the list of users currently online in a course chat room.",
)
async def get_presence(
    course_id: uuid.UUID,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return online users in a chat room."""
    from sqlalchemy import select
    from app.models.chat import ChatRoom
    from app.modules.chat.presence import PresenceService
    room = (
        await db.execute(select(ChatRoom).where(ChatRoom.course_id == course_id))
    ).scalar_one_or_none()
    if room is None:
        from app.core.exceptions.errors import AppError
        raise AppError(
            message="Chat room not found.", error_code="ChatRoomNotFound", status_code=404
        )
    svc = PresenceService(redis)
    online = await svc.get_room_online_users(str(room.id))
    count = len(online)
    return success_response({"online_user_ids": online, "count": count})


# ===========================================================================
# Phase 11 — Extended Moderation Endpoints (teacher-only)
# ===========================================================================


@router.post(
    "/{course_id}/moderation/mute/{student_id}",
    summary="Mute student (teacher)",
    description="Mute a student in the course chat. Their future messages are flagged but stored.",
)
async def mute_student(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    reason: Optional[str] = None,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Mute a student in the course chat."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    svc = ExtendedModerationService(db, redis, teacher)
    data = await svc.mute_student(course_id, student_id, reason=reason)
    await db.commit()
    return success_response(data, message="Student muted.")


@router.delete(
    "/{course_id}/moderation/mute/{student_id}",
    summary="Unmute student (teacher)",
    description="Remove the mute from a student.",
)
async def unmute_student(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Unmute a student."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    svc = ExtendedModerationService(db, redis, teacher)
    data = await svc.unmute_student(course_id, student_id)
    await db.commit()
    return success_response(data, message="Student unmuted.")


@router.post(
    "/{course_id}/moderation/kick/{student_id}",
    summary="Kick student (teacher)",
    description=(
        "Send a moderation.kicked WebSocket event to the student. "
        "Their frontend is expected to disconnect. "
        "Does NOT remove enrollment."
    ),
)
async def kick_student(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    reason: Optional[str] = None,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Kick a student from the chat session."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    from app.modules.chat.ws_manager import get_manager
    from sqlalchemy import select
    from app.models.chat import ChatRoom

    svc = ExtendedModerationService(db, redis, teacher)
    result = await svc.kick_student(course_id, student_id, reason=reason)
    await db.commit()

    # Deliver kick event to the student's local WS connections
    room = (
        await db.execute(select(ChatRoom).where(ChatRoom.course_id == course_id))
    ).scalar_one_or_none()
    if room:
        manager = get_manager()
        await manager.send_to_user(
            str(student_id),
            str(room.id),
            __import__("app.modules.chat.ws_schemas", fromlist=["WSEnvelope"]).WSEnvelope(
                type="moderation.kicked",
                payload={
                    "reason": reason or "You have been removed from the chat.",
                    "kicked_by": str(teacher.id),
                },
                room_id=str(room.id),
            ),
        )

    return success_response(
        {"action": "kicked", "student_id": str(student_id)},
        message="Student kicked from chat.",
    )


@router.post(
    "/{course_id}/moderation/lock",
    summary="Lock chat room (teacher)",
    description="Lock the chat room to read-only mode for students.",
)
async def lock_room(
    course_id: uuid.UUID,
    reason: Optional[str] = None,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Lock the chat room."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    svc = ExtendedModerationService(db, redis, teacher)
    data = await svc.lock_room(course_id, reason=reason)
    await db.commit()
    return success_response(data, message="Chat room locked.")


@router.delete(
    "/{course_id}/moderation/lock",
    summary="Unlock chat room (teacher)",
    description="Unlock the chat room, allowing students to send messages again.",
)
async def unlock_room(
    course_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Unlock the chat room."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    svc = ExtendedModerationService(db, redis, teacher)
    data = await svc.unlock_room(course_id)
    await db.commit()
    return success_response(data, message="Chat room unlocked.")


@router.delete(
    "/{course_id}/moderation/bulk-delete",
    summary="Bulk delete messages (teacher)",
    description="Soft-delete multiple messages at once (max 50).",
    status_code=200,
)
async def bulk_delete_messages(
    course_id: uuid.UUID,
    message_ids: list[uuid.UUID],
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Bulk soft-delete messages."""
    from app.modules.chat.moderation_extended import ExtendedModerationService
    svc = ExtendedModerationService(db, redis, teacher)
    data = await svc.bulk_delete_messages(message_ids)
    await db.commit()
    return success_response(data)
