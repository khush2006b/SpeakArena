# =============================================================================
# SpeakArena Backend — Production Dockerfile
# Python 3.13 · Multi-stage · Non-root · Minimal attack surface
#
# Stages:
#   builder  — compiles wheels for all dependencies
#   final    — slim runtime image (~150 MB)
#
# Build args:
#   APP_VERSION  — injected by CI (git SHA). Default: "dev"
# =============================================================================

ARG PYTHON_VERSION=3.13
ARG APP_VERSION=dev

# ---------------------------------------------------------------------------
# Stage 1: Builder — install and compile all Python deps
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim AS builder

ARG APP_VERSION

# Prevents Python from writing .pyc files and enables stdout/stderr logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build-time system dependencies (removed in final stage)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker layer caching
COPY requirements.txt .

# Create virtual environment and install all dependencies
RUN python -m venv /venv \
    && /venv/bin/pip install --upgrade pip wheel "setuptools<70.0.0" \
    && /venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/venv/bin:$PATH"

# ---------------------------------------------------------------------------
# Stage 2: Final — minimal runtime image
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim AS final

ARG APP_VERSION

# OCI image labels (SBOM / provenance)
LABEL org.opencontainers.image.title="SpeakArena Backend" \
      org.opencontainers.image.description="FastAPI backend for the SpeakArena online teaching platform" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.vendor="SpeakArena" \
      org.opencontainers.image.base.name="python:3.13-slim" \
      org.opencontainers.image.source="https://github.com/speakarena/speakarena"

# Security hardening: run as dedicated non-root user
RUN groupadd --gid 1001 speakarena \
    && useradd \
        --uid 1001 \
        --gid speakarena \
        --shell /sbin/nologin \
        --no-create-home \
        speakarena

# Install only runtime system libraries (NO build tools in final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y \
    && rm -rf /tmp/* /var/tmp/*

# Set working directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /venv /venv

# Copy application source (exclude test files, CI config, etc.)
COPY --chown=speakarena:speakarena app/ ./app/
COPY --chown=speakarena:speakarena alembic/ ./alembic/
COPY --chown=speakarena:speakarena alembic.ini ./alembic.ini
COPY --chown=speakarena:speakarena pyproject.toml ./pyproject.toml

# Runtime environment
ENV PATH="/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    APP_VERSION="${APP_VERSION}" \
    # Gunicorn tuning (override via env in compose/k8s)
    GUNICORN_WORKERS=3 \
    GUNICORN_TIMEOUT=120 \
    GUNICORN_KEEPALIVE=5 \
    GUNICORN_MAX_REQUESTS=1000 \
    GUNICORN_MAX_REQUESTS_JITTER=100

# Create log directory with proper permissions for speakarena user
RUN mkdir -p /app/logs && chown -R speakarena:speakarena /app/logs

# Security: ensure no world-writable files
RUN find /app -type d -exec chmod 755 {} + \
    && find /app -type f -exec chmod 644 {} +

# Drop to non-root user
USER speakarena

# Expose application port
EXPOSE 8000

# Health check — liveness probe
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=45s \
    --retries=3 \
    CMD curl -fsS http://localhost:8000/health/live || exit 1

# Production entrypoint: run Alembic migrations then start Gunicorn with Uvicorn workers
# Adjust GUNICORN_WORKERS via environment variable (recommended: 2 × CPU cores)
CMD ["sh", "-c", \
    "/venv/bin/alembic upgrade head || true && \
    exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${GUNICORN_WORKERS} \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout ${GUNICORN_TIMEOUT} \
    --keep-alive ${GUNICORN_KEEPALIVE} \
    --max-requests ${GUNICORN_MAX_REQUESTS} \
    --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER} \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --forwarded-allow-ips='*'"]
