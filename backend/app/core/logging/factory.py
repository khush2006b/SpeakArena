"""Logger factory for the SpeakArena application.

Provides a single entry point for obtaining named loggers. All modules
should use this factory instead of ``logging.getLogger`` directly so
that any future logger customization is applied uniformly.

Usage::

    from app.core.logging.factory import get_logger
    logger = get_logger(__name__)
    logger.info("Processing request", extra={"request_id": req_id})
"""

from __future__ import annotations

import logging


def get_logger(name: str) -> logging.Logger:
    """Return a named logger instance.

    The returned logger inherits its configuration from the root logger
    which is set up by ``configure_logging()`` at startup. Do NOT set
    handlers or levels on the returned logger — configuration is
    managed centrally by ``configure_logging()``.

    Args:
        name: Logger name. Use ``__name__`` in all application modules
            to produce dot-separated hierarchical logger names that
            match the Python module path (e.g. ``app.modules.auth.service``).

    Returns:
        logging.Logger: A named logger instance.
    """
    return logging.getLogger(name)
