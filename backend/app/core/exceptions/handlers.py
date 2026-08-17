"""FastAPI exception handlers.

Converts all application exceptions to a consistent JSON envelope:

    Success response::
        {"success": true, "data": ...}

    Error response::
        {"success": false, "error": {"code": "...", "message": "..."}}

Handlers registered here:
    1. ``AppError``              -> status_code from the exception class.
    2. ``RequestValidationError``-> 422 with field-level detail.
    3. ``HTTPException``         -> Passed through with standard envelope.
    4. Catch-all ``Exception``   -> 500 with request_id for support lookup.

Security note:
    Stack traces and internal detail fields NEVER appear in API responses.
    They are logged server-side only.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions.errors import AccountLockedError, AppError, RateLimitError

logger = logging.getLogger(__name__)


def _error_response(
    status_code: int,
    error_code: str,
    message: str,
    *,
    request_id: str | None = None,
    headers: dict[str, str] | None = None,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    """Build a standardized error JSON response.

    Args:
        status_code: HTTP status code.
        error_code: Machine-readable PascalCase error identifier.
        message: Human-readable client-safe message.
        request_id: Request trace ID (from X-Request-ID header).
        headers: Optional extra response headers.
        extra: Optional extra fields merged into the error object.

    Returns:
        JSONResponse: Standardized error response.
    """
    error_body: dict[str, Any] = {
        "code": error_code,
        "message": message,
    }
    if request_id:
        error_body["request_id"] = request_id
    if extra:
        error_body.update(extra)

    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": error_body},
        headers=headers,
    )


def _get_request_id(request: Request) -> str | None:
    """Extract the request ID from request state.

    Args:
        request: The incoming FastAPI request.

    Returns:
        str | None: The request ID, or None if not set.
    """
    return getattr(request.state, "request_id", None)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle all ``AppError`` subclass exceptions.

    Converts the domain exception to a standardized HTTP error response.
    Includes ``retry_after`` in headers and body for 429 and 423 responses.

    Args:
        request: The incoming request.
        exc: The raised AppError instance.

    Returns:
        JSONResponse: Standardized error response.
    """
    request_id = _get_request_id(request)

    # Log at appropriate level based on severity.
    log_extra: dict[str, Any] = {
        "error_code": exc.error_code,
        "status_code": exc.status_code,
        "request_id": request_id,
    }
    if exc.detail is not None:
        log_extra["detail"] = exc.detail

    if exc.status_code >= 500:
        logger.error("Application error: %s", exc.message, extra=log_extra)
    elif exc.status_code >= 400:
        logger.warning("Client error: %s", exc.message, extra=log_extra)

    # Build response headers.
    response_headers: dict[str, str] = {}
    extra_body: dict[str, Any] = {}

    if isinstance(exc, RateLimitError):
        response_headers["Retry-After"] = str(exc.retry_after)
        extra_body["retry_after"] = exc.retry_after

    if isinstance(exc, AccountLockedError):
        response_headers["Retry-After"] = str(exc.retry_after)
        extra_body["retry_after"] = exc.retry_after

    return _error_response(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        request_id=request_id,
        headers=response_headers or None,
        extra=extra_body or None,
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle Pydantic ``RequestValidationError`` (422 responses).

    Formats Pydantic's validation errors into a flat list of field-level
    error messages for easy display in frontend forms.

    Args:
        request: The incoming request.
        exc: The Pydantic validation error.

    Returns:
        JSONResponse: 422 response with field-level error details.
    """
    request_id = _get_request_id(request)

    # Flatten Pydantic's nested error structure into a simple list.
    field_errors: list[dict[str, str]] = []
    for error in exc.errors():
        loc = error.get("loc", [])
        # Skip the first location component if it is "body".
        field_parts = [str(p) for p in loc if p != "body"]
        field_errors.append(
            {
                "field": ".".join(field_parts) if field_parts else "__root__",
                "message": error.get("msg", "Invalid value."),
                "type": error.get("type", "value_error"),
            }
        )

    logger.info(
        "Validation error on %s %s",
        request.method,
        request.url.path,
        extra={"request_id": request_id, "errors": field_errors},
    )

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "ValidationError",
                "message": "Request validation failed. Check the 'fields' array for details.",
                "fields": field_errors,
                "request_id": request_id,
            },
        },
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Handle Starlette ``HTTPException`` with standard envelope.

    Wraps FastAPI's built-in HTTP exceptions (e.g. 404 from route not found,
    405 from wrong method) in the standard error envelope.

    Args:
        request: The incoming request.
        exc: The Starlette HTTP exception.

    Returns:
        JSONResponse: Standardized error response.
    """
    request_id = _get_request_id(request)

    # Map common status codes to friendly error codes.
    _code_map: dict[int, str] = {
        400: "BadRequest",
        401: "Unauthorized",
        403: "Forbidden",
        404: "NotFound",
        405: "MethodNotAllowed",
        409: "Conflict",
        422: "UnprocessableEntity",
        429: "RateLimitExceeded",
        500: "InternalError",
        503: "ServiceUnavailable",
    }
    error_code = _code_map.get(exc.status_code, "HttpError")
    message = str(exc.detail) if exc.detail else "An error occurred."

    return _error_response(
        status_code=exc.status_code,
        error_code=error_code,
        message=message,
        request_id=request_id,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected exceptions (500 Internal Server Error).

    Logs the full exception with traceback server-side. Returns a generic
    error message to the client — no internal details are exposed.

    Args:
        request: The incoming request.
        exc: The unexpected exception.

    Returns:
        JSONResponse: Generic 500 error response with request_id.
    """
    request_id = _get_request_id(request)

    logger.critical(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
        extra={"request_id": request_id},
    )

    return _error_response(
        status_code=500,
        error_code="InternalError",
        message=(
            f"An unexpected error occurred. "
            f"Reference ID: {request_id}" if request_id else
            "An unexpected error occurred. Please contact support."
        ),
        request_id=request_id,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the FastAPI application.

    Must be called after ``create_application()`` and before the first
    request is served. Registration order matters for subclass matching:
    more specific exceptions must be registered before their base classes.

    Args:
        app: The FastAPI application instance.
    """
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)  # type: ignore[arg-type]
