"""Redis client and connection pool management.

Provides a Redis connection pool and a FastAPI dependency for
injecting Redis connections into routes and services. Uses the
hiredis parser for maximum throughput.
"""

from collections.abc import AsyncGenerator

from redis.asyncio import ConnectionPool, Redis

from app.config import settings

# ---------------------------------------------------------------------------
# Connection pool (created once at module import time)
# ---------------------------------------------------------------------------

redis_pool = ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=settings.REDIS_MAX_CONNECTIONS,
    decode_responses=True,   # Always return str, not bytes
    encoding="utf-8",
)

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def get_redis() -> AsyncGenerator[Redis, None]:
    """Yield a Redis connection from the shared connection pool.

    The connection is returned to the pool automatically when
    the async context exits — no manual close needed.

    Yields:
        Redis: An active Redis client instance.
    """
    async with Redis(connection_pool=redis_pool) as client:
        yield client
