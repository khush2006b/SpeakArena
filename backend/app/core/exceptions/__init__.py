"""Exceptions sub-package.

Exports:
    Domain exception classes for use throughout the application.
    FastAPI exception handlers registered in main.py.
"""

from app.core.exceptions.errors import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    ServiceUnavailableError,
    UnprocessableEntityError,
    ValidationError,
)
from app.core.exceptions.handlers import register_exception_handlers

__all__ = [
    # Exceptions
    "AppError",
    "AuthenticationError",
    "AuthorizationError",
    "ConflictError",
    "NotFoundError",
    "RateLimitError",
    "ServiceUnavailableError",
    "UnprocessableEntityError",
    "ValidationError",
    # Handler registration
    "register_exception_handlers",
]
