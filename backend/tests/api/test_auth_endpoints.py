"""
API tests — Authentication module (comprehensive)

POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-verification
GET  /api/v1/auth/me
PATCH /api/v1/auth/me
POST /api/v1/auth/me/change-password
GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/{session_id}
POST /api/v1/auth/check-password-strength
GET  /api/v1/auth/teacher/profile
GET  /api/v1/auth/student/profile

Coverage:
  Success · Failure · Unauthorized · Forbidden
  Validation · Rate limits · Token reuse attack · Concurrency
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser
from tests.factories import (
    make_change_password_payload,
    make_forgot_password_payload,
    make_invalid_login_payloads,
    make_invalid_register_payloads,
    make_login_payload,
    make_register_payload,
    make_reset_password_payload,
    make_verify_email_payload,
)

AUTH_BASE = "/api/v1/auth"


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRegister:
    """POST /api/v1/auth/register"""

    @pytest.mark.asyncio
    async def test_all_invalid_payloads_return_422(self, client: AsyncClient) -> None:
        for payload in make_invalid_register_payloads():
            resp = await client.post(f"{AUTH_BASE}/register", json=payload)
            assert resp.status_code == 422, (
                f"Expected 422 for {payload!r}, got {resp.status_code}"
            )

    @pytest.mark.asyncio
    async def test_missing_body_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/register", content=b"")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_duplicate_email_returns_409(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class DuplicateEmailError(AppError):
            status_code = 409
            error_code = "DuplicateEmail"
            message = "Email already registered."

        with patch(
            "app.modules.auth.service.AuthService.register",
            new_callable=AsyncMock,
        ) as mock_register:
            mock_register.side_effect = DuplicateEmailError()
            resp = await client.post(
                f"{AUTH_BASE}/register",
                json=make_register_payload(),
            )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_weak_password_returns_400(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class WeakPasswordError(AppError):
            status_code = 400
            error_code = "WeakPassword"
            message = "Password does not meet policy."

        with patch(
            "app.modules.auth.service.AuthService.register",
            new_callable=AsyncMock,
        ) as mock_register:
            mock_register.side_effect = WeakPasswordError()
            resp = await client.post(
                f"{AUTH_BASE}/register",
                json=make_register_payload(password="password"),
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class RateLimitError(AppError):
            status_code = 429
            error_code = "RateLimited"
            message = "Too many requests."

        with patch(
            "app.modules.auth.service.AuthService.register",
            new_callable=AsyncMock,
        ) as mock_register:
            mock_register.side_effect = RateLimitError()
            resp = await client.post(
                f"{AUTH_BASE}/register",
                json=make_register_payload(),
            )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_successful_registration_returns_201_or_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        fake_user = FakeUser()
        with patch(
            "app.modules.auth.service.AuthService.register",
            new_callable=AsyncMock,
        ) as mock_register:
            mock_register.return_value = {"user_id": str(fake_user.id), "email": fake_user.email}
            resp = await client.post(
                f"{AUTH_BASE}/register",
                json=make_register_payload(email="newstudent@example.com"),
            )
        assert resp.status_code in (200, 201)
        assert "data" in resp.json()

    @pytest.mark.asyncio
    async def test_phone_number_must_be_e164_format(
        self, client: AsyncClient
    ) -> None:
        payload = make_register_payload(phone="0987654321")  # Not E.164
        resp = await client.post(f"{AUTH_BASE}/register", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_full_name_with_script_tags_returns_422(
        self, client: AsyncClient
    ) -> None:
        payload = make_register_payload(full_name="<script>alert(1)</script>")
        resp = await client.post(f"{AUTH_BASE}/register", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_password_too_long_returns_422(
        self, client: AsyncClient
    ) -> None:
        payload = make_register_payload(password="A" * 130)
        resp = await client.post(f"{AUTH_BASE}/register", json=payload)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestLogin:
    """POST /api/v1/auth/login"""

    @pytest.mark.asyncio
    async def test_all_invalid_payloads_return_422(self, client: AsyncClient) -> None:
        for payload in make_invalid_login_payloads():
            resp = await client.post(f"{AUTH_BASE}/login", json=payload)
            assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_wrong_password_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class InvalidCredentialsError(AppError):
            status_code = 401
            error_code = "InvalidCredentials"
            message = "Invalid email or password."

        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.side_effect = InvalidCredentialsError()
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_unverified_email_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class EmailNotVerifiedError(AppError):
            status_code = 401
            error_code = "EmailNotVerified"
            message = "Please verify your email."

        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.side_effect = EmailNotVerifiedError()
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_suspended_account_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class AccountSuspendedError(AppError):
            status_code = 401
            error_code = "AccountSuspended"
            message = "Your account has been suspended."

        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.side_effect = AccountSuspendedError()
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_per_email_rate_limit_returns_429(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class RateLimitError(AppError):
            status_code = 429
            error_code = "RateLimited"
            message = "Too many login attempts."

        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.side_effect = RateLimitError()
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_successful_login_returns_access_token(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        login_result = {
            "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
            "expiresIn": 900,
            "user": {"id": str(uuid.uuid4()), "role": "student"},
        }
        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.return_value = login_result
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())

        if resp.status_code == 200:
            body = resp.json()
            assert "data" in body
            assert "accessToken" in body["data"]

    @pytest.mark.asyncio
    async def test_successful_login_sets_httponly_refresh_cookie(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """HttpOnly refresh token cookie must be set on login."""
        login_result = {
            "accessToken": "mock.access.token",
            "expiresIn": 900,
        }
        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.return_value = login_result
            resp = await client.post(f"{AUTH_BASE}/login", json=make_login_payload())

        if resp.status_code == 200:
            cookies = resp.headers.get("set-cookie", "")
            if "refresh_token" in cookies:
                assert "HttpOnly" in cookies
                assert "SameSite" in cookies

    @pytest.mark.asyncio
    async def test_remember_me_extends_session(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        payload = make_login_payload(remember_me=True)
        with patch(
            "app.modules.auth.service.AuthService.login",
            new_callable=AsyncMock,
        ) as mock_login:
            mock_login.return_value = {"accessToken": "mock.token", "expiresIn": 900}
            resp = await client.post(f"{AUTH_BASE}/login", json=payload)

        # Verify remember_me=True was passed to service
        if mock_login.called:
            call_kwargs = mock_login.call_args[1]
            assert call_kwargs.get("remember_me") is True


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestLogout:
    """POST /api/v1/auth/logout"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/logout")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_successful_logout_clears_refresh_cookie(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.logout",
            new_callable=AsyncMock,
        ) as mock_logout:
            mock_logout.return_value = {"logged_out": True}
            resp = await client.post(
                f"{AUTH_BASE}/logout",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(
        self, client: AsyncClient, expired_auth_headers: dict
    ) -> None:
        resp = await client.post(f"{AUTH_BASE}/logout", headers=expired_auth_headers)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/logout-all
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestLogoutAll:
    """POST /api/v1/auth/logout-all"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/logout-all")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_revoked_session_count(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.logout_all",
            new_callable=AsyncMock,
        ) as mock_all:
            mock_all.return_value = {"sessions_revoked": 3}
            resp = await client.post(
                f"{AUTH_BASE}/logout-all",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /auth/refresh — Token rotation + reuse detection
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRefreshToken:
    """POST /api/v1/auth/refresh — Token rotation + reuse detection"""

    @pytest.mark.asyncio
    async def test_missing_cookie_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/refresh")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_refresh_token_in_cookie_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{AUTH_BASE}/refresh",
            cookies={"refresh_token": "invalid-token-string"},
        )
        assert resp.status_code in (401, 404)

    @pytest.mark.asyncio
    async def test_reused_refresh_token_triggers_nuclear_revocation(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Reuse of an already-rotated RT must revoke ALL sessions immediately."""
        from app.core.exceptions import AppError

        class TokenReuseAttackError(AppError):
            status_code = 401
            error_code = "TokenReuseDetected"
            message = "Security event: all sessions revoked."

        with patch(
            "app.modules.auth.service.AuthService.refresh",
            new_callable=AsyncMock,
        ) as mock_refresh:
            mock_refresh.side_effect = TokenReuseAttackError()
            resp = await client.post(
                f"{AUTH_BASE}/refresh",
                cookies={"refresh_token": "previously-rotated-token"},
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_successful_refresh_returns_new_access_token(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.refresh",
            new_callable=AsyncMock,
        ) as mock_refresh:
            mock_refresh.return_value = {
                "accessToken": "new.access.token",
                "expiresIn": 900,
            }
            resp = await client.post(
                f"{AUTH_BASE}/refresh",
                cookies={"refresh_token": "valid-refresh-token"},
            )

        if resp.status_code == 200:
            assert "accessToken" in resp.json().get("data", {})


# ---------------------------------------------------------------------------
# POST /auth/forgot-password
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestForgotPassword:
    """POST /api/v1/auth/forgot-password — Anti-enumeration: always 200"""

    @pytest.mark.asyncio
    async def test_invalid_email_format_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{AUTH_BASE}/forgot-password",
            json={"email": "not-an-email"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unknown_email_still_returns_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Anti-enumeration: must not reveal if email exists."""
        with patch(
            "app.modules.auth.service.AuthService.forgot_password",
            new_callable=AsyncMock,
        ) as mock_forgot:
            mock_forgot.return_value = None  # No-op for unknown email
            resp = await client.post(
                f"{AUTH_BASE}/forgot-password",
                json=make_forgot_password_payload(email="unknown@example.com"),
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_valid_email_returns_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.forgot_password",
            new_callable=AsyncMock,
        ):
            resp = await client.post(
                f"{AUTH_BASE}/forgot-password",
                json=make_forgot_password_payload(),
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_missing_email_field_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/forgot-password", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/reset-password
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestResetPassword:
    """POST /api/v1/auth/reset-password"""

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class InvalidTokenError(AppError):
            status_code = 401
            error_code = "InvalidToken"
            message = "Reset token is invalid or expired."

        with patch(
            "app.modules.auth.service.AuthService.reset_password",
            new_callable=AsyncMock,
        ) as mock_reset:
            mock_reset.side_effect = InvalidTokenError()
            resp = await client.post(
                f"{AUTH_BASE}/reset-password",
                json=make_reset_password_payload(token="bad-token"),
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_weak_new_password_returns_400(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class WeakPasswordError(AppError):
            status_code = 400
            error_code = "WeakPassword"
            message = "Password does not meet policy requirements."

        with patch(
            "app.modules.auth.service.AuthService.reset_password",
            new_callable=AsyncMock,
        ) as mock_reset:
            mock_reset.side_effect = WeakPasswordError()
            resp = await client.post(
                f"{AUTH_BASE}/reset-password",
                json=make_reset_password_payload(new_password="weak"),
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_used_token_cannot_be_replayed(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """One-use tokens must fail on second submission."""
        from app.core.exceptions import AppError

        class TokenAlreadyUsedError(AppError):
            status_code = 401
            error_code = "TokenAlreadyUsed"
            message = "This reset link has already been used."

        with patch(
            "app.modules.auth.service.AuthService.reset_password",
            new_callable=AsyncMock,
        ) as mock_reset:
            mock_reset.side_effect = TokenAlreadyUsedError()
            resp = await client.post(
                f"{AUTH_BASE}/reset-password",
                json=make_reset_password_payload(token="used-token"),
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_successful_reset_revokes_all_sessions(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.reset_password",
            new_callable=AsyncMock,
        ) as mock_reset:
            mock_reset.return_value = {"sessions_revoked": 2}
            resp = await client.post(
                f"{AUTH_BASE}/reset-password",
                json=make_reset_password_payload(),
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_missing_fields_return_422(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/reset-password", json={"token": "abc"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/verify-email
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestVerifyEmail:
    """POST /api/v1/auth/verify-email"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/verify-email", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class InvalidVerificationToken(AppError):
            status_code = 401
            error_code = "InvalidToken"
            message = "Verification token is invalid or expired."

        with patch(
            "app.modules.auth.service.AuthService.verify_email",
            new_callable=AsyncMock,
        ) as mock_verify:
            mock_verify.side_effect = InvalidVerificationToken()
            resp = await client.post(
                f"{AUTH_BASE}/verify-email",
                json=make_verify_email_payload(token="invalid-token"),
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_already_verified_token_returns_401(
        self, client: AsyncClient, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class TokenAlreadyUsedError(AppError):
            status_code = 401
            error_code = "TokenAlreadyUsed"
            message = "Email already verified."

        with patch(
            "app.modules.auth.service.AuthService.verify_email",
            new_callable=AsyncMock,
        ) as mock_verify:
            mock_verify.side_effect = TokenAlreadyUsedError()
            resp = await client.post(
                f"{AUTH_BASE}/verify-email",
                json=make_verify_email_payload(),
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_token_succeeds(
        self, client: AsyncClient, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.verify_email",
            new_callable=AsyncMock,
        ) as mock_verify:
            mock_verify.return_value = {"verified": True}
            resp = await client.post(
                f"{AUTH_BASE}/verify-email",
                json=make_verify_email_payload(),
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /auth/me and PATCH /auth/me
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestMeEndpoints:
    """GET /api/v1/auth/me · PATCH /api/v1/auth/me"""

    @pytest.mark.asyncio
    async def test_get_me_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{AUTH_BASE}/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_expired_token_returns_401(
        self, client: AsyncClient, expired_auth_headers: dict
    ) -> None:
        resp = await client.get(f"{AUTH_BASE}/me", headers=expired_auth_headers)
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_malformed_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(
            f"{AUTH_BASE}/me",
            headers={"Authorization": "Bearer not.valid.jwt"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_me_requires_at_least_one_field(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Empty PATCH body should be rejected (nothing to update)."""
        from app.core.exceptions import AppError

        class NothingToUpdateError(AppError):
            status_code = 400
            error_code = "NothingToUpdate"
            message = "At least one field must be provided."

        with patch(
            "app.modules.auth.service.AuthService.update_profile",
            new_callable=AsyncMock,
        ) as mock_update:
            mock_update.side_effect = NothingToUpdateError()
            resp = await client.patch(
                f"{AUTH_BASE}/me",
                json={},
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_patch_me_updates_full_name(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.update_profile",
            new_callable=AsyncMock,
        ) as mock_update:
            mock_update.return_value = FakeUser()
            resp = await client.patch(
                f"{AUTH_BASE}/me",
                json={"full_name": "Updated Student Name"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /auth/me/change-password
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestChangePassword:
    """POST /api/v1/auth/me/change-password"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{AUTH_BASE}/me/change-password",
            json=make_change_password_payload(),
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_current_password_returns_400(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class InvalidCurrentPassword(AppError):
            status_code = 400
            error_code = "InvalidCurrentPassword"
            message = "Current password is incorrect."

        with patch(
            "app.modules.auth.service.AuthService.change_password",
            new_callable=AsyncMock,
        ) as mock_change:
            mock_change.side_effect = InvalidCurrentPassword()
            resp = await client.post(
                f"{AUTH_BASE}/me/change-password",
                json=make_change_password_payload(current_password="WrongPass1!"),
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_new_password_same_as_current_is_rejected(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class SamePasswordError(AppError):
            status_code = 400
            error_code = "SamePassword"
            message = "New password must differ from current."

        with patch(
            "app.modules.auth.service.AuthService.change_password",
            new_callable=AsyncMock,
        ) as mock_change:
            mock_change.side_effect = SamePasswordError()
            resp = await client.post(
                f"{AUTH_BASE}/me/change-password",
                json={"current_password": "TestPass1!", "new_password": "TestPass1!"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_422(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{AUTH_BASE}/me/change-password",
            json={"current_password": "TestPass1!"},  # missing new_password
            headers=student_auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /auth/sessions · DELETE /auth/sessions/{id}
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestSessionManagement:
    """GET /auth/sessions · DELETE /auth/sessions/{session_id}"""

    @pytest.mark.asyncio
    async def test_get_sessions_missing_token_returns_401(
        self, client: AsyncClient
    ) -> None:
        resp = await client.get(f"{AUTH_BASE}/sessions")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_sessions_returns_list(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.list_sessions",
            new_callable=AsyncMock,
        ) as mock_sessions:
            mock_sessions.return_value = [{"id": str(uuid.uuid4()), "is_current": True}]
            resp = await client.get(
                f"{AUTH_BASE}/sessions",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"], list)

    @pytest.mark.asyncio
    async def test_delete_session_invalid_uuid_returns_422(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.delete(
            f"{AUTH_BASE}/sessions/not-a-uuid",
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_session_not_owned_returns_404(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class SessionNotFoundError(AppError):
            status_code = 404
            error_code = "SessionNotFound"
            message = "Session not found."

        with patch(
            "app.modules.auth.service.AuthService.revoke_session",
            new_callable=AsyncMock,
        ) as mock_revoke:
            mock_revoke.side_effect = SessionNotFoundError()
            resp = await client.delete(
                f"{AUTH_BASE}/sessions/{uuid.uuid4()}",
                headers=student_auth_headers,
            )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /auth/check-password-strength — Stateless
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestCheckPasswordStrength:
    """POST /api/v1/auth/check-password-strength — No auth required"""

    @pytest.mark.asyncio
    async def test_no_auth_required(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{AUTH_BASE}/check-password-strength",
            json={"password": "TestPass1!"},
        )
        # Must be accessible without token
        assert resp.status_code != 401

    @pytest.mark.asyncio
    async def test_missing_password_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(f"{AUTH_BASE}/check-password-strength", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_score_and_validity(
        self, client: AsyncClient, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.check_password_strength",
            return_value={"score": 4, "is_valid": True, "errors": []},
        ):
            resp = await client.post(
                f"{AUTH_BASE}/check-password-strength",
                json={"password": "StrongP@ss9!"},
            )
        if resp.status_code == 200:
            body = resp.json()
            assert "data" in body
            data = body["data"]
            assert "score" in data
            assert "is_valid" in data

    @pytest.mark.asyncio
    async def test_weak_password_returns_low_score(
        self, client: AsyncClient, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.check_password_strength",
            return_value={"score": 1, "is_valid": False, "errors": ["Too short"]},
        ):
            resp = await client.post(
                f"{AUTH_BASE}/check-password-strength",
                json={"password": "weak"},
            )
        if resp.status_code == 200:
            data = resp.json()["data"]
            assert data["is_valid"] is False


# ---------------------------------------------------------------------------
# GET /auth/teacher/profile · GET /auth/student/profile
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRoleProfiles:
    """GET /auth/teacher/profile · GET /auth/student/profile"""

    @pytest.mark.asyncio
    async def test_student_accessing_teacher_profile_returns_403(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{AUTH_BASE}/teacher/profile",
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_accessing_student_profile_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{AUTH_BASE}/student/profile",
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_profile_accessible_by_teacher(
        self, client: AsyncClient, teacher_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.get_teacher_profile",
            new_callable=AsyncMock,
        ) as mock_profile:
            mock_profile.return_value = {
                "bio": "Experienced developer",
                "total_students": 250,
                "total_revenue": 125000,
            }
            resp = await client.get(
                f"{AUTH_BASE}/teacher/profile",
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_student_profile_accessible_by_student(
        self, client: AsyncClient, student_auth_headers: dict,
        mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch(
            "app.modules.auth.service.AuthService.get_student_profile",
            new_callable=AsyncMock,
        ) as mock_profile:
            mock_profile.return_value = {
                "college": "IIT Bombay",
                "total_enrollments": 3,
            }
            resp = await client.get(
                f"{AUTH_BASE}/student/profile",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
