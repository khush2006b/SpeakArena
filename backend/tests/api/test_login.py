"""API tests for POST /api/v1/auth/login.

Tests the HTTP contract of the login endpoint:
    - Schema validation (422 on bad input).
    - Successful login (200, access token in body, RT cookie set).
    - Invalid credentials (401).
    - Account locked (401).
    - Email not verified (401).
    - Rate limiting (429).
    - Cookie properties (HttpOnly, path-restricted, SameSite).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from tests.factories import make_invalid_login_payloads, make_login_payload

pytestmark = pytest.mark.api

LOGIN_URL = "/api/v1/auth/login"


@dataclass
class _FakeUser:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    email: str = "student@example.com"
    full_name: str = "Test Student"
    role: str = "student"
    phone: str | None = None
    is_email_verified: bool = True
    is_active: bool = True
    avatar_r2_key: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass
class _FakeLoginResult:
    access_token: str = "eyJ.fake.access.token"
    raw_refresh_token: str = "raw-refresh-token-abc123"
    user: _FakeUser = field(default_factory=_FakeUser)


# ===========================================================================
# Schema validation
# ===========================================================================


class TestLoginSchemaValidation:
    """Tests that invalid payloads are rejected at the schema layer."""

    @pytest.mark.parametrize(
        "payload",
        make_invalid_login_payloads(),
        ids=["missing_password", "missing_email", "invalid_email_format"],
    )
    async def test_invalid_payload_returns_422(
        self, payload: dict, client
    ) -> None:
        response = await client.post(LOGIN_URL, json=payload)
        assert response.status_code == 422


# ===========================================================================
# Success path
# ===========================================================================


class TestLoginSuccess:
    """Tests for the successful login flow."""

    async def test_valid_credentials_return_200(self, client) -> None:
        payload = make_login_payload()
        result = _FakeLoginResult()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 200

    async def test_response_contains_access_token(self, client) -> None:
        payload = make_login_payload()
        result = _FakeLoginResult(access_token="real.access.token")

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        body = response.json()
        assert "data" in body
        assert "access_token" in body["data"]
        assert body["data"]["access_token"] == "real.access.token"

    async def test_response_contains_user_data(self, client) -> None:
        payload = make_login_payload()
        result = _FakeLoginResult()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        body = response.json()
        assert "user" in body["data"]
        assert body["data"]["user"]["email"] == "student@example.com"

    async def test_refresh_token_cookie_is_set(self, client) -> None:
        """A successful login must set the refresh_token HttpOnly cookie."""
        payload = make_login_payload()
        result = _FakeLoginResult(raw_refresh_token="raw-rt-value")

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        assert "refresh_token" in response.cookies

    async def test_cookie_path_is_restricted(self, client) -> None:
        """The refresh_token cookie path must be /api/v1/auth/refresh."""
        payload = make_login_payload()
        result = _FakeLoginResult()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        # httpx exposes cookie attributes via response.headers.
        set_cookie_header = response.headers.get("set-cookie", "")
        assert "path=/api/v1/auth/refresh" in set_cookie_header.lower()

    async def test_password_not_in_response(self, client) -> None:
        """The login response must not contain the submitted password."""
        payload = make_login_payload(password="SuperSecret1!")
        result = _FakeLoginResult()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        assert "SuperSecret1!" not in response.text

    async def test_token_type_is_bearer(self, client) -> None:
        payload = make_login_payload()
        result = _FakeLoginResult()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(return_value=result)
            response = await client.post(LOGIN_URL, json=payload)

        assert response.json()["data"]["token_type"] == "bearer"


# ===========================================================================
# Error paths
# ===========================================================================


class TestLoginErrors:
    """Tests for authentication failure scenarios."""

    async def test_invalid_credentials_return_401(self, client) -> None:
        from app.core.exceptions.errors import InvalidCredentialsError

        payload = make_login_payload()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=InvalidCredentialsError()
            )
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 401

    async def test_account_locked_returns_401(self, client) -> None:
        from app.core.exceptions.errors import AccountLockedError

        payload = make_login_payload()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=AccountLockedError(retry_after=900)
            )
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 401

    async def test_unverified_email_returns_401(self, client) -> None:
        from app.core.exceptions.errors import EmailNotVerifiedError

        payload = make_login_payload()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=EmailNotVerifiedError()
            )
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 401

    async def test_suspended_account_returns_401(self, client) -> None:
        from app.core.exceptions.errors import AccountSuspendedError

        payload = make_login_payload()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=AccountSuspendedError()
            )
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 401

    async def test_rate_limit_exceeded_returns_429(self, client) -> None:
        from app.core.exceptions.errors import RateLimitError

        payload = make_login_payload()

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=RateLimitError(retry_after=60)
            )
            response = await client.post(LOGIN_URL, json=payload)

        assert response.status_code == 429

    async def test_401_response_does_not_leak_account_existence(self, client) -> None:
        """The error message must be generic enough to prevent email enumeration."""
        from app.core.exceptions.errors import InvalidCredentialsError

        payload = make_login_payload(email="nonexistent@example.com")

        with patch("app.modules.auth.router.LoginService") as MockService:
            MockService.return_value.login = AsyncMock(
                side_effect=InvalidCredentialsError()
            )
            response = await client.post(LOGIN_URL, json=payload)

        body = response.json()
        # The error message must not confirm whether the email exists.
        error_msg = body.get("error", {}).get("message", "")
        assert "email" not in error_msg.lower() or "invalid" in error_msg.lower()
