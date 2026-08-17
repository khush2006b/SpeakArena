"""Structured JSON logging for the SpeakArena backend.

Provides a factory function that returns a logger configured
to emit structured JSON records in production and human-readable
colored output in development. Every log record includes the
service name and can be extended with arbitrary extra fields.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects.

    Each record contains: timestamp, level, service, logger, message,
    and any extra fields attached via the ``extra`` parameter.
    Stack traces are included on ERROR and above.
    """

    SERVICE_NAME = "speakarena-api"

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        """Format a log record as a JSON string.

        Args:
            record: The log record to format.

        Returns:
            str: A single-line JSON string.
        """
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.SERVICE_NAME,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include extra fields injected via logger.info(..., extra={...})
        for key, value in record.__dict__.items():
            if key not in (
                "args", "asctime", "created", "exc_info", "exc_text",
                "filename", "funcName", "id", "levelname", "levelno",
                "lineno", "module", "msecs", "message", "msg",
                "name", "pathname", "process", "processName",
                "relativeCreated", "stack_info", "thread", "threadName",
            ):
                log_entry[key] = value

        # Include exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for the given module name.

    In production: emits structured JSON to stdout.
    In development: emits human-readable colored output to stdout.

    The log level is INFO by default and can be overridden via the
    LOG_LEVEL environment variable.

    Args:
        name: The logger name, typically ``__name__``.

    Returns:
        logging.Logger: Configured logger instance.
    """
    import os
    app_env = os.getenv("APP_ENV", "development")
    log_level_name = os.getenv("LOG_LEVEL", "DEBUG" if app_env == "development" else "INFO")
    log_level = getattr(logging, log_level_name.upper(), logging.INFO)

    logger = logging.getLogger(name)

    if logger.handlers:
        # Avoid adding duplicate handlers when the module is re-imported
        return logger

    logger.setLevel(log_level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if app_env == "production":
        handler.setFormatter(JsonFormatter())
    else:
        # Development: colored, readable format
        fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        handler.setFormatter(logging.Formatter(fmt, datefmt="%H:%M:%S"))

    logger.addHandler(handler)
    logger.propagate = False  # Prevent double-logging via root logger
    return logger
