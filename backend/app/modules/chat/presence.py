"""Presence and Typing services for the chat module.

All presence state is stored in Redis for O(1) reads across instances.
No presence data is stored in the PostgreSQL database.

Services:
    PresenceService  — Online/offline/idle tracking, last-seen.
    TypingService    — Typing indicator broadcast with auto-expiry.

Redis Key Patterns (all defined in ws_manager.py constants):
    chat:online:{user_id}          TTL=65s  heartbeat aliveness
    chat:presence:{room_id}        ZSet     user_id → last_seen epoch
    chat:typing:{room_id}          Set      user_ids currently typing
    chat:away:{user_id}            TTL=300s idle/away marker
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from redis.asyncio import Redis

from app.modules.chat.ws_schemas import (
    WSEventType,
    make_envelope,
    presence_update_payload,
    typing_update_payload,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis key templates (local to this module)
# ---------------------------------------------------------------------------

_KEY_ONLINE = "chat:online:{user_id}"
_KEY_PRESENCE_ZSET = "chat:presence:{room_id}"
_KEY_TYPING_SET = "chat:typing:{room_id}"
_KEY_AWAY = "chat:away:{user_id}"
_KEY_TYPING_USER_TTL = "chat:typing:{room_id}:user:{user_id}"

HEARTBEAT_TIMEOUT = 65   # seconds — matches ws_manager.HEARTBEAT_TIMEOUT_SECONDS
TYPING_EXPIRE = 5        # seconds — auto-clear typing after 5s of inactivity
AWAY_EXPIRE = 300        # seconds — mark user as away after 5 minutes idle


# ===========================================================================
# PresenceService
# ===========================================================================


class PresenceService:
    """Tracks user online/offline/idle presence per room via Redis.

    All methods are stateless — they read from and write to Redis only.
    Multiple FastAPI instances can call these methods concurrently without
    coordination issues because all state is Redis-native.

    Args:
        redis: Async Redis client.
    """

    def __init__(self, redis: Redis) -> None:
        """Initialize the presence service.

        Args:
            redis: Async Redis client.
        """
        self._redis = redis

    async def mark_online(
        self,
        user_id: str,
        room_id: str,
    ) -> None:
        """Mark a user as online in a room.

        Sets a heartbeat key with a TTL and updates the room's presence
        sorted set with the current epoch as score.

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.
        """
        now = time.time()
        pipe = self._redis.pipeline()
        pipe.setex(_KEY_ONLINE.format(user_id=user_id), HEARTBEAT_TIMEOUT, "1")
        pipe.zadd(_KEY_PRESENCE_ZSET.format(room_id=room_id), {user_id: now})
        pipe.delete(_KEY_AWAY.format(user_id=user_id))
        await pipe.execute()

    async def mark_offline(
        self,
        user_id: str,
        room_id: str,
    ) -> None:
        """Mark a user as offline when they disconnect.

        Removes the user's heartbeat key but keeps their entry in the
        presence sorted set with the current epoch as 'last seen'.

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.
        """
        now = time.time()
        pipe = self._redis.pipeline()
        pipe.delete(_KEY_ONLINE.format(user_id=user_id))
        pipe.zadd(_KEY_PRESENCE_ZSET.format(room_id=room_id), {user_id: now})
        await pipe.execute()

    async def refresh(
        self,
        user_id: str,
        room_id: str,
    ) -> None:
        """Refresh the heartbeat TTL for an online user.

        Called when the server receives a 'ping' frame. Resets the
        heartbeat key TTL and updates the presence sorted set score.

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.
        """
        now = time.time()
        pipe = self._redis.pipeline()
        pipe.setex(_KEY_ONLINE.format(user_id=user_id), HEARTBEAT_TIMEOUT, "1")
        pipe.zadd(_KEY_PRESENCE_ZSET.format(room_id=room_id), {user_id: now})
        await pipe.execute()

    async def is_online(
        self,
        user_id: str,
    ) -> bool:
        """Check whether a user is currently online (heartbeat alive).

        Args:
            user_id: UUID string of the user.

        Returns:
            bool: True if the heartbeat key exists in Redis.
        """
        return bool(await self._redis.exists(
            _KEY_ONLINE.format(user_id=user_id)
        ))

    async def get_status(
        self,
        user_id: str,
        room_id: str,
    ) -> dict[str, Any]:
        """Return the presence status dict for a user in a room.

        Status is derived from Redis keys:
            online  — heartbeat key exists
            offline — heartbeat key missing; last_seen from sorted set

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.

        Returns:
            dict[str, Any]: Presence dict with keys:
                user_id, status, last_seen.
        """
        online = await self.is_online(user_id)
        if online:
            return {"user_id": user_id, "status": "online", "last_seen": None}

        # Get last seen from sorted set score
        score = await self._redis.zscore(
            _KEY_PRESENCE_ZSET.format(room_id=room_id), user_id
        )
        last_seen: Optional[str] = None
        if score is not None:
            from datetime import datetime, timezone
            last_seen = datetime.fromtimestamp(
                float(score), tz=timezone.utc
            ).isoformat()

        return {
            "user_id": user_id,
            "status": "offline",
            "last_seen": last_seen,
        }

    async def get_room_online_users(
        self,
        room_id: str,
    ) -> list[str]:
        """Return list of user_ids currently online in a room.

        Queries the presence sorted set for members with a score
        within the heartbeat window.

        Args:
            room_id: UUID string of the room.

        Returns:
            list[str]: User UUID strings currently online.
        """
        cutoff = time.time() - HEARTBEAT_TIMEOUT
        members = await self._redis.zrangebyscore(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            cutoff,
            "+inf",
        )
        result = []
        for m in members:
            uid = m.decode() if isinstance(m, bytes) else m
            # Double-check against individual heartbeat key for accuracy
            if await self.is_online(uid):
                result.append(uid)
        return result

    async def get_room_online_count(
        self,
        room_id: str,
    ) -> int:
        """Return the count of online users in a room.

        Args:
            room_id: UUID string of the room.

        Returns:
            int: Number of online users.
        """
        cutoff = time.time() - HEARTBEAT_TIMEOUT
        count = await self._redis.zcount(
            _KEY_PRESENCE_ZSET.format(room_id=room_id),
            cutoff,
            "+inf",
        )
        return int(count)

    async def build_presence_update_envelope(
        self,
        user_id: str,
        room_id: str,
        status: str,
    ) -> str:
        """Build a serialized presence.update envelope for broadcasting.

        Args:
            user_id: UUID string of the user whose status changed.
            room_id: Room UUID string.
            status: 'online' | 'offline' | 'idle' | 'away'.

        Returns:
            str: Serialized JSON envelope string.
        """
        payload = presence_update_payload(
            user_id=user_id,
            status=status,
        )
        envelope = make_envelope(
            WSEventType.PRESENCE_UPDATE,
            payload,
            room_id=room_id,
        )
        return envelope.to_json()


# ===========================================================================
# TypingService
# ===========================================================================


class TypingService:
    """Manages typing indicator state per room via Redis.

    Uses a Redis Set to track who is typing in each room. Individual
    user typing keys have a 5-second TTL so stale indicators auto-clear
    if the client disconnects without sending a typing.stop event.

    Args:
        redis: Async Redis client.
    """

    def __init__(self, redis: Redis) -> None:
        """Initialize the typing service.

        Args:
            redis: Async Redis client.
        """
        self._redis = redis

    async def start_typing(
        self,
        user_id: str,
        room_id: str,
    ) -> list[str]:
        """Mark a user as typing in a room.

        Adds the user to the room's typing set and sets a per-user
        expiry key. Returns the updated list of typing users.

        Args:
            user_id: UUID string of the typing user.
            room_id: UUID string of the room.

        Returns:
            list[str]: All user_ids currently typing in the room.
        """
        pipe = self._redis.pipeline()
        pipe.sadd(_KEY_TYPING_SET.format(room_id=room_id), user_id)
        pipe.setex(
            _KEY_TYPING_USER_TTL.format(room_id=room_id, user_id=user_id),
            TYPING_EXPIRE,
            "1",
        )
        await pipe.execute()
        return await self._get_typing_users(room_id)

    async def stop_typing(
        self,
        user_id: str,
        room_id: str,
    ) -> list[str]:
        """Remove a user from the typing set.

        Args:
            user_id: UUID string of the user who stopped typing.
            room_id: UUID string of the room.

        Returns:
            list[str]: Updated list of typing user_ids.
        """
        pipe = self._redis.pipeline()
        pipe.srem(_KEY_TYPING_SET.format(room_id=room_id), user_id)
        pipe.delete(
            _KEY_TYPING_USER_TTL.format(room_id=room_id, user_id=user_id)
        )
        await pipe.execute()
        return await self._get_typing_users(room_id)

    async def clear_typing(
        self,
        user_id: str,
        room_id: str,
    ) -> None:
        """Clear a user's typing state without returning the updated list.

        Called on disconnect to ensure no stale typing indicators remain.

        Args:
            user_id: UUID string of the disconnecting user.
            room_id: UUID string of the room.
        """
        pipe = self._redis.pipeline()
        pipe.srem(_KEY_TYPING_SET.format(room_id=room_id), user_id)
        pipe.delete(
            _KEY_TYPING_USER_TTL.format(room_id=room_id, user_id=user_id)
        )
        await pipe.execute()

    async def get_typing_users(
        self,
        room_id: str,
    ) -> list[str]:
        """Return the list of users currently typing in a room.

        Prunes any users whose per-user TTL key has expired (stale entries
        left after client disconnects without sending typing.stop).

        Args:
            room_id: UUID string of the room.

        Returns:
            list[str]: Active typing user_ids.
        """
        return await self._get_typing_users(room_id)

    async def _get_typing_users(self, room_id: str) -> list[str]:
        """Internal: fetch and prune the typing set.

        Args:
            room_id: UUID string of the room.

        Returns:
            list[str]: Active typing user_ids.
        """
        members = await self._redis.smembers(
            _KEY_TYPING_SET.format(room_id=room_id)
        )
        active: list[str] = []
        stale: list[str] = []

        for m in members:
            uid = m.decode() if isinstance(m, bytes) else m
            ttl_key = _KEY_TYPING_USER_TTL.format(room_id=room_id, user_id=uid)
            still_alive = await self._redis.exists(ttl_key)
            if still_alive:
                active.append(uid)
            else:
                stale.append(uid)

        # Prune stale entries from the set
        if stale:
            await self._redis.srem(
                _KEY_TYPING_SET.format(room_id=room_id), *stale
            )

        return active

    def build_typing_update_envelope(
        self,
        room_id: str,
        typing_user_ids: list[str],
    ) -> str:
        """Build a serialized typing.update envelope for Pub/Sub broadcast.

        Args:
            room_id: Room UUID string.
            typing_user_ids: Current list of typing user UUIDs.

        Returns:
            str: Serialized JSON envelope string.
        """
        payload = typing_update_payload(
            room_id=room_id,
            typing_user_ids=typing_user_ids,
        )
        envelope = make_envelope(
            WSEventType.TYPING_UPDATE,
            payload,
            room_id=room_id,
        )
        return envelope.to_json()


# ===========================================================================
# ReadReceiptService
# ===========================================================================


class ReadReceiptService:
    """Tracks per-user read cursors and unread counts per room.

    Uses Redis strings for the last-read message ID (fast, no DB write
    on every message read). Unread count is computed on request.

    Args:
        redis: Async Redis client.
    """

    def __init__(self, redis: Redis) -> None:
        """Initialize the read receipt service.

        Args:
            redis: Async Redis client.
        """
        self._redis = redis

    _KEY_READ = "chat:read:{room_id}:{user_id}"
    _KEY_UNREAD_COUNT = "chat:unread:{room_id}:{user_id}"

    async def mark_read(
        self,
        user_id: str,
        room_id: str,
        last_read_message_id: str,
    ) -> None:
        """Update the user's last-read message cursor for a room.

        Args:
            user_id: UUID string of the reading user.
            room_id: UUID string of the room.
            last_read_message_id: UUID string of the last message read.
        """
        await self._redis.set(
            self._KEY_READ.format(room_id=room_id, user_id=user_id),
            last_read_message_id,
        )
        # Reset unread counter
        await self._redis.delete(
            self._KEY_UNREAD_COUNT.format(room_id=room_id, user_id=user_id)
        )

    async def get_last_read(
        self,
        user_id: str,
        room_id: str,
    ) -> Optional[str]:
        """Retrieve the user's last-read message UUID for a room.

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.

        Returns:
            str | None: Last-read message UUID or None if never read.
        """
        val = await self._redis.get(
            self._KEY_READ.format(room_id=room_id, user_id=user_id)
        )
        if val is None:
            return None
        return val.decode() if isinstance(val, bytes) else val

    async def increment_unread(
        self,
        room_id: str,
        exclude_user_id: str,
        all_member_ids: list[str],
    ) -> None:
        """Increment the unread counter for all room members except the sender.

        Args:
            room_id: UUID string of the room.
            exclude_user_id: Sender's UUID — not incremented.
            all_member_ids: All enrolled user UUIDs in the room.
        """
        pipe = self._redis.pipeline()
        for uid in all_member_ids:
            if uid == exclude_user_id:
                continue
            pipe.incr(
                self._KEY_UNREAD_COUNT.format(room_id=room_id, user_id=uid)
            )
        await pipe.execute()

    async def get_unread_count(
        self,
        user_id: str,
        room_id: str,
    ) -> int:
        """Return the number of unread messages for a user in a room.

        Args:
            user_id: UUID string of the user.
            room_id: UUID string of the room.

        Returns:
            int: Unread message count (0 if never tracked).
        """
        val = await self._redis.get(
            self._KEY_UNREAD_COUNT.format(room_id=room_id, user_id=user_id)
        )
        if val is None:
            return 0
        return int(val)
