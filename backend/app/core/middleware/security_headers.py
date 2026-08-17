"""Security headers middleware.

Injects HTTP security headers on every API response. These headers form
the server-side defense layer complementing Nginx's TLS configuration.

Headers injected:
    Strict-Transport-Security: Forces HTTPS for 1 year, including subdomains.
    X-Content-Type-Options   : Prevents MIME-type sniffing attacks.
    X-Frame-Options          : Prevents clickjacking via <iframe> embedding.
    Referrer-Policy          : Limits referrer leakage to same-origin.
    Permissions-Policy       : Restricts access to sensitive browser APIs.
    Cache-Control            : Prevents caching of API responses.

Note:
    Content-Security-Policy for HTML pages is managed by the Next.js
    frontend. The API-only CSP here blocks all content rendering to
    protect against any misconfigured client that treats API responses
    as HTML.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects production security headers on all API responses.

    Attributes:
        app: The inner ASGI application.
        _headers: Pre-computed dict of security headers to inject.
    """

    _SECURITY_HEADERS: dict[str, str] = {
        # Force HTTPS for 1 year (31536000 seconds), include subdomains.
        # The 'preload' directive opts the domain into the HSTS preload list.
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        # Prevent browsers from guessing a different MIME type.
        "X-Content-Type-Options": "nosniff",
        # Block all iframe embedding to prevent clickjacking.
        "X-Frame-Options": "DENY",
        # Only send the origin (no path) as the referrer on cross-origin requests.
        "Referrer-Policy": "strict-origin-when-cross-origin",
        # Deny access to sensitive browser features the API does not need.
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
        # Block all content rendering for API responses.
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none';",
        # Never cache API responses — auth state changes frequently.
        "Cache-Control": "no-store, no-cache, must-revalidate",
    }

    def __init__(self, app: ASGIApp) -> None:
        """Initialize the middleware.

        Args:
            app: The inner ASGI application.
        """
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: object) -> Response:
        """Pass the request through and inject security headers on the response.

        Args:
            request: The incoming Starlette request.
            call_next: The next handler in the middleware chain.

        Returns:
            Response: The response with security headers injected.
        """
        response: Response = await call_next(request)  # type: ignore[arg-type]
        for header_name, header_value in self._SECURITY_HEADERS.items():
            response.headers[header_name] = header_value
        return response
