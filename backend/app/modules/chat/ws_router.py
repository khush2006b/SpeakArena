"""WebSocket router for real-time chat.

Mounts a single WebSocket endpoint:
    WS /ws/chat/{room_id}

Connection flow:
    1. Client connects with ?token=<JWT> in query string.
    2. Server validates JWT, resolves user, verifies room access.
    3. Server sends 'connected' frame with online_count.
    4. Server subscribes to Redis Pub/Sub for the room.
    5. Client sends event frames; server processes and broadcasts.
    6. Client sends 'ping' every 30s; server responds with 'pong'.
    7. On disconnect, server cleans up presence and typing state.

Inbound Events (Client → Server):
    message.send     — send a new message
    message.edit     — edit own message
    message.delete   — delete own message
    message.react    — add/remove reaction
    typing.start     — started typing
    typing.stop      — stopped typing
    read.mark        — mark messages as read
    ping             — heartbeat

Security:
    - JWT validated on every connection (not per-message for performance).
    - Room access validated before accepting the connection.
    - Student enrollment verified on connect.
    - Per-event permission checks delegated to service layer.
    - Muted user check on every message.send via Redis O(1) lookup.
    - Room lock check on every message.send via Redis O(1) lookup.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import enum
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatRoom as ChatRoomModel
from app.models.enums import UserRole
from app.models.user import User
from app.modules.auth.dependencies import decode_ws_token
from app.modules.chat.presence import PresenceService, ReadReceiptService, TypingService
from app.modules.chat.repository import ChatRoomRepository, ModerationRepository
from app.modules.chat.schemas import EditMessageRequest, SendMessageRequest
from app.modules.chat.service import (
    ChatRoomInactiveError,
    MessageService,
    SlowModeError,
)
from app.modules.chat.tasks import cleanup_expired_typing_indicators
from app.modules.chat.ws_manager import ConnectionManager, get_manager
from app.modules.chat.ws_schemas import (
    InboundFrame,
    WSEventType,
    connected_payload,
    make_envelope,
    message_deleted_payload,
    message_edited_payload,
    message_new_payload,
)

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["WebSocket Chat"])

# Redis key templates
_KEY_MUTE = "chat:mute:{room_id}:{user_id}"
_KEY_LOCK = "chat:lock:{room_id}"
_KEY_ONLINE = "chat:online:{user_id}"


# ===========================================================================
# WebSocket Endpoint
# ===========================================================================


@ws_router.websocket("/ws/chat/{room_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    room_id: uuid.UUID,
) -> None:
    """WebSocket endpoint for real-time course chat.

    Authentication via first message payload:
        Client sends: {"type": "auth", "payload": {"token": "<jwt>"}}

    Args:
        websocket: The FastAPI WebSocket connection.
        room_id: UUID of the chat room to join.
    """
    db: Optional[AsyncSession] = None
    pubsub_redis: Optional[Any] = None
    manager: ConnectionManager = get_manager()

    # ------------------------------------------------------------------
    # 1. Accept and Authenticate
    # ------------------------------------------------------------------
    await websocket.accept()
    
    try:
        # Wait for the first message which must be the auth frame
        auth_raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth_frame = InboundFrame.model_validate_json(auth_raw)
        
        if auth_frame.type != "auth":
            await websocket.close(code=4001, reason="Unauthorized: expected auth frame.")
            return
            
        token = auth_frame.payload.get("token")
        if not token:
            await websocket.close(code=4001, reason="Unauthorized: missing token.")
            return

        from app.database import AsyncSessionFactory
        from app.core.redis.client import RedisClient
        db = AsyncSessionFactory()
        redis: Redis = RedisClient.get_pool()
        actor: Optional[User] = await decode_ws_token(token, db)
        if actor is None:
            await websocket.close(code=4001, reason="Unauthorized: invalid token.")
            return
    except asyncio.TimeoutError:
        logger.warning("WebSocket auth timed out.")
        await websocket.close(code=4001, reason="Auth timeout")
        return
    except Exception as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        await websocket.close(code=4001, reason="Unauthorized")
        return

    room_id_str = str(room_id)
    user_id_str = str(actor.id)

    # ------------------------------------------------------------------
    # 2. Validate room access
    # ------------------------------------------------------------------
    try:
        room_repo = ChatRoomRepository(db)
        mod_repo = ModerationRepository(db)
        room = await room_repo.get_by_id(room_id)
        if room is None:
            await websocket.close(code=4004, reason="Room not found.")
            return
        if not room.is_active:
            await websocket.close(code=4003, reason="Chat room is inactive.")
            return
        if actor.role == UserRole.STUDENT:
            enrolled = await mod_repo.is_enrolled(actor.id, room.course_id)
            if not enrolled:
                await websocket.close(code=4003, reason="Not enrolled in this course.")
                return
    except Exception as exc:
        logger.error(
            "Room validation error room=%s user=%s: %s", room_id, actor.id, exc
        )
        await websocket.close(code=4500, reason="Internal server error.")
        return
    finally:
        await db.close()

    # ------------------------------------------------------------------
    # 3. Register with manager
    # ------------------------------------------------------------------
    # Note: we already accepted the websocket in step 1, so we need to
    # update manager.connect to not call websocket.accept() again if it's open.
    # Actually, we will just use manager._connections directly or update the manager.
    # We will just let manager.connect do its thing; we can suppress accept error.
    # To be safe, we'll implement a custom connect logic here or ensure manager doesn't crash.
    # Wait, `manager.connect` calls `await websocket.accept()`. Calling it twice raises RuntimeError.
    # Let's bypass manager.connect calling accept by just injecting into the manager.
    
    ws_key = id(websocket)
    manager._connections[room_id_str].append((websocket, user_id_str))
    manager._ws_to_room[ws_key] = room_id_str
    manager._ws_to_user[ws_key] = user_id_str

    await redis.setex(_KEY_ONLINE.format(user_id=user_id_str), 65, "1")
    import time
    await redis.zadd(f"chat:presence:{room_id_str}", {user_id_str: time.time()})
    logger.info("WebSocket connected via auth frame: user=%s room=%s", user_id_str, room_id_str)

    presence_svc = PresenceService(redis)
    typing_svc = TypingService(redis)
    read_svc = ReadReceiptService(redis)

    await presence_svc.mark_online(user_id_str, room_id_str)
    online_count = await manager.get_online_count(redis, room_id_str)

    # Send connected confirmation
    connected_frame = make_envelope(
        WSEventType.CONNECTED,
        connected_payload(user_id_str, room_id_str, online_count),
        room_id=room_id_str,
    )
    await websocket.send_text(connected_frame.to_json())

    # Broadcast online presence
    presence_json = await presence_svc.build_presence_update_envelope(
        user_id_str, room_id_str, "online"
    )
    await redis.publish(f"chat:presence:{room_id_str}", presence_json)

    # ------------------------------------------------------------------
    # 4. Ensure single Redis Pub/Sub listener per room
    # ------------------------------------------------------------------
    await manager.ensure_room_subscription(redis, room_id_str)

    # ------------------------------------------------------------------
    # 5. Event loop
    # ------------------------------------------------------------------
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=70.0)
            except asyncio.TimeoutError:
                logger.info(
                    "WS timeout (no ping): user=%s room=%s", user_id_str, room_id_str
                )
                break

            try:
                frame = InboundFrame.model_validate_json(raw)
            except Exception:
                await manager.send_error(
                    websocket, "InvalidFrame", "Frame could not be parsed."
                )
                continue

            await _dispatch(
                frame=frame,
                websocket=websocket,
                actor=actor,
                room_id=room_id,
                room_id_str=room_id_str,
                redis=redis,
                manager=manager,
                presence_svc=presence_svc,
                typing_svc=typing_svc,
                read_svc=read_svc,
            )

    except WebSocketDisconnect:
        logger.info("WS disconnected: user=%s room=%s", user_id_str, room_id_str)
    except Exception as exc:
        logger.error("WS error user=%s room=%s: %s", user_id_str, room_id_str, exc)
    finally:
        await manager.disconnect(websocket, redis)
        await typing_svc.clear_typing(user_id_str, room_id_str)
        await presence_svc.mark_offline(user_id_str, room_id_str)

        offline_json = await presence_svc.build_presence_update_envelope(
            user_id_str, room_id_str, "offline"
        )
        await redis.publish(f"chat:presence:{room_id_str}", offline_json)

        typing_users = await typing_svc.get_typing_users(room_id_str)
        typing_json = typing_svc.build_typing_update_envelope(room_id_str, typing_users)
        await redis.publish(f"chat:presence:{room_id_str}", typing_json)


# ===========================================================================
# Dispatcher
# ===========================================================================


async def _dispatch(
    *,
    frame: InboundFrame,
    websocket: WebSocket,
    actor: User,
    room_id: uuid.UUID,
    room_id_str: str,
    redis: Redis,
    manager: ConnectionManager,
    presence_svc: PresenceService,
    typing_svc: TypingService,
    read_svc: ReadReceiptService,
) -> None:
    """Route an inbound frame to the correct handler.

    Args:
        frame: Parsed inbound event frame.
        websocket: The originating WebSocket.
        actor: Authenticated user.
        room_id: Room UUID.
        room_id_str: Room UUID string.
        redis: Async Redis client.
        manager: Connection manager.
        presence_svc: Presence service.
        typing_svc: Typing service.
        read_svc: Read receipt service.
    """
    t = frame.type

    if t == WSEventType.PING:
        await presence_svc.refresh(str(actor.id), room_id_str)
        pong = make_envelope(WSEventType.PONG, {}, room_id=room_id_str)
        await websocket.send_text(pong.to_json())

    elif t == WSEventType.MESSAGE_SEND:
        await _on_message_send(
            frame, websocket, actor, room_id, room_id_str, redis, manager
        )

    elif t == WSEventType.MESSAGE_EDIT:
        await _on_message_edit(
            frame, websocket, actor, room_id_str, redis, manager
        )

    elif t == WSEventType.MESSAGE_DELETE:
        await _on_message_delete(
            frame, websocket, actor, room_id_str, redis, manager
        )

    elif t == WSEventType.MESSAGE_REACT:
        await _on_message_react(
            frame, websocket, actor, room_id_str, redis, manager
        )

    elif t == WSEventType.TYPING_START:
        typing_users = await typing_svc.start_typing(str(actor.id), room_id_str)
        tj = typing_svc.build_typing_update_envelope(room_id_str, typing_users)
        await redis.publish(f"chat:presence:{room_id_str}", tj)
        asyncio.ensure_future(
            cleanup_expired_typing_indicators(redis, room_id_str)
        )

    elif t == WSEventType.TYPING_STOP:
        typing_users = await typing_svc.stop_typing(str(actor.id), room_id_str)
        tj = typing_svc.build_typing_update_envelope(room_id_str, typing_users)
        await redis.publish(f"chat:presence:{room_id_str}", tj)

    elif t == WSEventType.READ_MARK:
        last_id = frame.payload.get("last_read_message_id", "")
        if last_id:
            await read_svc.mark_read(str(actor.id), room_id_str, last_id)

    else:
        await manager.send_error(
            websocket,
            "UnknownEvent",
            f"Event type '{t}' is not supported.",
        )


# ===========================================================================
# Event handler functions
# ===========================================================================


async def _on_message_send(
    frame: InboundFrame,
    websocket: WebSocket,
    actor: User,
    room_id: uuid.UUID,
    room_id_str: str,
    redis: Redis,
    manager: ConnectionManager,
) -> None:
    """Persist and broadcast a new message."""
    uid_str = str(actor.id)

    # Lock and mute checks for students
    if actor.role == UserRole.STUDENT:
        if await redis.exists(_KEY_LOCK.format(room_id=room_id_str)):
            await manager.send_error(websocket, "RoomLocked", "Chat is locked.")
            return
        if await redis.exists(_KEY_MUTE.format(room_id=room_id_str, user_id=uid_str)):
            await manager.send_error(websocket, "UserMuted", "You are muted.")
            return

    p = frame.payload
    try:
        req = SendMessageRequest(
            content=p.get("content", ""),
            content_type=p.get("content_type", "text"),
            reply_to_id=p.get("reply_to_id"),
            recipient_id=p.get("recipient_id"),
            attachments=p.get("attachments", []),
        )
    except Exception as exc:
        await manager.send_error(websocket, "InvalidPayload", str(exc))
        return

    from app.database import AsyncSessionFactory
    try:
        async with AsyncSessionFactory() as db:
            async with db.begin():
                row = (await db.execute(
                    select(ChatRoomModel.course_id).where(ChatRoomModel.id == room_id)
                )).one_or_none()
                if row is None:
                    await manager.send_error(websocket, "RoomNotFound", "Room not found.")
                    return
                svc = MessageService(db, redis, actor)
                msg_data = await svc.send(row.course_id, req)
    except SlowModeError:
        await manager.send_error(websocket, "SlowMode", "Please wait before sending.")
        return
    except ChatRoomInactiveError:
        await manager.send_error(websocket, "RoomInactive", "Chat room is inactive.")
        return
    except Exception as exc:
        logger.error("message.send error: %s", exc)
        await manager.send_error(websocket, "SendFailed", "Failed to send message.")
        return

    envelope = make_envelope(
        WSEventType.MESSAGE_NEW,
        message_new_payload(_json_ready(msg_data)),
        room_id=room_id_str,
    )
    await manager.broadcast_to_room(redis, room_id_str, envelope)


async def _on_message_edit(
    frame: InboundFrame,
    websocket: WebSocket,
    actor: User,
    room_id_str: str,
    redis: Redis,
    manager: ConnectionManager,
) -> None:
    """Edit a message and broadcast the change."""
    p = frame.payload
    mid_str = p.get("message_id", "")
    content = p.get("content", "")
    if not mid_str or not content:
        await manager.send_error(websocket, "InvalidPayload", "message_id and content required.")
        return
    try:
        mid = uuid.UUID(mid_str)
    except ValueError:
        await manager.send_error(websocket, "InvalidPayload", "Invalid message_id.")
        return
    try:
        req = EditMessageRequest(content=content)
    except Exception as exc:
        await manager.send_error(websocket, "InvalidPayload", str(exc))
        return

    from app.database import AsyncSessionFactory
    try:
        async with AsyncSessionFactory() as db:
            async with db.begin():
                result = await MessageService(db, redis, actor).edit(mid, req)
    except Exception as exc:
        await manager.send_error(websocket, "EditFailed", str(exc))
        return

    ea = result.get("edited_at")
    ea_str = ea.isoformat() if ea else dt.datetime.utcnow().isoformat()
    envelope = make_envelope(
        WSEventType.MESSAGE_EDITED,
        message_edited_payload(mid_str, content, ea_str, str(actor.id)),
        room_id=room_id_str,
    )
    await manager.broadcast_to_room(redis, room_id_str, envelope)


async def _on_message_delete(
    frame: InboundFrame,
    websocket: WebSocket,
    actor: User,
    room_id_str: str,
    redis: Redis,
    manager: ConnectionManager,
) -> None:
    """Soft-delete a message and broadcast the deletion."""
    mid_str = frame.payload.get("message_id", "")
    if not mid_str:
        await manager.send_error(websocket, "InvalidPayload", "message_id required.")
        return
    try:
        mid = uuid.UUID(mid_str)
    except ValueError:
        await manager.send_error(websocket, "InvalidPayload", "Invalid message_id.")
        return

    from app.database import AsyncSessionFactory
    try:
        async with AsyncSessionFactory() as db:
            async with db.begin():
                await MessageService(db, redis, actor).delete(mid)
    except Exception as exc:
        await manager.send_error(websocket, "DeleteFailed", str(exc))
        return
    envelope = make_envelope(
        WSEventType.MESSAGE_DELETED,
        message_deleted_payload(mid_str, str(actor.id)),
        room_id=room_id_str,
    )
    await manager.broadcast_to_room(redis, room_id_str, envelope)


async def _on_message_react(
    frame: InboundFrame,
    websocket: WebSocket,
    actor: User,
    room_id_str: str,
    redis: Redis,
    manager: ConnectionManager,
) -> None:
    """Add or remove a reaction and broadcast the updated reaction map."""
    p = frame.payload
    mid_str = p.get("message_id", "")
    emoji = p.get("emoji", "")
    action = p.get("action", "add")
    if not mid_str or not emoji:
        await manager.send_error(websocket, "InvalidPayload", "message_id and emoji required.")
        return
    try:
        mid = uuid.UUID(mid_str)
    except ValueError:
        await manager.send_error(websocket, "InvalidPayload", "Invalid message_id.")
        return

    from app.database import AsyncSessionFactory
    try:
        async with AsyncSessionFactory() as db:
            async with db.begin():
                result = await MessageService(db, redis, actor).react(mid, emoji, add=(action == "add"))
    except Exception as exc:
        await manager.send_error(websocket, "ReactFailed", str(exc))
        return
    envelope = make_envelope(
        WSEventType.MESSAGE_REACTED,
        {
            "message_id": mid_str,
            "reactions": result.get("reactions", {}),
            "actor_id": str(actor.id),
            "emoji": emoji,
            "action": action,
        },
        room_id=room_id_str,
    )
    await manager.broadcast_to_room(redis, room_id_str, envelope)


# ===========================================================================
# Serialization helper
# ===========================================================================


def _json_ready(data: Any) -> Any:
    """Recursively convert UUIDs, datetimes, and enums to JSON-serializable values.

    Args:
        data: Any Python value to convert.

    Returns:
        Any: JSON-serializable version of data.
    """
    if isinstance(data, uuid.UUID):
        return str(data)
    if isinstance(data, (dt.datetime, dt.date)):
        return data.isoformat()
    if isinstance(data, enum.Enum):
        return data.value
    if isinstance(data, dict):
        return {k: _json_ready(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_json_ready(i) for i in data]
    return data
