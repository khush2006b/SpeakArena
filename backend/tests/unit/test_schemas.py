"""Unit tests for authentication module Pydantic schemas.

Verifies that:
    - Valid inputs are accepted and normalized correctly.
    - Invalid inputs raise appropriate validation errors.
    - Business-rule validators (model_validator, field_validator) work.
    - No database or external service access occurs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterStudentRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserSchema,
)

pytestmark = pytest.mark.unit


# ===========================================================================
# RegisterStudentRequest
# ===========================================================================


class TestRegisterStudentRequest:
    """Validation tests for RegisterStudentRequest."""

    def test_valid_payload_accepted(self) -> None:
        schema = RegisterStudentRequest(
            email="student@example.com",
            password="TestPass1!",
            full_name="Test Student",
        )
        assert schema.email == "student@example.com"
        assert schema.full_name == "Test Student"

    def test_email_is_normalized_to_lowercase(self) -> None:
        schema = RegisterStudentRequest(
            email="  STUDENT@EXAMPLE.COM  ",
            password="TestPass1!",
            full_name="Test Student",
        )
        assert schema.email == "student@example.com"

    def test_invalid_email_raises(self) -> None:
        with pytest.raises(Exception):
            RegisterStudentRequest(
                email="not-an-email",
                password="TestPass1!",
                full_name="Test Student",
            )

    def test_password_too_short_raises(self) -> None:
        with pytest.raises(Exception):
            RegisterStudentRequest(
                email="a@b.com", password="Ab1!", full_name="Test"
            )

    def test_password_too_long_raises(self) -> None:
        with pytest.raises(Exception):
            RegisterStudentRequest(
                email="a@b.com", password="A" * 130, full_name="Test"
            )

    def test_full_name_stripped_and_validated(self) -> None:
        schema = RegisterStudentRequest(
            email="a@b.com",
            password="TestPass1!",
            full_name="  John Doe  ",
        )
        assert schema.full_name == "John Doe"

    def test_full_name_with_invalid_chars_raises(self) -> None:
        with pytest.raises(Exception):
            RegisterStudentRequest(
                email="a@b.com",
                password="TestPass1!",
                full_name="Test<script>alert(1)</script>",
            )

    def test_valid_e164_phone_accepted(self) -> None:
        schema = RegisterStudentRequest(
            email="a@b.com",
            password="TestPass1!",
            full_name="Test Student",
            phone="+919876543210",
        )
        assert schema.phone == "+919876543210"

    def test_invalid_phone_format_raises(self) -> None:
        with pytest.raises(Exception):
            RegisterStudentRequest(
                email="a@b.com",
                password="TestPass1!",
                full_name="Test Student",
                phone="0987654321",  # Missing + prefix.
            )

    def test_phone_is_optional(self) -> None:
        schema = RegisterStudentRequest(
            email="a@b.com", password="TestPass1!", full_name="Test Student"
        )
        assert schema.phone is None


# ===========================================================================
# LoginRequest
# ===========================================================================


class TestLoginRequest:
    """Validation tests for LoginRequest."""

    def test_valid_payload_accepted(self) -> None:
        schema = LoginRequest(email="user@example.com", password="TestPass1!")
        assert schema.email == "user@example.com"
        assert schema.remember_me is False

    def test_email_normalized_to_lowercase(self) -> None:
        schema = LoginRequest(email="USER@EXAMPLE.COM", password="p")
        assert schema.email == "user@example.com"

    def test_remember_me_defaults_to_false(self) -> None:
        schema = LoginRequest(email="a@b.com", password="p")
        assert schema.remember_me is False

    def test_empty_password_raises(self) -> None:
        with pytest.raises(Exception):
            LoginRequest(email="a@b.com", password="")


# ===========================================================================
# ChangePasswordRequest
# ===========================================================================


class TestChangePasswordRequest:
    """Validation tests for ChangePasswordRequest."""

    def test_valid_payload_accepted(self) -> None:
        schema = ChangePasswordRequest(
            current_password="OldPass1!",
            new_password="NewPass2!",
        )
        assert schema.current_password == "OldPass1!"

    def test_identical_passwords_raise(self) -> None:
        with pytest.raises(Exception) as exc_info:
            ChangePasswordRequest(
                current_password="SamePass1!",
                new_password="SamePass1!",
            )
        assert "different" in str(exc_info.value).lower()

    def test_new_password_too_short_raises(self) -> None:
        with pytest.raises(Exception):
            ChangePasswordRequest(current_password="OldPass1!", new_password="Sh0!")


# ===========================================================================
# UpdateProfileRequest
# ===========================================================================


class TestUpdateProfileRequest:
    """Validation tests for UpdateProfileRequest."""

    def test_full_name_update_accepted(self) -> None:
        schema = UpdateProfileRequest(full_name="New Name")
        assert schema.full_name == "New Name"

    def test_phone_update_accepted(self) -> None:
        schema = UpdateProfileRequest(phone="+919876543210")
        assert schema.phone == "+919876543210"

    def test_full_name_with_invalid_chars_raises(self) -> None:
        with pytest.raises(Exception):
            UpdateProfileRequest(full_name="Test<>Name")

    def test_both_fields_none_is_allowed_by_schema(self) -> None:
        """Schema itself allows empty; the router enforces at least one field."""
        schema = UpdateProfileRequest()
        assert schema.full_name is None
        assert schema.phone is None


# ===========================================================================
# UserSchema.from_orm()
# ===========================================================================


class TestUserSchema:
    """Tests for UserSchema.from_orm()."""

    class _ORM:
        """Minimal ORM object mimic."""
        id = uuid.uuid4()
        email = "user@example.com"
        full_name = "ORM User"
        role = "student"
        phone = None
        is_email_verified = True
        is_active = True
        avatar_r2_key = None
        last_login_at = None
        created_at = datetime.now(timezone.utc)

    def test_from_orm_produces_correct_id_string(self) -> None:
        obj = self._ORM()
        schema = UserSchema.from_orm(obj)
        assert schema.id == str(obj.id)

    def test_from_orm_email_preserved(self) -> None:
        obj = self._ORM()
        schema = UserSchema.from_orm(obj)
        assert schema.email == obj.email

    def test_from_orm_role_preserved(self) -> None:
        obj = self._ORM()
        schema = UserSchema.from_orm(obj)
        assert schema.role == obj.role

    def test_model_dump_is_json_serialisable(self) -> None:
        import json
        obj = self._ORM()
        schema = UserSchema.from_orm(obj)
        # model_dump(mode="json") must produce JSON-serialisable output.
        dumped = schema.model_dump(mode="json")
        json.dumps(dumped)  # Must not raise.
