"""Standard API response builder functions.

All API handlers return responses built by functions in this module
to ensure a consistent JSON envelope across the entire API:

Success::

    {
        "success": true,
        "message": "Optional human-readable message.",
        "data": { ... }   // or list, or null
    }

Paginated::

    {
        "success": true,
        "data": [ ... ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 150,
            "total_pages": 8,
            "has_next": true,
            "has_prev": false
        }
    }

Error (produced by exception handlers, not these functions)::

    {
        "success": false,
        "error": {
            "code": "InvalidCredentials",
            "message": "Invalid email or password.",
            "request_id": "..."
        }
    }
"""

from __future__ import annotations

import math
from typing import Any, TypeVar

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel

T = TypeVar("T")


def success_response(
    data: Any = None,
    *,
    message: str | None = None,
    status_code: int = 200,
) -> JSONResponse:
    """Build a standardized success JSON response.

    Args:
        data: Response payload. Can be a dict, list, Pydantic model, or None.
        message: Optional human-readable message for the client.
        status_code: HTTP status code. Defaults to 200.

    Returns:
        JSONResponse: Standardized success response.
    """
    body: dict[str, Any] = {"success": True}
    if message is not None:
        body["message"] = message
    if data is not None:
        body["data"] = data

    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))


def created_response(
    data: Any = None,
    *,
    message: str | None = None,
) -> JSONResponse:
    """Build a 201 Created response.

    Convenience wrapper around ``success_response`` for resource creation
    endpoints. Always returns HTTP 201.

    Args:
        data: The created resource representation.
        message: Optional human-readable confirmation message.

    Returns:
        JSONResponse: 201 Created standardized response.
    """
    return success_response(data, message=message, status_code=201)


def no_content_response() -> JSONResponse:
    """Build a 204 No Content response.

    Used for DELETE endpoints and actions that don't return a body.

    Returns:
        JSONResponse: 204 No Content response with empty body.
    """
    return JSONResponse(status_code=204, content=None)


def paginated_response(
    items: list[Any],
    *,
    page: int,
    page_size: int,
    total: int,
) -> JSONResponse:
    """Build a standardized paginated success response.

    Args:
        items: The items for the current page. Pydantic models are
            automatically serialized.
        page: The current page number (1-indexed).
        page_size: Number of items per page.
        total: Total number of items across all pages.

    Returns:
        JSONResponse: 200 OK response with pagination metadata.
    """
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    body = {
        "success": True,
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder(body),
    )
