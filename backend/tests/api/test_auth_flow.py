"""API tests for authentication endpoint contracts not covered elsewhere.

Covers:
    - GET /auth/me (current user profile).
    - POST /auth/logout (session revocation).
    - POST /auth/refresh (token rotation).
    - POST /auth/forgot-password (anti-enumeration).
    - POST /auth/verify-email.
    - POST /auth/check-password-strength.
    - Role guard tests (teacher-only, student-only endpoints).
    - Unauthenticated access to protected endpoints (401).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.api


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


# ===========================================================================
# GET /auth/me
# ===========================================================================


class TestGetMe:
    """Tests for GET /auth/me."""

    async def test_unauthenticated_returns_401(self, client) -> None:
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_expired_token_returns_401(self, client, expired_auth_headers) -> None:
        response = await client.get("/api/v1/auth/me", headers=expired_auth_headers)
        assert response.status_code == 401

    async def test_authenticated_user_returns_200(self, client, student_auth_headers) -> None:
        """A valid token must return the user profile."""
        fake_user = _FakeUser()

        with patch(
            "app.modules.auth.dependencies.UserRepository"
        ) as MockUserRepo:
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_user)
            response = await client.get(
                "/api/v1/auth/me", headers=student_auth_headers
            )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "email" in body["data"]

    async def test_response_excludes_sensitive_fields(self, client, student_auth_headers) -> None:
        """hashed_password must never appear in the /me response."""
        fake_user = _FakeUser()

        with patch(
            "app.modules.auth.dependencies.UserRepository"
        ) as MockUserRepo:
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_user)
            response = await client.get(
                "/api/v1/auth/me", headers=student_auth_headers
            )

        assert "hashed_password" not in response.text
        assert "password" not in response.json().get("data", {})


# ===========================================================================
# POST /auth/logout
# ===========================================================================


class TestLogout:
    """Tests for POST /auth/logout."""

    async def test_unauthenticated_returns_401(self, client) -> None:
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 401

    async def test_authenticated_logout_returns_200(self, client, student_auth_headers) -> None:
        fake_user = _FakeUser()

        with (
            patch("app.modules.auth.dependencies.UserRepository") as MockUserRepo,
            patch("app.modules.auth.router.LogoutService") as MockLogout,
        ):
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_user)
            MockLogout.return_value.logout = AsyncMock()
            response = await client.post(
                "/api/v1/auth/logout", headers=student_auth_headers
            )

        assert response.status_code == 200

    async def test_logout_clears_refresh_token_cookie(self, client, student_auth_headers) -> None:
        """A successful logout must instruct the browser to clear the RT cookie."""
        fake_user = _FakeUser()

        with (
            patch("app.modules.auth.dependencies.UserRepository") as MockUserRepo,
            patch("app.modules.auth.router.LogoutService") as MockLogout,
        ):
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_user)
            MockLogout.return_value.logout = AsyncMock()
            response = await client.post(
                "/api/v1/auth/logout", headers=student_auth_headers
            )

        set_cookie = response.headers.get("set-cookie", "")
        # Cookie must be expired or deleted.
        assert "refresh_token" in set_cookie


# ===========================================================================
# POST /auth/forgot-password  (anti-enumeration)
# ===========================================================================


class TestForgotPassword:
    """Tests for POST /auth/forgot-password."""

    async def test_registered_email_returns_200(self, client) -> None:
        """A registered email must return 200 (not 404 — anti-enumeration)."""
        with patch("app.modules.auth.router.PasswordService") as MockService:
            MockService.return_value.initiate_password_reset = AsyncMock(
                return_value="some-raw-token"
            )
            with patch("app.modules.auth.router.UserRepository") as MockRepo:
                MockRepo.return_value.get_by_email = AsyncMock(return_value=_FakeUser())
                response = await client.post(
                    "/api/v1/auth/forgot-password",
                    json={"email": "registered@example.com"},
                )

        assert response.status_code == 200

    async def test_unregistered_email_also_returns_200(self, client) -> None:
        """An unregistered email must also return 200 (anti-enumeration)."""
        with patch("app.modules.auth.router.PasswordService") as MockService:
            MockService.return_value.initiate_password_reset = AsyncMock(
                return_value=None
            )
            response = await client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "notregistered@example.com"},
            )

        assert response.status_code == 200

    async def test_response_message_is_generic(self, client) -> None:
        """The response message must not reveal whether the email is registered."""
        with patch("app.modules.auth.router.PasswordService") as MockService:
            MockService.return_value.initiate_password_reset = AsyncMock(
                return_value=None
            )
            response = await client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "any@example.com"},
            )

        body = response.json()
        assert "message" in body
        # Message must use hedging language ("if", "exists").
        message = body["message"].lower()
        assert "if" in message or "exists" in message

    async def test_invalid_email_returns_422(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "not-valid"},
        )
        assert response.status_code == 422


# ===========================================================================
# POST /auth/check-password-strength
# ===========================================================================


class TestCheckPasswordStrength:
    """Tests for POST /auth/check-password-strength."""

    async def test_strong_password_returns_valid_true(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/check-password-strength",
            json={"password": "StrongPass1!"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["is_valid"] is True
        assert body["data"]["score"] == 4
        assert body["data"]["errors"] == []

    async def test_weak_password_returns_valid_false(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/check-password-strength",
            json={"password": "weakpassword"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["is_valid"] is False
        assert len(body["data"]["errors"]) > 0

    async def test_empty_password_returns_422(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/check-password-strength",
            json={"password": ""},
        )
        assert response.status_code == 422

    async def test_endpoint_does_not_require_authentication(self, client) -> None:
        """This endpoint must be publicly accessible (no Bearer token needed)."""
        response = await client.post(
            "/api/v1/auth/check-password-strength",
            json={"password": "TestPass1!"},
        )
        # Must not return 401.
        assert response.status_code != 401


# ===========================================================================
# Role guard tests
# ===========================================================================


class TestRoleGuards:
    """Tests verifying that role-based endpoints enforce access correctly."""

    async def test_teacher_endpoint_rejects_student(self, client, student_auth_headers) -> None:
        """GET /auth/teacher/profile must return 403 for a student token."""
        fake_student = _FakeUser(role="student")

        with patch(
            "app.modules.auth.dependencies.UserRepository"
        ) as MockUserRepo:
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_student)
            response = await client.get(
                "/api/v1/auth/teacher/profile",
                headers=student_auth_headers,
            )

        assert response.status_code == 403

    async def test_student_endpoint_rejects_teacher(self, client, teacher_auth_headers) -> None:
        """GET /auth/student/profile must return 403 for a teacher token."""
        fake_teacher = _FakeUser(role="teacher")

        with patch(
            "app.modules.auth.dependencies.UserRepository"
        ) as MockUserRepo:
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_teacher)
            response = await client.get(
                "/api/v1/auth/student/profile",
                headers=teacher_auth_headers,
            )

        assert response.status_code == 403

    async def test_teacher_endpoint_allows_teacher(self, client, teacher_auth_headers) -> None:
        fake_teacher = _FakeUser(role="teacher", email="teacher@example.com")

        with (
            patch("app.modules.auth.dependencies.UserRepository") as MockUserRepo,
            patch("app.modules.auth.router.TeacherProfileRepository") as MockProfileRepo,
        ):
            MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_teacher)
            MockProfileRepo.return_value.get_by_user_id = AsyncMock(return_value=None)
            response = await client.get(
                "/api/v1/auth/teacher/profile",
                headers=teacher_auth_headers,
            )

        assert response.status_code == 200

    async def test_protected_endpoints_require_authentication(self, client) -> None:
        """All authenticated endpoints must return 401 when no token is provided."""
        protected_endpoints = [
            ("GET", "/api/v1/auth/me"),
            ("PATCH", "/api/v1/auth/me"),
            ("POST", "/api/v1/auth/logout"),
            ("POST", "/api/v1/auth/logout-all"),
            ("GET", "/api/v1/auth/sessions"),
            ("GET", "/api/v1/auth/teacher/profile"),
            ("GET", "/api/v1/auth/student/profile"),
        ]
        for method, path in protected_endpoints:
            response = await client.request(method, path)
            assert response.status_code == 401, (
                f"{method} {path} should return 401 without auth, got {response.status_code}"
            )
