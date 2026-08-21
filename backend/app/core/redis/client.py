"""Redis connection pool lifecycle management.

The ``RedisClient`` class manages a single async Redis connection pool
for the entire application lifetime. The pool is initialized during
application startup via ``RedisClient.connect()`` and closed on shutdown
via ``RedisClient.disconnect()``.

The ``get_redis`` async generator is the FastAPI dependency used to
inject the shared Redis client into route handlers and services.

Design decisions:
    - Pool-based (not per-request connections): avoids TCP handshake
      overhead on every request.
    - ``decode_responses=True``: all responses are decoded to ``str``
      automatically — no ``.decode()`` calls scattered through the code.
    - ``health_check_interval=30``: idle connections are kept alive
      with background pings, preventing silent connection drops.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Singleton async Redis connection pool manager.

    Class-level state is intentional: the pool must survive the lifetime
    of the FastAPI application and be shared across all requests. There
    is never more than one pool per process.

    Attributes:
        _pool: The shared async Redis client (connection pool).
    """

    _pool: Redis | None = None

    @classmethod
    async def connect(cls) -> None:
        """Initialize the async Redis connection pool.

        Must be called once during application startup. Subsequent calls
        are no-ops if the pool is already initialized.

        Raises:
            RedisError: If the initial connection cannot be established.
        """
        if cls._pool is not None:
            logger.warning("RedisClient.connect() called more than once — ignoring.")
            return

        cls._pool = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            socket_timeout=10.0,
            socket_connect_timeout=10.0,
            retry_on_timeout=True,
            health_check_interval=30,
            ssl_cert_reqs=None,
        )
        logger.info("Redis connection pool initialized (max_connections=%d).", settings.REDIS_MAX_CONNECTIONS)

    @classmethod
    async def disconnect(cls) -> None:
        """Close the async Redis connection pool.

        Must be called once during application shutdown. Safe to call
        even if the pool was never initialized.
        """
        if cls._pool is None:
            return
        await cls._pool.aclose()
        cls._pool = None
        logger.info("Redis connection pool closed.")

    @classmethod
    def get_pool(cls) -> Redis:
        """Return the active Redis client.

        Returns:
            Redis: The active async Redis client.

        Raises:
            RuntimeError: If called before ``connect()`` has been awaited.
        """
        if cls._pool is None:
            raise RuntimeError(
                "Redis pool is not initialized. "
                "Ensure RedisClient.connect() was awaited during app startup."
            )
        return cls._pool

    @classmethod
    async def ping(cls) -> bool:
        """Perform a Redis PING to verify connectivity.

        Used by the readiness probe and startup validation. Does not raise
        on failure — returns False so callers can decide how to handle it.

        Returns:
            bool: True if Redis responds to PING within the socket timeout.
        """
        try:
            pool = cls.get_pool()
            return bool(await pool.ping())
        except (RedisError, RuntimeError) as exc:
            logger.warning("Redis health check failed: %s", exc)
            return False


async def get_redis() -> AsyncGenerator[Redis, None]:
    """FastAPI dependency: yield the shared Redis client.

    The yielded client is the same shared pool instance for all requests.
    Do NOT close it — the pool is closed by the lifespan shutdown handler.

    Yields:
        Redis: The active async Redis client.
    """
    if RedisClient._pool is None:
        try:
            await RedisClient.connect()
        except Exception as err:
            logger.warning("Auto-connecting Redis pool in get_redis: %s", err)
    yield RedisClient.get_pool()
