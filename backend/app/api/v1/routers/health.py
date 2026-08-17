"""Health check endpoints for SpeakArena.

Provides three distinct endpoints for different monitoring use cases:

    GET /api/v1/health
        Full application health report. Used by operations dashboards.
        Checks all dependencies. Returns 200 (healthy) or 503 (degraded).

    GET /api/v1/ready
        Readiness probe. Used by Kubernetes/Docker to gate traffic.
        Returns 200 only when ALL dependencies are reachable.
        Returns 503 when any dependency is unavailable.

    GET /api/v1/live
        Liveness probe. Used to detect deadlocked/hung processes.
        Returns 200 if the event loop is processing requests.
        Does NOT check dependencies — a failed DB should not kill the pod.

Security:
    These endpoints are NOT authenticated. They must be accessible to
    load balancers and health check tools without credentials.
    They return NO sensitive information (no config values, no secrets).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.redis.client import get_redis
from app.database import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["Health"])


# ---------------------------------------------------------------------------
# Dependency check helpers
# ---------------------------------------------------------------------------


async def _check_database(session: AsyncSession) -> dict[str, str]:
    """Verify database connectivity with a lightweight query.

    Args:
        session: The active async database session.

    Returns:
        dict: Status dict with keys ``status`` and optionally ``error``.
    """
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        logger.error("Health check — database failed: %s", exc)
        return {"status": "error", "error": "Database unreachable"}


async def _check_redis(redis: Redis) -> dict[str, str]:
    """Verify Redis connectivity with a PING command.

    Args:
        redis: The active async Redis client.

    Returns:
        dict: Status dict with keys ``status`` and optionally ``error``.
    """
    try:
        pong = await redis.ping()
        if pong:
            return {"status": "ok"}
        return {"status": "error", "error": "Redis PING returned falsy"}
    except Exception as exc:
        logger.error("Health check — Redis failed: %s", exc)
        return {"status": "error", "error": "Redis unreachable"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    summary="Full health report",
    description="Returns the health status of the application and all dependencies.",
    include_in_schema=True,
)
async def full_health(
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return a full health report including all dependency statuses.

    Performs real connectivity checks against PostgreSQL and Redis.
    Returns HTTP 503 if any dependency is unavailable.

    Args:
        session: Injected async database session.
        redis: Injected async Redis client.

    Returns:
        JSONResponse: 200 when healthy, 503 when any check fails.
            Body contains per-dependency status and application metadata.
    """
    db_status = await _check_database(session)
    redis_status = await _check_redis(redis)

    all_ok = (
        db_status["status"] == "ok"
        and redis_status["status"] == "ok"
    )

    checks: dict[str, Any] = {
        "database": db_status,
        "redis": redis_status,
    }

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            "status": "healthy" if all_ok else "degraded",
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "checks": checks,
        },
    )


@router.get(
    "/ready",
    summary="Readiness probe",
    description="Used by orchestrators to determine if the instance can serve traffic.",
    include_in_schema=True,
)
async def readiness_probe(
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Kubernetes/Docker readiness probe endpoint.

    Returns HTTP 200 only when the application can serve requests
    (all dependencies are reachable). Returns HTTP 503 otherwise,
    which causes the orchestrator to route traffic away from this
    instance until it recovers.

    Args:
        session: Injected async database session.
        redis: Injected async Redis client.

    Returns:
        JSONResponse: 200 when ready, 503 when not ready.
    """
    db_status = await _check_database(session)
    redis_status = await _check_redis(redis)

    is_ready = (
        db_status["status"] == "ok"
        and redis_status["status"] == "ok"
    )

    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={
            "status": "ready" if is_ready else "not_ready",
            "checks": {
                "database": db_status,
                "redis": redis_status,
            },
        },
    )


@router.get(
    "/live",
    summary="Liveness probe",
    description="Used by orchestrators to detect deadlocked processes.",
    include_in_schema=True,
)
async def liveness_probe() -> dict[str, str]:
    """Kubernetes/Docker liveness probe endpoint.

    Returns HTTP 200 if the event loop is alive and processing requests.
    Does NOT check external dependencies — a database outage should NOT
    cause the liveness probe to fail and trigger an unnecessary pod restart.

    Returns:
        dict: Simple alive status and version.
    """
    return {"status": "alive", "version": settings.APP_VERSION}
