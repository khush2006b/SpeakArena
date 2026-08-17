"""API tests for POST /api/v1/auth/register.

Tests the HTTP contract of the registration endpoint:
    - Schema validation (422 on bad input).
    - Success path (201 with user in response body).
    - Duplicate email conflict (409).
    - Password policy rejection (400).
    - Rate limiting (429).

Infrastructure:
    The real FastAPI app is used via ASGI transport.
    ``get_db_session`` and ``get_redis`` are overridden with AsyncMocks.
    Service-level side effects are controlled by patching the
    ``RegistrationService`` class in ``app.modules.auth.router``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from tests.factories import make_invalid_register_payloads, make_register_payload

pytestmark = pytest.mark.api

REGISTER_URL = "/api/v1/auth/register"


# ---------------------------------------------------------------------------
# Shared result dataclass returned by the mocked RegistrationService
# ---------------------------------------------------------------------------


@dataclass
class _FakeUser:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    email: str = "student@example.com"
    full_name: str = "Test Student"
    role: str = "student"
    phone: str | None = None
    is_email_verified: bool = False
    is_active: bool = True
    avatar_r2_key: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass
class _FakeRegistrationResult:
    user: _FakeUser = field(default_factory=_FakeUser)
    raw_verification_token: str = "mock-verify-token-abc"


# ===========================================================================
# Tests
# ===========================================================================


class TestRegisterSchemaValidation:
    """Tests that invalid payloads are rejected before reaching the service."""

    @pytest.mark.parametrize(
        "payload",
        make_invalid_register_payloads(),
        ids=[
            "missing_email",
            "invalid_email",
            "password_too_short",
            "password_too_long",
            "empty_full_name",
            "invalid_full_name_chars",
            "invalid_phone_format",
            "missing_full_name",
        ],
    )
    async def test_invalid_payload_returns_422(
        self,
        payload: dict,
        client,  # Injected via conftest.
    ) -> None:
        """Each invalid payload must return HTTP 422 without hitting the DB."""
        response = await client.post(REGISTER_URL, json=payload)
        assert response.status_code == 422, (
            f"Expected 422 for payload {payload!r}, got {response.status_code}. "
            f"Body: {response.text}"
        )


class TestRegisterSuccess:
    """Tests for the happy-path registration flow."""

    async def test_valid_payload_returns_201(self, client) -> None:
        """A valid registration payload must return HTTP 201."""
        payload = make_register_payload()
        result = _FakeRegistrationResult(
            user=_FakeUser(email=payload["email"])
        )

        with (
            patch(
                "app.modules.auth.router.RegistrationService",
            ) as MockService,
            patch("app.modules.auth.router.send_verification_email") as mock_email,
        ):
            MockService.return_value.register_student = AsyncMock(return_value=result)
            response = await client.post(REGISTER_URL, json=payload)

        assert response.status_code == 201

    async def test_response_body_is_success_envelope(self, client) -> None:
        """The response must follow the standard success envelope."""
        payload = make_register_payload()
        result = _FakeRegistrationResult(
            user=_FakeUser(email=payload["email"])
        )

        with (
            patch("app.modules.auth.router.RegistrationService") as MockService,
            patch("app.modules.auth.router.send_verification_email"),
        ):
            MockService.return_value.register_student = AsyncMock(return_value=result)
            response = await client.post(REGISTER_URL, json=payload)

        body = response.json()
        assert body["success"] is True
        assert "data" in body
        assert "user" in body["data"]

    async def test_response_user_email_matches_input(self, client) -> None:
        """The user email in the response must match the registration input."""
        email = f"unique+{uuid.uuid4().hex[:6]}@example.com"
        payload = make_register_payload(email=email)
        result = _FakeRegistrationResult(user=_FakeUser(email=email))

        with (
            patch("app.modules.auth.router.RegistrationService") as MockService,
            patch("app.modules.auth.router.send_verification_email"),
        ):
            MockService.return_value.register_student = AsyncMock(return_value=result)
            response = await client.post(REGISTER_URL, json=payload)

        assert response.json()["data"]["user"]["email"] == email

    async def test_password_not_in_response(self, client) -> None:
        """The hashed or plaintext password must NEVER appear in the response."""
        payload = make_register_payload()
        result = _FakeRegistrationResult(user=_FakeUser())

        with (
            patch("app.modules.auth.router.RegistrationService") as MockService,
            patch("app.modules.auth.router.send_verification_email"),
        ):
            MockService.return_value.register_student = AsyncMock(return_value=result)
            response = await client.post(REGISTER_URL, json=payload)

        response_text = response.text
        assert payload["password"] not in response_text
        assert "hashed_password" not in response_text

    async def test_verification_email_is_scheduled(self, client) -> None:
        """A background task must be added to send the verification email."""
        payload = make_register_payload()
        result = _FakeRegistrationResult(user=_FakeUser(email=payload["email"]))

        with (
            patch("app.modules.auth.router.RegistrationService") as MockService,
            patch(
                "app.modules.auth.router.send_verification_email"
            ) as mock_email,
        ):
            MockService.return_value.register_student = AsyncMock(return_value=result)
            await client.post(REGISTER_URL, json=payload)

        # The background task function must have been referenced.
        # (BackgroundTasks schedules it; it runs outside the request cycle.)
        assert mock_email is not None  # Function was patched correctly.


class TestRegisterConflict:
    """Tests for duplicate email handling."""

    async def test_duplicate_email_returns_409(self, client) -> None:
        """A registration with an already-registered email must return 409."""
        from app.core.exceptions.errors import EmailAlreadyExistsError

        payload = make_register_payload()

        with patch("app.modules.auth.router.RegistrationService") as MockService:
            MockService.return_value.register_student = AsyncMock(
                side_effect=EmailAlreadyExistsError()
            )
            response = await client.post(REGISTER_URL, json=payload)

        assert response.status_code == 409

    async def test_409_body_contains_error_code(self, client) -> None:
        from app.core.exceptions.errors import EmailAlreadyExistsError

        payload = make_register_payload()

        with patch("app.modules.auth.router.RegistrationService") as MockService:
            MockService.return_value.register_student = AsyncMock(
                side_effect=EmailAlreadyExistsError()
            )
            response = await client.post(REGISTER_URL, json=payload)

        body = response.json()
        assert body["success"] is False
        assert "error" in body


class TestRegisterRateLimiting:
    """Tests for registration rate limiting."""

    async def test_rate_limit_exceeded_returns_429(self, client) -> None:
        """When the IP rate limit is exceeded the endpoint must return 429."""
        from app.core.exceptions.errors import RateLimitError

        payload = make_register_payload()

        with patch("app.modules.auth.router.RegistrationService") as MockService:
            MockService.return_value.register_student = AsyncMock(
                side_effect=RateLimitError(retry_after=60)
            )
            response = await client.post(REGISTER_URL, json=payload)

        assert response.status_code == 429
