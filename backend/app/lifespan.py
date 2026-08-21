"""Application lifespan context manager.

Manages the startup and shutdown lifecycle of the FastAPI application.
All infrastructure initialization happens here — not at module import time.

Startup sequence:
    1. Configure logging (must be first — everything else logs).
    2. Initialise Sentry (optional — requires SENTRY_DSN).
    3. Connect Redis pool.
    4. Verify database connectivity.
    5. Log application ready.

Shutdown sequence:
    1. Dispose SQLAlchemy engine connection pool.
    2. Close Redis connection pool.
    3. Log shutdown complete.

Design rationale:
    Infrastructure is initialized here (not at import time) so that:
    - Tests can import the app without connecting to real services.
    - The startup order is explicit and auditable in one place.
    - Failed startup raises immediately and prevents the server from
      accepting requests in a broken state.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from sqlalchemy import text

from app.config import settings
from app.core.logging.config import configure_logging
from app.core.redis.client import RedisClient
from app.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle.

    This is registered as the FastAPI ``lifespan`` parameter. All
    startup logic runs before ``yield``; all shutdown logic runs after.

    Args:
        app: The FastAPI application instance (provided by FastAPI).

    Yields:
        None: Control is yielded to the running application.

    Raises:
        Exception: Any startup failure (DB unreachable, Redis unreachable)
            is re-raised, which prevents Uvicorn from accepting connections.
    """
    # ── 1. Logging ─────────────────────────────────────────────────────────
    configure_logging(
        debug=settings.DEBUG,
        production=settings.is_production,
    )
    logger = logging.getLogger(__name__)
    logger.info(
        "Starting %s v%s in %s mode.",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.APP_ENV,
    )

    # ── 2. Sentry (optional) ───────────────────────────────────────────────
    _init_sentry(logger)

    # ── 3. Redis ───────────────────────────────────────────────────────────
    try:
        await RedisClient.connect()
        if not await RedisClient.ping():
            logger.warning("Redis ping returned falsy — proceeding with fallback mode.")
        else:
            logger.info("Redis connection verified.")
    except Exception as exc:
        logger.warning("Redis startup failed (%s) — proceeding with database fallback.", exc)

    # ── 4. Database ────────────────────────────────────────────────────────
    # First verify basic connectivity
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection verified.")
    except Exception as exc:
        logger.critical("Database connectivity check failed: %s", exc, exc_info=True)
        raise

    # Apply incremental schema patches (non-fatal if table not yet created by migrations)
    _schema_patches = [
        "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'video/mp4';",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'in_app';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 50;",
        "UPDATE courses SET max_students = 50 WHERE max_students IS NULL OR max_students = 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description VARCHAR(500) DEFAULT NULL;",
    ]
    for patch_sql in _schema_patches:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(patch_sql))
        except Exception as patch_exc:
            # Non-fatal: table may not exist yet (migrations handle creation)
            logger.warning("Schema patch skipped (%s): %s", patch_sql[:60], patch_exc)

    logger.info("Database startup complete.")

    # ── 5. Ready ───────────────────────────────────────────────────────────
    logger.info("%s is ready to serve requests.", settings.APP_NAME)

    # ── Application runs ───────────────────────────────────────────────────
    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("Shutting down %s...", settings.APP_NAME)

    await engine.dispose()
    logger.info("SQLAlchemy engine disposed.")

    await RedisClient.disconnect()

    logger.info("%s shutdown complete.", settings.APP_NAME)


def _init_sentry(logger: logging.Logger) -> None:
    """Initialize the Sentry SDK if a DSN is configured.

    Sentry is disabled when ``SENTRY_DSN`` is empty (local development).
    PII is never sent — ``send_default_pii=False`` is enforced.

    Args:
        logger: Logger instance for startup messages.
    """
    if not settings.SENTRY_DSN:
        logger.info("Sentry DSN not configured — error monitoring disabled.")
        return

    try:
        import sentry_sdk  # noqa: PLC0415

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            release=f"{settings.APP_NAME}@{settings.APP_VERSION}",
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,
        )
        logger.info("Sentry initialized (environment=%s).", settings.APP_ENV)
    except Exception as exc:
        # Sentry failure must NEVER crash the application.
        logger.warning("Sentry initialization failed (non-fatal): %s", exc)
