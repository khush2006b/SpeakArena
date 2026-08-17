"""Centralized logging configuration for SpeakArena.

Provides two logging configurations:

- Development: Human-readable, colored console output with DEBUG level.
- Production : JSON-structured records to stdout and rotating log files.

The ``configure_logging`` function must be called exactly once during
application startup (inside the lifespan context manager). It is safe
to call in tests via ``configure_logging()`` in a conftest fixture.

Production log files:
    logs/app.log   - All INFO+ records. Rotated daily, 30 days kept.
    logs/error.log - ERROR+ records. Rotated daily, 90 days kept.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON for log aggregation.

    Output fields:
        timestamp  : ISO-8601 UTC string.
        level      : Log level name (INFO, WARNING, ERROR, CRITICAL).
        logger     : Logger name (module path).
        message    : Formatted log message.
        module     : Python module name.
        function   : Function name.
        line       : Line number.
        request_id : Injected by RequestContextMiddleware (optional).
        user_id    : Injected by auth dependency (optional).
        exception  : Structured exception info (optional).
        extra      : Any additional fields passed via ``extra={}``.
    """

    SERVICE_NAME: str = "speakarena-api"

    # Fields that are part of the standard LogRecord and should NOT be
    # treated as "extra" fields injected by the caller.
    _SKIP_KEYS: frozenset[str] = frozenset(
        {
            "args", "asctime", "created", "exc_info", "exc_text",
            "filename", "funcName", "levelname", "levelno", "lineno",
            "message", "module", "msecs", "msg", "name", "pathname",
            "process", "processName", "relativeCreated", "stack_info",
            "taskName", "thread", "threadName",
        }
    )

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        """Format a log record as a JSON string.

        Args:
            record: The log record to format.

        Returns:
            str: A single-line JSON string.
        """
        log_data: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.SERVICE_NAME,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Optional context fields injected by middleware / dependencies.
        if request_id := getattr(record, "request_id", None):
            log_data["request_id"] = request_id
        if user_id := getattr(record, "user_id", None):
            log_data["user_id"] = user_id

        # Structured exception information.
        if record.exc_info:
            exc_type, exc_value, exc_tb = record.exc_info
            log_data["exception"] = {
                "type": exc_type.__name__ if exc_type else None,
                "message": str(exc_value),
                "traceback": traceback.format_exception(
                    exc_type, exc_value, exc_tb
                ),
            }

        # Caller-injected extra fields.
        extra: dict[str, Any] = {
            k: v
            for k, v in record.__dict__.items()
            if k not in self._SKIP_KEYS
            and k not in {"request_id", "user_id"}
        }
        if extra:
            log_data["extra"] = extra

        return json.dumps(log_data, default=str, ensure_ascii=False)


_CONSOLE_FMT = "%(asctime)s | %(levelname)-8s | %(name)-40s | %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def configure_logging(*, debug: bool = False, production: bool = False) -> None:
    """Configure application-wide logging.

    Must be called once at application startup. Calling multiple times
    is safe — existing handlers are cleared before reconfiguring.

    In production mode:
        - JSON formatter on stdout (for Docker/K8s log collection).
        - Rotating file handlers: logs/app.log and logs/error.log.

    In development mode:
        - Human-readable formatter on stdout.
        - DEBUG level enabled.

    Args:
        debug: If True, set root logger to DEBUG level.
        production: If True, use JSON formatter and file handlers.
    """
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    root.handlers.clear()

    if production:
        _attach_production_handlers(root)
    else:
        _attach_development_handlers(root, debug=debug)

    # Silence noisy third-party loggers that would flood the output.
    _configure_third_party_loggers(debug=debug)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _attach_production_handlers(root: logging.Logger) -> None:
    """Attach JSON stdout and rotating file handlers for production.

    Args:
        root: The root logging.Logger instance.
    """
    json_fmt = JSONFormatter()

    # 1. Stdout handler — consumed by Docker / container runtimes.
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(json_fmt)
    stdout_handler.setLevel(logging.INFO)
    root.addHandler(stdout_handler)

    # 2. General rotating file handler (all INFO+ records).
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    app_file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=log_dir / "app.log",
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
        utc=True,
    )
    app_file_handler.setFormatter(json_fmt)
    app_file_handler.setLevel(logging.INFO)
    root.addHandler(app_file_handler)

    # 3. Error-only rotating file handler (90-day retention for post-mortems).
    error_file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=log_dir / "error.log",
        when="midnight",
        interval=1,
        backupCount=90,
        encoding="utf-8",
        utc=True,
    )
    error_file_handler.setFormatter(json_fmt)
    error_file_handler.setLevel(logging.ERROR)
    root.addHandler(error_file_handler)


def _attach_development_handlers(root: logging.Logger, *, debug: bool) -> None:
    """Attach a human-readable console handler for local development.

    Args:
        root: The root logging.Logger instance.
        debug: If True, handler level is set to DEBUG.
    """
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(
        logging.Formatter(_CONSOLE_FMT, datefmt=_DATE_FMT)
    )
    console_handler.setLevel(logging.DEBUG if debug else logging.INFO)
    root.addHandler(console_handler)


def _configure_third_party_loggers(*, debug: bool) -> None:
    """Silence or reduce verbosity of third-party library loggers.

    Args:
        debug: If True, SQLAlchemy engine logs are kept at INFO.
    """
    noisy_loggers = {
        "uvicorn.access": logging.WARNING,
        "sqlalchemy.engine": logging.INFO if debug else logging.WARNING,
        "sqlalchemy.pool": logging.WARNING,
        "sqlalchemy.dialects": logging.WARNING,
        "httpx": logging.WARNING,
        "httpcore": logging.WARNING,
        "boto3": logging.WARNING,
        "botocore": logging.WARNING,
        "s3transfer": logging.WARNING,
        "asyncio": logging.WARNING,
    }
    for name, level in noisy_loggers.items():
        logging.getLogger(name).setLevel(level)
