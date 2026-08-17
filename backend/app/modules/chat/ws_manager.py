"""WebSocket Connection Manager — multi-instance Redis Pub/Sub broadcast.

Designed for 10,000+ concurrent WebSocket connections across multiple
FastAPI instances. All cross-instance messaging is routed through Redis
Pub/Sub channels.

Architecture::

    FastAPI instance A          FastAPI instance B
    ┌─────────────────┐         ┌─────────────────┐
    │  ConnectionMgr  │         │  ConnectionMgr  │
    │  {room_id: [ws]}│         │  {room_id: [ws]}│
    └────────┬────────┘         └────────┬────────┘
             │ PUBLISH                    │
             ▼                           ▼
         Redis Pub/Sub (chat:room:{room_id})
             │                           │
             └──────── SUBSCRIBE ─────────┘

Each room has two channels:
    chat:room:{room_id}       — message events (new, edit, delete, react, pin)
    chat:presence:{room_id}   — presence/typing events

Redis Key Patterns:
    chat:online:{user_id}         — Heartbeat key; TTL=65s; refreshed every 30s
    chat:presence:{room_id}       — Sorted set: score=epoch, member=user_id
    chat:typing:{room_id}         — Set of user_ids currently typing; TTL per member
    chat:read:{room_id}:{user_id} — Last read message_id string
    chat:mute:{room_id}:{user_id} — Mute flag string 'true'; no TTL (teacher removes)
    chat:lock:{room_id}           — Lock flag string 'true'; no TTL (teacher removes)

Scaling:
    Add more FastAPI workers or pods. The connection manager holds only
    local connections; Redis Pub/Sub ensures all instances receive
    all events. No sticky sessions required.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio import Redis

from app.modules.chat.ws_schemas import (
    WSEnvelope,
    WSEventType,
    error_payload,
    make_envelope,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis channel name builders
# ---------------------------------------------------------------------------

_CHANNEL_ROOM = "chat:room:{room_id}"
_CHANNEL_PRESENCE = "chat:presence:{room_id}"
_KEY_ONLINE = "chat:online:{user_id}"
_KEY_MUTE = "chat:mute:{room_id}:{user_id}"
_KEY_LOCK = "chat:lock:{room_id}"
_KEY_READ = "chat:read:{room_id}:{user_id}"
_KEY_TYPING_SET = "chat:typing:{room_id}"
_KEY_PRESENCE_ZSET = "chat:presence:{room_id}"

# Heartbeat: client sends ping every PING_INTERVAL_SECONDS.
# Server considers client dead after HEARTBEAT_TIMEOUT_SECONDS.
PING_INTERVAL_SECONDS: int = 30
HEARTBEAT_TIMEOUT_SECONDS: int = 65
TYPING_EXPIRE_SECONDS: int = 5  # Auto-clear typing indicator after 5s


def room_channel(room_id: str) -> str:
    """Return the Redis Pub/Sub channel name for a room's message events.

    Args:
        room_id: Chat room UUID string.

    Returns:
        str: Redis channel name.
    """
    return _CHANNEL_ROOM.format(room_id=room_id)


def presence_channel(room_id: str) -> str:
    """Return the Redis Pub/Sub channel name for a room's presence events.

    Args:
        room_id: Chat room UUID string.

    Returns:
        str: Redis channel name.
    """
    return _CHANNEL_PRESENCE.format(room_id=room_id)


# ===========================================================================
# ConnectionManager
# ===========================================================================


class ConnectionManager:
    """Manages local WebSocket connections and coordinates Redis Pub/Sub.

    One singleton instance per FastAPI process. Tracks all active WebSocket
    connections grouped by room_id. Broadcasts outbound events by publishing
    to Redis so all instances (local and remote) receive the event.

    Thread Safety:
        All operations are async; asyncio's single-threaded event loop
        ensures safe access to the in-memory connection dict.
    """

    def __init__(self) -> None:
        """Initialize the connection manager."""
        # room_id -> list of (websocket, user_id) tuples
        self._connections: dict[str, list[tuple[WebSocket, str]]] = defaultdict(list)
        # websocket -> room_id for fast reverse lookup on disconnect
        self._ws_to_room: dict[int, str] = {}
        # websocket -> user_id
        self._ws_to_user: dict[int, str] = {}
        # room_id -> active Redis pubsub subscription task
        self._room_listener_tasks: dict[str, asyncio.Task] = {}

    async def ensure_room_subscription(self, redis: Redis, room_id: str) -> None:
        """Ensure a single Redis Pub/Sub subscriber task is running for the room."""
        task = self._room_listener_tasks.get(room_id)
        if task is None or task.done():
            pubsub_redis = redis.client()
            task = asyncio.create_task(self.start_subscription_listener(pubsub_redis, room_id))
            self._room_listener_tasks[room_id] = task

    # -----------------------------------------------------------------------
    # Connection lifecycle
    # -----------------------------------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str,
        user_id: str,
        redis: Redis,
    ) -> None:
        """Accept a new WebSocket connection and register it in the room.

        Args:
            websocket: The FastAPI WebSocket instance.
            room_id: UUID string of the chat room being joined.
            user_id: UUID string of the authenticated user.
            redis: Async Redis client for presence tracking.
        """
        await websocket.accept()

        ws_key = id(websocket)
        self._connections[room_id].append((websocket, user_id))
        self._ws_to_room[ws_key] = room_id
        self._ws_to_user[ws_key] = user_id

        # Mark user online in Redis
        await redis.setex(
            _KEY_ONLINE.format(user_id=user_id),
            HEARTBEAT_TIMEOUT_SECONDS,
            "1",
        )

        # Add user to room's presence sorted set (score = current epoch)
        import time
        await redis.zadd(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            {user_id: time.time()},
        )

        logger.info(
            "WebSocket connected: user=%s room=%s total_local=%d",
            user_id,
            room_id,
            len(self._connections[room_id]),
        )

    async def disconnect(
        self,
        websocket: WebSocket,
        redis: Redis,
    ) -> tuple[str, str]:
        """Remove a WebSocket from the connection registry.

        Called on both clean disconnect and error disconnect. Cleans up
        Redis presence tracking and removes the local connection entry.

        Args:
            websocket: The WebSocket being disconnected.
            redis: Async Redis client.

        Returns:
            tuple[str, str]: (room_id, user_id) of the disconnected socket.
        """
        ws_key = id(websocket)
        room_id = self._ws_to_room.pop(ws_key, "")
        user_id = self._ws_to_user.pop(ws_key, "")

        if room_id:
            self._connections[room_id] = [
                (ws, uid)
                for ws, uid in self._connections[room_id]
                if id(ws) != ws_key
            ]

            # If no connections remain in room, cancel listener task
            if len(self._connections[room_id]) == 0:
                task = self._room_listener_tasks.pop(room_id, None)
                if task and not task.done():
                    task.cancel()

            # Only mark offline if this was the user's last local connection
            still_connected = any(
                uid == user_id
                for _, uid in self._connections[room_id]
            )
            if not still_connected and redis:
                await redis.delete(_KEY_ONLINE.format(user_id=user_id))
                # Remove typing indicator
                await redis.srem(
                    _KEY_TYPING_SET.format(room_id=room_id), user_id
                )
                
                # Prune the room's entire presence set to avoid unbounded growth
                try:
                    import time
                    cutoff = time.time() - 86400  # 24 hours
                    await redis.zremrangebyscore(_KEY_PRESENCE_ZSET.format(room_id=room_id), "-inf", cutoff)
                except Exception as exc:
                    logger.error("Failed to prune presence set for room=%s: %s", room_id, exc)

        logger.info(
            "WebSocket disconnected: user=%s room=%s",
            user_id,
            room_id,
        )
        return room_id, user_id

    # -----------------------------------------------------------------------
    # Broadcast helpers
    # -----------------------------------------------------------------------

    async def broadcast_to_room(
        self,
        redis: Redis,
        room_id: str,
        envelope: WSEnvelope,
    ) -> None:
        """Publish an event to the room's Redis Pub/Sub channel.

        The event is received by all FastAPI instances subscribed to
        this channel (including the current one via the listener task).

        Args:
            redis: Async Redis client.
            room_id: Target room UUID string.
            envelope: The outbound event envelope to broadcast.
        """
        await redis.publish(
            room_channel(room_id),
            envelope.to_json(),
        )

    async def broadcast_presence(
        self,
        redis: Redis,
        room_id: str,
        envelope: WSEnvelope,
    ) -> None:
        """Publish a presence event to the room's presence channel.

        Args:
            redis: Async Redis client.
            room_id: Target room UUID string.
            envelope: The presence event envelope.
        """
        await redis.publish(
            presence_channel(room_id),
            envelope.to_json(),
        )

    async def send_to_user(
        self,
        user_id: str,
        room_id: str,
        envelope: WSEnvelope,
    ) -> None:
        """Send a private message to a specific user's WebSocket connections.

        Only sends to local connections on this instance. For cross-instance
        private messaging, use a dedicated private channel.

        Args:
            user_id: Target user UUID string.
            room_id: Room containing the user.
            envelope: The event envelope to send.
        """
        payload = envelope.to_json()
        for ws, uid in list(self._connections.get(room_id, [])):
            if uid == user_id:
                try:
                    await ws.send_text(payload)
                except Exception as exc:
                    logger.warning(
                        "Failed to send private message to user=%s: %s",
                        user_id,
                        exc,
                    )

    async def _deliver_local(
        self,
        room_id: str,
        raw_message: str,
    ) -> None:
        """Deliver a raw JSON string to all local WebSocket connections in a room.

        Called by the Redis subscriber task when a Pub/Sub message arrives.

        Args:
            room_id: Target room UUID string.
            raw_message: Serialized JSON envelope string.
        """
        dead: list[WebSocket] = []
        for ws, user_id in list(self._connections.get(room_id, [])):
            try:
                await ws.send_text(raw_message)
            except Exception:
                dead.append(ws)

        # Prune dead connections detected during delivery
        for ws in dead:
            ws_key = id(ws)
            self._connections[room_id] = [
                (w, u) for w, u in self._connections[room_id] if id(w) != ws_key
            ]
            self._ws_to_room.pop(ws_key, None)
            self._ws_to_user.pop(ws_key, None)

    # -----------------------------------------------------------------------
    # Redis Subscriber task
    # -----------------------------------------------------------------------

    async def start_subscription_listener(
        self,
        redis: Redis,
        room_id: str,
    ) -> None:
        """Start a long-lived Redis Pub/Sub listener for a room.

        This coroutine subscribes to the room's message and presence channels
        and delivers all received messages to local WebSocket connections.
        Intended to be launched as an asyncio background task.

        The listener exits when the asyncio task is cancelled (e.g. when
        the last user leaves the room).

        Args:
            redis: Async Redis client (dedicated pubsub connection).
            room_id: Chat room UUID string to subscribe to.
        """
        pubsub = redis.pubsub()
        await pubsub.subscribe(
            room_channel(room_id),
            presence_channel(room_id),
        )
        logger.info("Redis Pub/Sub listener started for room=%s", room_id)
        try:
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                data = raw["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await self._deliver_local(room_id, data)
        except asyncio.CancelledError:
            logger.info("Redis Pub/Sub listener cancelled for room=%s", room_id)
        except Exception as exc:
            logger.error(
                "Redis Pub/Sub listener error for room=%s: %s", room_id, exc
            )
        finally:
            try:
                await pubsub.unsubscribe()
                await pubsub.aclose()
            except Exception:
                pass

    # -----------------------------------------------------------------------
    # Heartbeat / Presence helpers
    # -----------------------------------------------------------------------

    async def refresh_heartbeat(
        self,
        redis: Redis,
        user_id: str,
        room_id: str,
    ) -> None:
        """Refresh the user's online heartbeat TTL in Redis.

        Called when the server receives a 'ping' frame from the client.

        Args:
            redis: Async Redis client.
            user_id: UUID string of the user sending the ping.
            room_id: UUID string of the room.
        """
        import time
        pipe = redis.pipeline()
        pipe.setex(
            _KEY_ONLINE.format(user_id=user_id),
            HEARTBEAT_TIMEOUT_SECONDS,
            "1",
        )
        pipe.zadd(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            {user_id: time.time()},
        )
        await pipe.execute()

    async def get_online_count(
        self,
        redis: Redis,
        room_id: str,
    ) -> int:
        """Return the number of users currently online in a room.

        Counts entries in the presence sorted set whose score (epoch)
        is within the HEARTBEAT_TIMEOUT_SECONDS window.

        Args:
            redis: Async Redis client.
            room_id: Room UUID string.

        Returns:
            int: Number of online users.
        """
        import time
        cutoff = time.time() - HEARTBEAT_TIMEOUT_SECONDS
        count = await redis.zcount(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            cutoff,
            "+inf",
        )
        return int(count)

    async def get_online_users(
        self,
        redis: Redis,
        room_id: str,
    ) -> list[str]:
        """Return the list of user_ids currently online in a room.

        Args:
            redis: Async Redis client.
            room_id: Room UUID string.

        Returns:
            list[str]: User UUID strings currently online.
        """
        import time
        cutoff = time.time() - HEARTBEAT_TIMEOUT_SECONDS
        members = await redis.zrangebyscore(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            cutoff,
            "+inf",
        )
        return [m.decode() if isinstance(m, bytes) else m for m in members]

    # -----------------------------------------------------------------------
    # Error helper
    # -----------------------------------------------------------------------

    @staticmethod
    async def send_error(
        websocket: WebSocket,
        code: str,
        detail: str,
    ) -> None:
        """Send an error frame directly to a single WebSocket connection.

        Does not raise. Used to inform the client of a non-fatal error
        without closing the connection.

        Args:
            websocket: Target WebSocket connection.
            code: Short error code string.
            detail: Human-readable error description.
        """
        envelope = make_envelope(
            WSEventType.ERROR,
            error_payload(code, detail),
        )
        try:
            await websocket.send_text(envelope.to_json())
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

#: Singleton ConnectionManager — one per FastAPI process.
manager = ConnectionManager()


def get_manager() -> ConnectionManager:
    """Return the module-level ConnectionManager singleton.

    Used as a FastAPI dependency or called directly by the WebSocket router.

    Returns:
        ConnectionManager: The singleton instance.
    """
    return manager
