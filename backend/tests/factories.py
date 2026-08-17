"""Test data factory functions.

Provides builder functions for common test payloads.
All factories produce realistic but deterministic data suitable for
both unit and integration tests.

Design:
    - Functions, not class-based factories, for simplicity with async SQLAlchemy.
    - ``make_*_payload`` returns plain dicts for HTTP request bodies.
    - ``make_fake_*`` returns dataclass instances that mirror ORM objects.
    - Unique identifiers (email, UUIDs) are random by default so tests
      can run concurrently without collision.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


# ===========================================================================
# HTTP request payload factories
# ===========================================================================


def make_register_payload(
    *,
    email: str | None = None,
    password: str = "TestPass1!",
    full_name: str = "Test Student",
    phone: str | None = None,
) -> dict[str, object]:
    """Build a valid POST /auth/register request payload.

    Args:
        email: Email address. Defaults to a unique random address.
        password: Password. Defaults to a policy-compliant value.
        full_name: Display name.
        phone: Optional E.164 phone number.

    Returns:
        dict: JSON-serialisable registration payload.
    """
    return {
        "email": email or f"student+{uuid.uuid4().hex[:8]}@example.com",
        "password": password,
        "full_name": full_name,
        "phone": phone,
    }


def make_login_payload(
    *,
    email: str = "student@example.com",
    password: str = "TestPass1!",
    remember_me: bool = False,
) -> dict[str, object]:
    """Build a POST /auth/login request payload.

    Args:
        email: Registered email address.
        password: Account password.
        remember_me: Extended session flag.

    Returns:
        dict: JSON-serialisable login payload.
    """
    return {"email": email, "password": password, "remember_me": remember_me}


def make_forgot_password_payload(email: str = "student@example.com") -> dict[str, str]:
    """Build a POST /auth/forgot-password request payload.

    Args:
        email: Email of the account to recover.

    Returns:
        dict: JSON-serialisable payload.
    """
    return {"email": email}


def make_reset_password_payload(
    token: str = "valid-reset-token",
    new_password: str = "NewValidPass2!",
) -> dict[str, str]:
    """Build a POST /auth/reset-password request payload."""
    return {"token": token, "new_password": new_password}


def make_verify_email_payload(token: str = "valid-verify-token") -> dict[str, str]:
    """Build a POST /auth/verify-email request payload."""
    return {"token": token}


def make_change_password_payload(
    current_password: str = "TestPass1!",
    new_password: str = "NewTestPass2!",
) -> dict[str, str]:
    """Build a POST /auth/me/change-password request payload."""
    return {"current_password": current_password, "new_password": new_password}


def make_update_profile_payload(
    full_name: str | None = "Updated Name",
    phone: str | None = None,
) -> dict[str, object]:
    """Build a PATCH /auth/me request payload."""
    payload: dict[str, object] = {}
    if full_name is not None:
        payload["full_name"] = full_name
    if phone is not None:
        payload["phone"] = phone
    return payload


def make_resend_verification_payload(email: str = "student@example.com") -> dict[str, str]:
    """Build a POST /auth/resend-verification request payload."""
    return {"email": email}


# ===========================================================================
# Invalid payload variants (for negative tests)
# ===========================================================================


def make_invalid_register_payloads() -> list[dict[str, object]]:
    """Return a list of registration payloads that must all fail validation.

    Returns:
        list[dict]: Each dict is a payload expected to return HTTP 422.
    """
    return [
        # Missing email.
        {"password": "TestPass1!", "full_name": "Test"},
        # Invalid email format.
        {"email": "not-an-email", "password": "TestPass1!", "full_name": "Test"},
        # Password too short.
        {"email": "a@b.com", "password": "Abc1!", "full_name": "Test"},
        # Password too long (> 128 chars).
        {"email": "a@b.com", "password": "A" * 130, "full_name": "Test"},
        # Full name empty.
        {"email": "a@b.com", "password": "TestPass1!", "full_name": ""},
        # Full name with invalid characters.
        {"email": "a@b.com", "password": "TestPass1!", "full_name": "Test<script>"},
        # Invalid phone format.
        {"email": "a@b.com", "password": "TestPass1!", "full_name": "Test", "phone": "0987654321"},
        # Missing full_name.
        {"email": "a@b.com", "password": "TestPass1!"},
    ]


def make_invalid_login_payloads() -> list[dict[str, object]]:
    """Return a list of login payloads that must all fail schema validation."""
    return [
        # Missing password.
        {"email": "a@b.com"},
        # Missing email.
        {"password": "TestPass1!"},
        # Invalid email format.
        {"email": "bad", "password": "TestPass1!"},
    ]
