"""SpeakArena FastAPI application entry point.

This module is the composition root. It:
    1. Creates the FastAPI application instance via ``create_application()``.
    2. Registers the lifespan context manager.
    3. Registers all middleware in the correct order.
    4. Registers all exception handlers.
    5. Mounts the versioned API router.

Only infrastructure-level concerns belong here. Business logic lives
in feature modules under ``app/modules/``.

Uvicorn entry point::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.core.exceptions.handlers import register_exception_handlers
from app.core.middleware.request_context import RequestContextMiddleware
from app.core.middleware.security_headers import SecurityHeadersMiddleware
from app.lifespan import lifespan


def create_application() -> FastAPI:
    """Create and fully configure the FastAPI application.

    Instantiates FastAPI with the production-appropriate settings
    (OpenAPI docs disabled in production), registers all middleware
    and exception handlers, and mounts the API router.

    Returns:
        FastAPI: The fully configured application instance, ready for
            Uvicorn to serve.
    """
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "SpeakArena: Production-grade education platform API. "
            "Teacher-led courses, live sessions, and student progress tracking."
        ),
        # Disable interactive docs in production to reduce attack surface.
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
        # Disable FastAPI's default exception handlers so ours take priority.
        # We register our own in register_exception_handlers().
    )

    # ── Middleware (registered in reverse execution order) ─────────────────
    # Starlette applies middleware in REVERSE registration order:
    # Last registered = outermost (first to see incoming request, last to see response).
    #
    # Desired execution order for incoming requests:
    #   1. RequestContext  → inject X-Request-ID, start response timer
    #   2. SecurityHeaders → inject CSP / HSTS / X-Frame-Options
    #   3. CORS            → validate Origin, inject CORS headers
    #   4. TrustedHost     → reject requests with unexpected Host headers
    #   5. GZip            → compress response body (innermost)
    #
    # Registration order: GZip → TrustedHost → CORS → SecurityHeaders → RequestContext

    # GZip compression: compresses response bodies >= 1 KB.
    # Registered first (innermost) so body is compressed before CORS /
    # security-header middlewares add their headers.
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    # TrustedHostMiddleware: rejects requests with Host headers not in the
    # allowed list to prevent Host header injection. Allow '*' in development.
    allowed_hosts = (
        [h.replace("https://", "").replace("http://", "").split("/")[0]
         for h in settings.CORS_ALLOWED_ORIGINS]
        if settings.is_production
        else ["*"]
    )
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOWED_ORIGINS,
        allow_credentials=True,  # Required for HttpOnly refresh token cookie.
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Response-Time", "Retry-After"],
        max_age=600,  # Cache preflight for 10 minutes.
    )

    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RequestContextMiddleware)

    # ── Exception handlers ─────────────────────────────────────────────────
    register_exception_handlers(application)

    # ── API Routers ────────────────────────────────────────────────────────
    # Imported here to avoid circular imports during the lifespan startup
    # phase, where settings are validated before routes are loaded.
    from app.api.v1.router import api_router  # noqa: PLC0415

    application.include_router(api_router, prefix="/api/v1")

    return application


# ---------------------------------------------------------------------------
# Application instance (module-level singleton for Uvicorn)
# ---------------------------------------------------------------------------

app: FastAPI = create_application()
