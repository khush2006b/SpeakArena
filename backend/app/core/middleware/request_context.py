"""Request context middleware.

Injects a unique ``request_id`` into every request for distributed
tracing and log correlation. Also measures request duration and adds
a timing header to every response.

The ``request_id``:
    - Is taken from the incoming ``X-Request-ID`` header if present
      (allows Nginx to propagate its own request IDs).
    - Is generated as a UUID v4 string if the header is absent.

The ID is stored on ``request.state.request_id`` so all downstream
handlers, dependencies, and services can access it without importing
global state.
"""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Injects request ID and measures response time for every request.

    Added to the FastAPI application before request processing begins.
    Works for both HTTP requests and WebSocket upgrades.

    Attributes:
        app: The inner ASGI application.
    """

    def __init__(self, app: ASGIApp) -> None:
        """Initialize the middleware.

        Args:
            app: The inner ASGI application.
        """
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: object) -> Response:
        """Process the request, injecting context and measuring duration.

        Args:
            request: The incoming Starlette request.
            call_next: The next middleware or route handler in the chain.

        Returns:
            Response: The response from the inner application, with
                ``X-Request-ID`` and ``X-Response-Time`` headers added.
        """
        # Use the upstream-provided ID or generate a new one.
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.monotonic()
        response: Response = await call_next(request)  # type: ignore[arg-type]
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        return response
