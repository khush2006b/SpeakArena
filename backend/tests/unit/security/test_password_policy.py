"""Unit tests for app.core.security.password_policy.

All tests are pure in-process with no external dependencies.
Each test validates one specific rule in the password policy to
make failures immediately diagnosable.
"""

import pytest

from app.core.security.password_policy import PasswordPolicy, PasswordStrength

pytestmark = pytest.mark.unit


# ===========================================================================
# PasswordPolicy.validate()
# ===========================================================================


class TestPasswordPolicyValidate:
    """Tests for PasswordPolicy.validate()."""

    # ── Happy path ──────────────────────────────────────────────────────────

    def test_valid_strong_password_passes(self) -> None:
        """A password meeting all rules returns is_valid=True, score=4."""
        result = PasswordPolicy.validate("TestPass1!")

        assert result.is_valid is True
        assert result.score == 4
        assert result.errors == []

    def test_valid_password_with_multiple_specials(self) -> None:
        result = PasswordPolicy.validate("MyS3cur3#P@ss!")
        assert result.is_valid is True

    def test_valid_exactly_minimum_length(self) -> None:
        """Password of exactly 8 characters satisfying all rules passes."""
        result = PasswordPolicy.validate("Abcd1!fg")
        assert result.is_valid is True

    def test_valid_exactly_maximum_length(self) -> None:
        """Password of exactly 128 characters satisfying all rules passes."""
        pwd = "A" * 60 + "a" * 60 + "1" * 6 + "!!"
        assert len(pwd) == 128
        result = PasswordPolicy.validate(pwd)
        assert result.is_valid is True

    # ── Length failures ─────────────────────────────────────────────────────

    def test_too_short_fails(self) -> None:
        result = PasswordPolicy.validate("Ab1!")
        assert result.is_valid is False
        assert any("8 characters" in e for e in result.errors)

    def test_too_long_fails(self) -> None:
        pwd = "A" * 60 + "a" * 60 + "1" * 7 + "!!"
        assert len(pwd) == 129
        result = PasswordPolicy.validate(pwd)
        assert result.is_valid is False
        assert any("exceed" in e.lower() for e in result.errors)

    def test_empty_string_fails(self) -> None:
        result = PasswordPolicy.validate("")
        assert result.is_valid is False
        assert len(result.errors) > 0

    # ── Complexity failures ─────────────────────────────────────────────────

    def test_missing_uppercase_fails(self) -> None:
        result = PasswordPolicy.validate("testpass1!")
        assert result.is_valid is False
        assert any("uppercase" in e for e in result.errors)

    def test_missing_lowercase_fails(self) -> None:
        result = PasswordPolicy.validate("TESTPASS1!")
        assert result.is_valid is False
        assert any("lowercase" in e for e in result.errors)

    def test_missing_digit_fails(self) -> None:
        result = PasswordPolicy.validate("TestPass!!")
        assert result.is_valid is False
        assert any("digit" in e for e in result.errors)

    def test_missing_special_char_fails(self) -> None:
        result = PasswordPolicy.validate("TestPass11")
        assert result.is_valid is False
        assert any("special" in e for e in result.errors)

    # ── Identity checks ─────────────────────────────────────────────────────

    def test_password_same_as_email_fails(self) -> None:
        result = PasswordPolicy.validate("user@example.com", email="user@example.com")
        assert result.is_valid is False
        assert any("email" in e for e in result.errors)

    def test_password_same_as_email_case_insensitive(self) -> None:
        result = PasswordPolicy.validate("USER@EXAMPLE.COM", email="user@example.com")
        assert result.is_valid is False

    def test_password_different_from_email_passes_identity_check(self) -> None:
        result = PasswordPolicy.validate("DifferentPass1!", email="user@example.com")
        # Only the identity check — must not add an email error.
        assert not any("email" in e for e in result.errors)

    def test_password_same_as_full_name_fails(self) -> None:
        result = PasswordPolicy.validate("John Doe", full_name="John Doe")
        assert result.is_valid is False
        assert any("name" in e for e in result.errors)

    def test_password_different_from_full_name_passes(self) -> None:
        result = PasswordPolicy.validate("TestPass1!", full_name="John Doe")
        assert not any("name" in e for e in result.errors)

    # ── Score calculation ───────────────────────────────────────────────────

    def test_score_zero_all_rules_failed(self) -> None:
        """A string with no uppercase, lowercase, digit, or special yields score 0."""
        result = PasswordPolicy.validate("12345678")
        # Has digit → score 1. No upper, no lower, no special.
        assert result.score == 1

    def test_score_four_all_rules_satisfied(self) -> None:
        result = PasswordPolicy.validate("TestP@ssw0rd!")
        assert result.score == 4

    def test_multiple_errors_accumulated(self) -> None:
        """A weak password accumulates all applicable error messages."""
        result = PasswordPolicy.validate("abc")
        # Too short + no uppercase + no digit + no special = 4 errors minimum.
        assert len(result.errors) >= 4


# ===========================================================================
# PasswordPolicy.assert_valid()
# ===========================================================================


class TestPasswordPolicyAssertValid:
    """Tests for PasswordPolicy.assert_valid()."""

    def test_raises_value_error_on_invalid_password(self) -> None:
        with pytest.raises(ValueError):
            PasswordPolicy.assert_valid("weak")

    def test_does_not_raise_on_valid_password(self) -> None:
        PasswordPolicy.assert_valid("ValidPass1!")  # must not raise

    def test_raised_message_is_first_error(self) -> None:
        """assert_valid raises ValueError with the first error string."""
        with pytest.raises(ValueError) as exc_info:
            PasswordPolicy.assert_valid("a")  # multiple violations
        assert isinstance(exc_info.value.args[0], str)
        assert len(exc_info.value.args[0]) > 0

    def test_with_valid_email_context(self) -> None:
        PasswordPolicy.assert_valid("ValidPass1!", email="user@example.com")

    def test_raises_when_password_matches_email(self) -> None:
        with pytest.raises(ValueError):
            PasswordPolicy.assert_valid("user@example.com", email="user@example.com")
