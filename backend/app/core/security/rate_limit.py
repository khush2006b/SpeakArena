"""Redis-based Rate Limiting Dependency."""

from __future__ import annotations

from typing import Callable

from fastapi import Depends, Request
from starlette.exceptions import HTTPException
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
from redis.asyncio import Redis

from app.core.redis.client import get_redis


class RateLimiter:
    """Dependency class to enforce rate limits via Redis.
    
    Uses a simple fixed-window counter approach.
    """

    def __init__(self, times: int, seconds: int) -> None:
        """Initialize the rate limiter.
        
        Args:
            times: Maximum allowed requests.
            seconds: Time window in seconds.
        """
        self.times = times
        self.seconds = seconds

    async def __call__(self, request: Request, redis: Redis = Depends(get_redis)) -> None:
        """Evaluate the rate limit for the incoming request."""
        # Use client IP as the identifier. In a real prod setup behind a proxy, 
        # ensure X-Forwarded-For is parsed correctly (FastAPI Request.client.host handles basic cases).
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown"
        path = request.url.path
        
        # Key format: rate_limit:{path}:{ip}
        key = f"rate_limit:{path}:{client_ip}"
        
        # Pipeline to execute INCR and EXPIRE atomically
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            # We only set the TTL if this is the first hit in the window (val == 1)
            # However, for simplicity and atomic execution, we can just call expire 
            # and ignore if it overrides an existing TTL slightly, or use a more precise Lua script.
            # Using the simpler approach for this dependency.
            pipe.expire(key, self.seconds, nx=True)
            results = await pipe.execute()
            
        current_count = results[0]
        
        if current_count > self.times:
            raise HTTPException(
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later."
            )
