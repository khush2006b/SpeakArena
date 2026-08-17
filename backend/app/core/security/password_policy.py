"""Password complexity and strength validation.

Enforces the platform's password policy before hashing:
    - Minimum 8 characters, maximum 128 characters.
    - At least one uppercase letter (A-Z).
    - At least one lowercase letter (a-z).
    - At least one digit (0-9).
    - At least one special character from the allowed set.
    - Must not equal the user's email address (case-insensitive).
    - Must not equal the user's full name (case-insensitive).

Design decisions:
    - ``PasswordStrength`` is a frozen dataclass to prevent mutation.
    - Validation is purely in Python (no DB calls). The service layer
      calls ``PasswordPolicy.validate()`` before touching the database.
    - All error messages are user-facing safe strings.
    - The maximum length (128) is enforced BEFORE calling hash_password
      to prevent Argon2id memory exhaustion via extremely long inputs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PasswordStrength:
    """Result of ``PasswordPolicy.validate()``.

    Attributes:
        is_valid: True when all policy rules pass.
        score: Complexity score from 0 (weakest) to 4 (strongest).
            Increments for each satisfied complexity rule:
            uppercase, lowercase, digit, special character.
        errors: List of human-readable, client-safe error messages.
            Empty when ``is_valid`` is True.
    """

    is_valid: bool
    score: int
    errors: list[str] = field(default_factory=list)


class PasswordPolicy:
    """Stateless password complexity and strength validator.

    All methods are class methods. Instantiation is never needed.
    """

    MIN_LENGTH: int = 8
    MAX_LENGTH: int = 128

    # Allowed special characters for the special-character rule.
    _SPECIAL_CHARS: str = r"!@#$\%^&*()\-_=+\[\]{}|;:,.<>?"
    _SPECIAL_RE: re.Pattern[str] = re.compile(
        rf"[{_SPECIAL_CHARS}]"
    )
    _UPPER_RE: re.Pattern[str] = re.compile(r"[A-Z]")
    _LOWER_RE: re.Pattern[str] = re.compile(r"[a-z]")
    _DIGIT_RE: re.Pattern[str] = re.compile(r"\d")

    @classmethod
    def validate(
        cls,
        password: str,
        *,
        email: str | None = None,
        full_name: str | None = None,
    ) -> PasswordStrength:
        """Validate a password against the platform's complexity policy.

        Args:
            password: The plain-text password to validate.
            email: Optional user email for identity-based checks.
            full_name: Optional user full name for identity-based checks.

        Returns:
            PasswordStrength: Validation result with score and error list.
        """
        errors: list[str] = []
        score: int = 0

        # ── Length checks ────────────────────────────────────────────────────
        if len(password) < cls.MIN_LENGTH:
            errors.append(
                f"Password must be at least {cls.MIN_LENGTH} characters long."
            )
        if len(password) > cls.MAX_LENGTH:
            errors.append(
                f"Password must not exceed {cls.MAX_LENGTH} characters."
            )

        # ── Complexity checks ──────────────────────────────────────────────
        if cls._UPPER_RE.search(password):
            score += 1
        else:
            errors.append(
                "Password must contain at least one uppercase letter (A-Z)."
            )

        if cls._LOWER_RE.search(password):
            score += 1
        else:
            errors.append(
                "Password must contain at least one lowercase letter (a-z)."
            )

        if cls._DIGIT_RE.search(password):
            score += 1
        else:
            errors.append("Password must contain at least one digit (0-9).")

        if cls._SPECIAL_RE.search(password):
            score += 1
        else:
            errors.append(
                "Password must contain at least one special character "
                "(!@#$%^&*()-_=+[]{}|;:,.<>?)."
            )

        # ── Identity checks ────────────────────────────────────────────────
        if email and password.lower() == email.lower():
            errors.append(
                "Password must not be the same as your email address."
            )

        if full_name and password.lower() == full_name.lower():
            errors.append(
                "Password must not be the same as your full name."
            )

        return PasswordStrength(
            is_valid=len(errors) == 0,
            score=score,
            errors=errors,
        )

    @classmethod
    def assert_valid(
        cls,
        password: str,
        *,
        email: str | None = None,
        full_name: str | None = None,
    ) -> None:
        """Validate a password and raise if it fails policy.

        Convenience method for services that want to raise rather than
        check the returned ``PasswordStrength`` object.

        Args:
            password: The plain-text password to validate.
            email: Optional user email for identity-based checks.
            full_name: Optional user full name for identity-based checks.

        Raises:
            ValueError: If the password fails any policy rule. The exception
                message contains the first validation error.
        """
        result = cls.validate(password, email=email, full_name=full_name)
        if not result.is_valid:
            raise ValueError(result.errors[0])
