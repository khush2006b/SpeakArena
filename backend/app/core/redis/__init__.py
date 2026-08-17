"""Redis sub-package.

Exports:
    RedisClient  : Singleton connection pool manager.
    get_redis    : FastAPI dependency — yields the active Redis client.
    RedisKeys    : All Redis key builder functions.
    RedisOps     : Namespace of typed Redis operation wrappers.
"""

from app.core.redis.client import RedisClient, get_redis
from app.core.redis.keys import RedisKeys
from app.core.redis import operations as RedisOps

__all__ = ["RedisClient", "get_redis", "RedisKeys", "RedisOps"]
