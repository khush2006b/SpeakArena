"""Logging sub-package.

Exports:
    configure_logging: Call once at application startup.
    get_logger: Use in every module as ``logger = get_logger(__name__)``.
"""

from app.core.logging.config import configure_logging
from app.core.logging.factory import get_logger

__all__ = ["configure_logging", "get_logger"]
