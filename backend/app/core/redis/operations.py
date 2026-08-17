"""Typed async Redis operation wrappers.

Provides a thin, strongly-typed interface over raw redis-py calls.
All operations:
    - Accept the Redis client as the first argument (no global state).
    - Handle encoding/decoding internally.
    - Log errors without re-raising (callers can decide how to handle).
    - Are individually unit-testable with a mocked Redis client.

Atomic operations:
    ``increment_with_expiry`` uses a Lua script so that the INCR and
    conditional EXPIRE are executed in a single atomic round-trip,
    eliminating the race window where a crash between the two commands
    would leave a counter key with no TTL (permanent rate-limit lock).

Import pattern::

    from app.core.redis import RedisOps
    await RedisOps.set_str(redis, key, value, ex=300)
"""

from __future__ import annotations

import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


async def set_str(
    client: Redis,
    key: str,
    value: str,
    ex: int | None = None,
) -> bool:
    """Set a string value in Redis.

    Args:
        client: The async Redis client.
        key: Redis key.
        value: String value to store.
        ex: Optional TTL in seconds. If None, the key never expires.

    Returns:
        bool: True if the SET succeeded, False on error.
    """
    try:
        result = await client.set(key, value, ex=ex)
        return bool(result)
    except RedisError as exc:
        logger.error("Redis SET failed key=%r: %s", key, exc)
        return False


async def get_str(client: Redis, key: str) -> str | None:
    """Get a string value from Redis.

    Args:
        client: The async Redis client.
        key: Redis key.

    Returns:
        str | None: The stored string, or None if the key does not exist
            or an error occurred.
    """
    try:
        return await client.get(key)  # type: ignore[return-value]
    except RedisError as exc:
        logger.error("Redis GET failed key=%r: %s", key, exc)
        return None


async def delete_key(client: Redis, *keys: str) -> int:
    """Delete one or more keys from Redis.

    Args:
        client: The async Redis client.
        *keys: One or more Redis keys to delete.

    Returns:
        int: Number of keys that were deleted (0 if none existed).
    """
    if not keys:
        return 0
    try:
        return await client.delete(*keys)  # type: ignore[return-value]
    except RedisError as exc:
        logger.error("Redis DELETE failed keys=%r: %s", keys, exc)
        return 0


async def key_exists(client: Redis, key: str) -> bool:
    """Check whether a key exists in Redis.

    Args:
        client: The async Redis client.
        key: Redis key.

    Returns:
        bool: True if the key exists, False if it does not or on error.
    """
    try:
        count: int = await client.exists(key)  # type: ignore[assignment]
        return count > 0
    except RedisError as exc:
        logger.error("Redis EXISTS failed key=%r: %s", key, exc)
        return False


# ---------------------------------------------------------------------------
# Lua script: atomic increment with conditional TTL
# ---------------------------------------------------------------------------
# Increments the key by 1. If the resulting count is 1 (the key was just
# created), sets the TTL in a single atomic call. This eliminates the race
# window between INCR and EXPIRE that exists when they are separate commands:
# if the process crashed after INCR but before EXPIRE, the key would never
# expire, causing a permanent rate-limit lock for the affected user/IP.
#
# Lua scripts execute atomically in Redis — no other command can interleave.
_INCR_EXPIRE_SCRIPT: str = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


async def increment_with_expiry(client: Redis, key: str, window_seconds: int) -> int:
    """Atomically increment a counter and set its TTL on first creation.

    Implements the fixed-window rate-limit counter pattern using a Lua
    script so that INCR and EXPIRE are a single atomic operation. The
    TTL is set only when the count transitions from 0 to 1, locking the
    window start at the time of the first request.

    Security note:
        The previous two-command implementation (INCR then EXPIRE) had a
        race condition: if the server process died between the two commands,
        the counter key would accumulate indefinitely, causing a permanent
        rate-limit lockout. This Lua script is immune to that race.

    Args:
        client: The async Redis client.
        key: Redis key for the rate-limit counter.
        window_seconds: Window duration in seconds (TTL applied on first hit).

    Returns:
        int: Counter value after incrementing (1 on the first request
            in the window, N on the Nth request).

    Raises:
        RedisError: If Lua script execution fails (caller handles).
    """
    result = await client.eval(_INCR_EXPIRE_SCRIPT, 1, key, window_seconds)  # type: ignore[attr-defined]
    return int(result)


async def get_ttl(client: Redis, key: str) -> int:
    """Get the remaining TTL of a key in seconds.

    Args:
        client: The async Redis client.
        key: Redis key.

    Returns:
        int: Remaining TTL in seconds.
            -1 if the key has no expiry.
            -2 if the key does not exist.
    """
    try:
        return await client.ttl(key)  # type: ignore[return-value]
    except RedisError as exc:
        logger.error("Redis TTL failed key=%r: %s", key, exc)
        return -2


async def set_if_not_exists(client: Redis, key: str, value: str, ex: int) -> bool:
    """Set a key only if it does not already exist (atomic SET NX EX).

    Used for distributed locks and idempotency enforcement.

    Args:
        client: The async Redis client.
        key: Redis key.
        value: String value to store.
        ex: TTL in seconds. Required — NX keys must always expire.

    Returns:
        bool: True if the key was set (did not previously exist).
            False if the key already existed or an error occurred.
    """
    try:
        result = await client.set(key, value, ex=ex, nx=True)
        return result is True
    except RedisError as exc:
        logger.error("Redis SETNX failed key=%r: %s", key, exc)
        return False
