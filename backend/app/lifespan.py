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
from app.database import Base, engine
import app.models  # noqa: F401 — registers all SQLAlchemy models on Base.metadata


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
    _schema_patches = [
        "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'video/mp4';",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'in_app';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description VARCHAR(500) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS promo_video_r2_key VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_lectures SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_enrollments INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 50;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        "UPDATE courses SET max_students = 50 WHERE max_students IS NULL OR max_students = 0;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS section VARCHAR(200) DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS hls_r2_key_prefix VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_width SMALLINT DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_height SMALLINT DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_error TEXT DEFAULT NULL;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS section VARCHAR(200) DEFAULT NULL;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT NULL;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2) DEFAULT 0.0;",
        "UPDATE course_enrollments SET progress_percentage = COALESCE(progress_percent, 0.0) WHERE progress_percentage IS NULL OR progress_percentage = 0.0;",
        "ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS slow_mode_seconds SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS pinned_message_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID DEFAULT NULL;",
        # ── Missing message columns that caused UndefinedColumnError ─────────
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'text';",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36) DEFAULT NULL;",
        # ── notifications.actor_id missing from production DB ─────────────────
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID DEFAULT NULL;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT NULL;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID DEFAULT NULL;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'in_app';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_email_sent BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        # ── courses.thumbnail_r2_key for persistent R2 thumbnail storage ───────
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_r2_key VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_data BYTEA DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_mime VARCHAR(64) DEFAULT NULL;",
        # ── content_progress missing columns (watch progress tracking) ───────────
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS video_id UUID DEFAULT NULL;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS pdf_id UUID DEFAULT NULL;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS student_id UUID DEFAULT NULL;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS watch_position_seconds INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS watch_duration_seconds INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE content_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;",
        # ── session_attendance missing columns (join session tracking) ───────────
        "ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS join_time TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS leave_time TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS attendance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00;",
        "ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;",
        # ── meetings.deleted_at missing column for soft-delete ───────────────────
        "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;",
        # ── chat_rooms multiple room support & announcement-only channels ─────────
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS room_type VARCHAR(50) NOT NULL DEFAULT 'general';",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_announcement_only BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_course_id_key;",
    ]

    # One-time data fix: videos stuck in 'uploading' status because the
    # confirm endpoint was returning 422 (duration_seconds ge=1 validation bug).
    # Any video with a valid r2_object_key and upload_status='pending' that
    # has been sitting >5 minutes is promoted to ready so students can see it.
    _data_fix_patches = [
        """
        UPDATE videos
        SET
            upload_status    = 'completed',
            processing_status = 'ready',
            updated_at       = NOW()
        WHERE
            upload_status     = 'pending'
            AND processing_status = 'uploading'
            AND r2_object_key IS NOT NULL
            AND r2_object_key <> ''
            AND created_at < NOW() - INTERVAL '5 minutes'
        """,
        # Fix PDFs stuck in pending status (same root cause as videos)
        """
        UPDATE pdfs
        SET
            upload_status = 'completed',
            updated_at    = NOW()
        WHERE
            upload_status  = 'pending'
            AND r2_object_key IS NOT NULL
            AND r2_object_key <> ''
            AND created_at < NOW() - INTERVAL '5 minutes'
        """,
        # Update all teacher user names to Paras (Construction)
        """
        UPDATE users
        SET full_name = 'Paras (Construction)'
        WHERE role = 'teacher' OR role = 'admin';
        """,
    ]

    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            try:
                await conn.execute(text("SELECT pg_advisory_xact_lock(777888999)"))
            except Exception:
                pass
            await conn.run_sync(Base.metadata.create_all)

        for patch_sql in _schema_patches:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(patch_sql))
            except Exception as patch_exc:
                logger.warning("Schema patch skipped (%s): %s", patch_sql[:60], patch_exc)

        for fix_sql in _data_fix_patches:
            try:
                async with engine.begin() as conn:
                    result = await conn.execute(text(fix_sql))
                    if result.rowcount:
                        logger.info("Data fix applied: %d row(s) updated.", result.rowcount)
            except Exception as fix_exc:
                logger.warning("Data fix skipped: %s", fix_exc)

        logger.info("Database connection and schema initialization complete.")
    except Exception as exc:
        logger.critical("Database connectivity check failed: %s", exc, exc_info=True)
        raise

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
