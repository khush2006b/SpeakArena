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

import logging
import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel
from app.core.redis.client import get_redis
from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.chat import ChatRoom, Message
from app.models.course import Course, CourseEnrollment
from app.models.enums import EnrollmentStatus
from app.models.user import User
from app.modules.auth.dependencies import get_current_teacher, get_current_user
from app.modules.chat.presence import ReadReceiptService
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

logger = logging.getLogger(__name__)

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
        sender_id = json_data.get("sender_id")
        # Use only the specific room the message was sent to — never broadcast
        # across all course rooms, which causes announcement/general bleed.
        target_room_id = json_data.get("chat_room_id") or json_data.get("room_id")
        manager = ConnectionManager()

        if recipient_id:
            # DM: Send directly to recipient & sender user channels via Redis Pub/Sub
            envelope = make_envelope(
                WSEventType.MESSAGE_NEW,
                message_new_payload(json_data),
                room_id=str(course_id),
            )
            await manager.send_to_user_channel(redis, str(recipient_id), envelope)
            if sender_id and str(sender_id) != str(recipient_id):
                await manager.send_to_user_channel(redis, str(sender_id), envelope)
        elif target_room_id:
            # Room message: Publish ONLY to the exact room the message belongs to.
            # Formerly this broadcast to all course rooms, mixing announcement and
            # general messages — that is the bug we are fixing here.
            envelope = make_envelope(
                WSEventType.MESSAGE_NEW,
                message_new_payload(json_data),
                room_id=str(target_room_id),
            )
            await manager.broadcast_to_room(redis, str(target_room_id), envelope)
        else:
            logger.warning("_broadcast_new_message: no target_room_id and no recipient_id — cannot broadcast.")
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
    "/courses/{course_id}/rooms",
    summary="Get all chat rooms for a course",
    description="Returns both Announcement and General chat rooms for a course.",
)
async def get_course_rooms(
    course_id: uuid.UUID,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return all chat rooms for a course."""
    svc = ChatRoomService(db, redis, actor)
    data = await svc.get_rooms_for_course(course_id)
    return success_response(data)


class MarkReadPayload(BaseModel):
    channel_key: Optional[str] = None
    room_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    room_type: Optional[str] = None
    dm_user_id: Optional[uuid.UUID] = None
    message_id: Optional[uuid.UUID] = None


@router.get(
    "/unread",
    summary="Get unread chats summary for authenticated user",
    description="Returns an unread status map for all enrolled course chat rooms and direct messages.",
)
async def get_unread_summary(
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    read_svc = ReadReceiptService(redis) if redis is not None else None
    unread_channels: dict[str, bool] = {}

    try:
        # 1. Determine user courses
        course_ids: list[uuid.UUID] = []
        role_str = str(getattr(actor, "role", "")).lower()
        if "student" in role_str:
            stmt = select(CourseEnrollment.course_id).where(
                CourseEnrollment.student_id == actor.id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            res = await db.execute(stmt)
            course_ids = [r[0] for r in res.all()]
        else:
            stmt = select(Course.id).where(Course.teacher_id == actor.id)
            res = await db.execute(stmt)
            course_ids = [r[0] for r in res.all()]

        if course_ids:
            rooms_stmt = select(ChatRoom).where(
                ChatRoom.course_id.in_(course_ids),
                ChatRoom.is_active == True,
            )
            rooms_res = await db.execute(rooms_stmt)
            rooms = rooms_res.scalars().all()

            for room in rooms:
                if room.room_type == "global_announcement":
                    ck = "announcements"
                elif room.room_type == "announcement" or room.is_announcement_only:
                    ck = f"course_announcements:{room.course_id}"
                else:
                    ck = f"course:{room.course_id}"

                msg_stmt = (
                    select(Message.id, Message.created_at)
                    .where(
                        Message.chat_room_id == room.id,
                        Message.deleted_at.is_(None),
                        Message.sender_id != actor.id,
                        Message.recipient_id.is_(None),
                    )
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                msg_res = await db.execute(msg_stmt)
                latest_msg_row = msg_res.first()

                is_room_unread = False
                if latest_msg_row:
                    msg_id, msg_created_at = latest_msg_row[0], latest_msg_row[1]
                    latest_id_str = str(msg_id)

                    # Method 1: Check read timestamp
                    is_read_by_time = False
                    if redis is not None:
                        ts_keys = [
                            f"chat:read_time:{room.id}:{actor.id}",
                            f"chat:read_time:ch:{ck}:{actor.id}",
                        ]
                        for tk in ts_keys:
                            val = await redis.get(tk)
                            if val:
                                try:
                                    read_ts = float(val.decode() if isinstance(val, bytes) else str(val))
                                    if read_ts >= (msg_created_at.timestamp() - 1.0):
                                        is_read_by_time = True
                                        break
                                except Exception:
                                    pass

                    if not is_read_by_time:
                        # Method 2: Check read message cursor ID
                        last_read_id = None
                        if read_svc:
                            last_read_id = await read_svc.get_last_read(str(actor.id), str(room.id))

                        if last_read_id != latest_id_str:
                            is_room_unread = True

                if is_room_unread:
                    unread_channels[ck] = True
                elif ck not in unread_channels:
                    unread_channels[ck] = False

        # 2. Check Direct Messages (DMs) where actor is recipient
        dm_stmt = (
            select(Message.id, Message.sender_id, Message.created_at)
            .where(
                Message.recipient_id == actor.id,
                Message.deleted_at.is_(None),
                Message.sender_id != actor.id,
            )
            .order_by(Message.created_at.desc())
            .limit(40)
        )
        dm_res = await db.execute(dm_stmt)
        dm_rows = dm_res.all()

        seen_senders: set[uuid.UUID] = set()
        for row in dm_rows:
            partner_id = row[1]
            if partner_id in seen_senders:
                continue
            seen_senders.add(partner_id)
            msg_id_str = str(row[0])
            msg_created_at = row[2]
            ck = f"teacher_dm:{partner_id}"

            is_dm_read = False
            if redis is not None:
                dm_ts = await redis.get(f"chat:read_time:dm:{partner_id}:{actor.id}")
                if dm_ts:
                    try:
                        read_ts = float(dm_ts.decode() if isinstance(dm_ts, bytes) else str(dm_ts))
                        if read_ts >= (msg_created_at.timestamp() - 1.0):
                            is_dm_read = True
                    except Exception:
                        pass
                if not is_dm_read:
                    cursor_val = await redis.get(f"chat:read:dm:{partner_id}:{actor.id}")
                    if cursor_val:
                        last_dm_id = cursor_val.decode() if isinstance(cursor_val, bytes) else str(cursor_val)
                        if last_dm_id == msg_id_str:
                            is_dm_read = True

            unread_channels[ck] = not is_dm_read

    except Exception as exc:
        logger.warning(f"Error computing unread summary: {exc}")

    has_unread = any(unread_channels.values())
    return success_response({
        "has_unread": has_unread,
        "unread_channels": unread_channels,
    })


@router.post(
    "/read",
    summary="Mark channel or chat room as read",
    description="Updates the user's read cursor in Redis for a specific channel, room, or DM thread.",
)
async def mark_chat_read(
    body: MarkReadPayload,
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    read_svc = ReadReceiptService(redis) if redis is not None else None
    now_ts = datetime.now(timezone.utc).timestamp()
    now_ts_str = str(now_ts)

    try:
        # Case A: Room ID provided
        if body.room_id:
            if redis is not None:
                await redis.set(f"chat:read_time:{body.room_id}:{actor.id}", now_ts_str)
            target_msg_id = str(body.message_id) if body.message_id else None
            if not target_msg_id:
                latest_q = (
                    select(Message.id)
                    .where(
                        Message.chat_room_id == body.room_id,
                        Message.deleted_at.is_(None),
                        Message.sender_id != actor.id,
                    )
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                l_res = await db.execute(latest_q)
                lid = l_res.scalar_one_or_none()
                if lid:
                    target_msg_id = str(lid)
            if target_msg_id and read_svc:
                await read_svc.mark_read(str(actor.id), str(body.room_id), target_msg_id)

        # Case B: Channel key provided
        if body.channel_key:
            ck = body.channel_key
            if redis is not None:
                await redis.set(f"chat:read_time:ch:{ck}:{actor.id}", now_ts_str)

            if ck.startswith("teacher_dm:"):
                other_id = ck.split(":", 1)[1]
                if redis is not None:
                    await redis.set(f"chat:read_time:dm:{other_id}:{actor.id}", now_ts_str)
                    target_dm_msg_id = str(body.message_id) if body.message_id else None
                    if not target_dm_msg_id:
                        try:
                            other_uuid = uuid.UUID(other_id)
                            dm_q = (
                                select(Message.id)
                                .where(
                                    Message.sender_id == other_uuid,
                                    Message.recipient_id == actor.id,
                                    Message.deleted_at.is_(None),
                                )
                                .order_by(Message.created_at.desc())
                                .limit(1)
                            )
                            d_res = await db.execute(dm_q)
                            did = d_res.scalar_one_or_none()
                            if did:
                                target_dm_msg_id = str(did)
                        except Exception:
                            pass
                    if target_dm_msg_id:
                        await redis.set(f"chat:read:dm:{other_id}:{actor.id}", target_dm_msg_id)

            elif ck == "announcements":
                # Mark all enrolled course announcement rooms read
                role_str = str(getattr(actor, "role", "")).lower()
                if "student" in role_str:
                    stmt = select(CourseEnrollment.course_id).where(
                        CourseEnrollment.student_id == actor.id,
                        CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                    )
                    c_res = await db.execute(stmt)
                    target_cids = [r[0] for r in c_res.all()]
                else:
                    c_stmt = select(Course.id).where(Course.teacher_id == actor.id)
                    c_res = await db.execute(c_stmt)
                    target_cids = [r[0] for r in c_res.all()]

                if target_cids:
                    room_stmt = select(ChatRoom.id).where(
                        ChatRoom.course_id.in_(target_cids),
                        ChatRoom.is_active == True,
                        ChatRoom.room_type == "global_announcement",
                    )
                    r_res = await db.execute(room_stmt)
                    for rid in r_res.scalars().all():
                        if redis is not None:
                            await redis.set(f"chat:read_time:{rid}:{actor.id}", now_ts_str)
                        if read_svc:
                            await read_svc.mark_read(str(actor.id), str(rid), "read")

            elif ck.startswith("course:") or ck.startswith("course_announcements:"):
                parts = ck.split(":", 1)
                is_ann = (parts[0] == "course_announcements")
                try:
                    course_uuid = uuid.UUID(parts[1])
                    room_stmt = select(ChatRoom.id).where(
                        ChatRoom.course_id == course_uuid,
                        ChatRoom.is_active == True,
                    )
                    if is_ann:
                        room_stmt = room_stmt.where(
                            (ChatRoom.room_type == "announcement")
                            | ((ChatRoom.is_announcement_only == True) & (ChatRoom.room_type != "global_announcement"))
                        )
                    else:
                        room_stmt = room_stmt.where(ChatRoom.room_type == "general")

                    r_res = await db.execute(room_stmt)
                    r_ids = r_res.scalars().all()
                    for rid in r_ids:
                        if redis is not None:
                            await redis.set(f"chat:read_time:{rid}:{actor.id}", now_ts_str)
                        target_room_msg_id = str(body.message_id) if body.message_id else None
                        if not target_room_msg_id:
                            latest_q = (
                                select(Message.id)
                                .where(
                                    Message.chat_room_id == rid,
                                    Message.deleted_at.is_(None),
                                    Message.sender_id != actor.id,
                                )
                                .order_by(Message.created_at.desc())
                                .limit(1)
                            )
                            l_res = await db.execute(latest_q)
                            lid = l_res.scalar_one_or_none()
                            if lid:
                                target_room_msg_id = str(lid)
                        if target_room_msg_id and read_svc:
                            await read_svc.mark_read(str(actor.id), str(rid), target_room_msg_id)
                except Exception as exc:
                    logger.warning("Error marking course/announcement room read: %s", exc)

        # Case C: Direct DM user ID provided
        if body.dm_user_id and redis is not None:
            await redis.set(f"chat:read_time:dm:{body.dm_user_id}:{actor.id}", now_ts_str)
            dm_id_str = str(body.message_id) if body.message_id else None
            if not dm_id_str:
                try:
                    dm_q = (
                        select(Message.id)
                        .where(
                            Message.sender_id == body.dm_user_id,
                            Message.recipient_id == actor.id,
                            Message.deleted_at.is_(None),
                        )
                        .order_by(Message.created_at.desc())
                        .limit(1)
                    )
                    d_res = await db.execute(dm_q)
                    did = d_res.scalar_one_or_none()
                    if did:
                        dm_id_str = str(did)
                except Exception:
                    pass
            if dm_id_str:
                await redis.set(f"chat:read:dm:{body.dm_user_id}:{actor.id}", dm_id_str)

    except Exception as exc:
        logger.warning(f"Error marking chat read: {exc}")

    return success_response({"status": "marked_read"})


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
    room_type: Optional[str] = Query(None),
    actor: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return chat room detail."""
    svc = ChatRoomService(db, redis, actor)
    data = await svc.get_room(course_id, room_type=room_type)
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
        room_type=params.room_type,
        room_id=params.room_id,
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
    data = await svc.send(
        course_id,
        body,
        room_id=body.room_id,
        room_type=body.room_type,
    )
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
    from datetime import datetime, timezone

    # Sanitize file name to avoid S3/R2 signature mismatches caused by spaces or non-ASCII chars
    raw_name = body.file_name or "image.png"
    clean_file_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_name).strip("._")
    if not clean_file_name:
        clean_file_name = "attachment.png"

    norm_type = body.content_type.lower().strip() if body.content_type else "image/png"
    if clean_file_name.lower().endswith(".png"):
        norm_type = "image/png"
    elif clean_file_name.lower().endswith((".jpg", ".jpeg")):
        norm_type = "image/jpeg"
    elif clean_file_name.lower().endswith(".webp"):
        norm_type = "image/webp"
    elif clean_file_name.lower().endswith(".gif"):
        norm_type = "image/gif"
    elif clean_file_name.lower().endswith(".pdf"):
        norm_type = "application/pdf"

    # Validate MIME type
    allowed_prefixes = ("image/", "application/pdf", "audio/", "video/")
    if not any(norm_type.startswith(p) for p in allowed_prefixes):
        from app.core.exceptions.errors import AppError
        raise AppError(
            message="Unsupported file type for chat attachments.",
            error_code="UnsupportedMimeType",
        )

    ts = int(datetime.now(timezone.utc).timestamp())
    r2_key = f"chat/{course_id}/attachments/{actor.id}/{ts}_{clean_file_name}"
    upload_url = await r2.generate_presigned_upload_url(
        r2_key,
        content_type=norm_type,
        expiry_seconds=900,
    )
    return success_response({
        "upload_url": upload_url,
        "r2_key": r2_key,
        "content_type": norm_type,
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
