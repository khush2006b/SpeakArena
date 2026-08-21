"""Pydantic v2 request and response schemas for the authentication module.

All incoming data is validated and normalized here before reaching the
service layer. No validation logic belongs in routers or services.

Design principles:
    - Request schemas validate and normalize user input aggressively.
    - Response schemas serialize ORM objects via ``from_orm`` class methods.
    - Passwords are NEVER included in any response schema.
    - UUIDs are serialized as lowercase hyphenated strings.
    - Email addresses are normalized to lowercase in all request schemas.
"""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Shared validators
# ---------------------------------------------------------------------------

_FULL_NAME_RE = re.compile(r"^[a-zA-Z\s\-'\.']{2,150}$")
_E164_RE = re.compile(r"^\+[1-9]\d{1,14}$")


# ===========================================================================
# Request Schemas
# ===========================================================================


class RegisterStudentRequest(BaseModel):
    """Request body for POST /auth/register."""

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr = Field(
        ...,
        description="Valid email address. Stored verbatim; lookup is case-insensitive.",
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description=(
            "Minimum 8 characters. Must contain an uppercase letter, a lowercase "
            "letter, a digit, and a special character."
        ),
    )
    full_name: str = Field(
        ...,
        alias="fullName",
        min_length=2,
        max_length=150,
        description="Full display name. Letters, spaces, hyphens, apostrophes, and dots only.",
    )
    phone: str | None = Field(
        None,
        description="Optional phone number in E.164 format. Example: +919876543210",
    )
    role: str | None = Field(
        None,
        description="Optional account role: 'student' or 'teacher'. Defaults to 'student'.",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase and strip surrounding whitespace."""
        return value.lower().strip()

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        """Strip and validate full name character set."""
        cleaned = value.strip()
        if not _FULL_NAME_RE.match(cleaned):
            raise ValueError(
                "Full name may only contain letters, spaces, hyphens, apostrophes, and dots."
            )
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        """Validate E.164 phone number format if provided."""
        if value is None:
            return None
        if not _E164_RE.match(value):
            raise ValueError("Phone must be in E.164 format (e.g. +919876543210).")
        return value


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    email: EmailStr = Field(..., description="Registered email address.")
    password: str = Field(..., min_length=1, max_length=256, description="Account password.")
    remember_me: bool = Field(
        False,
        description="If true, the refresh token expires in 30 days instead of 24 hours.",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase."""
        return value.lower().strip()


class ForgotPasswordRequest(BaseModel):
    """Request body for POST /auth/forgot-password."""

    email: EmailStr = Field(..., description="Email address of the account to recover.")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase."""
        return value.lower().strip()


class ResetPasswordRequest(BaseModel):
    """Request body for POST /auth/reset-password."""

    token: str = Field(..., min_length=1, description="Password reset token from the email link.")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password satisfying the platform password policy.",
    )


class VerifyEmailRequest(BaseModel):
    """Request body for POST /auth/verify-email."""

    token: str = Field(..., min_length=1, description="Email verification token from the link.")


class ResendVerificationRequest(BaseModel):
    """Request body for POST /auth/resend-verification."""

    email: EmailStr = Field(
        ...,
        description="Email of the account awaiting verification.",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normalize email to lowercase."""
        return value.lower().strip()


class ChangePasswordRequest(BaseModel):
    """Request body for POST /auth/me/change-password."""

    current_password: str = Field(..., min_length=1, description="Current account password.")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password satisfying the platform password policy.",
    )

    @model_validator(mode="after")
    def passwords_must_differ(self) -> "ChangePasswordRequest":
        """Ensure the new password is not identical to the current password."""
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self


class UpdateProfileRequest(BaseModel):
    """Request body for PATCH /auth/me."""

    full_name: str | None = Field(
        None,
        min_length=2,
        max_length=150,
        description="New full display name.",
    )
    phone: str | None = Field(None, description="New E.164 phone number, or null to clear.")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        """Strip and validate full name character set if provided."""
        if value is None:
            return None
        cleaned = value.strip()
        if not _FULL_NAME_RE.match(cleaned):
            raise ValueError(
                "Full name may only contain letters, spaces, hyphens, apostrophes, and dots."
            )
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        """Validate E.164 phone number format if provided."""
        if value is None:
            return None
        if not _E164_RE.match(value):
            raise ValueError("Phone must be in E.164 format (e.g. +919876543210).")
        return value


class PasswordStrengthCheckRequest(BaseModel):
    """Request body for POST /auth/check-password-strength."""

    password: str = Field(..., min_length=1, max_length=128, description="Password to evaluate.")


# ===========================================================================
# Response Schemas
# ===========================================================================


class UserSchema(BaseModel):
    """Public-safe user representation included in API responses.

    Internal fields (hashed_password, failed_login_count, locked_until, etc.)
    are intentionally excluded.
    """

    model_config = {"from_attributes": True}

    id: str
    email: str
    full_name: str
    role: str
    phone: str | None
    is_email_verified: bool
    is_active: bool
    avatar_r2_key: str | None = None
    last_login_at: datetime | None
    created_at: datetime

    @classmethod
    def from_orm(cls, user: object) -> "UserSchema":
        """Build a UserSchema from a User ORM object.

        Explicitly converts all UUID fields to strings to ensure JSON
        compatibility regardless of the underlying Python UUID type.

        Args:
            user: A User ORM instance from the database.

        Returns:
            UserSchema: Serializable user representation.
        """
        return cls(
            id=str(getattr(user, "id", "")),
            email=str(getattr(user, "email", "")),
            full_name=str(getattr(user, "full_name", "")),
            role=str(getattr(user, "role", "")),
            phone=getattr(user, "phone", None),
            is_email_verified=bool(getattr(user, "is_email_verified", False)),
            is_active=bool(getattr(user, "is_active", True)),
            avatar_r2_key=getattr(user, "avatar_r2_key", None),
            last_login_at=getattr(user, "last_login_at", None),
            created_at=getattr(user, "created_at"),
        )


class LoginResponse(BaseModel):
    """Response schema for POST /auth/login."""

    access_token: str
    token_type: str = "bearer"
    user: UserSchema


class RegisterResponse(BaseModel):
    """Response schema for POST /auth/register."""

    message: str
    user: UserSchema


class RefreshResponse(BaseModel):
    """Response schema for POST /auth/refresh."""

    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    """Generic success response carrying a human-readable message."""

    message: str


class SessionSchema(BaseModel):
    """Single user session representation for GET /auth/sessions."""

    id: str
    device_type: str | None
    country: str | None
    ip_address: str | None
    last_seen_at: str | None
    created_at: str | None
    is_current: bool


class SessionListResponse(BaseModel):
    """Response schema for GET /auth/sessions."""

    sessions: list[SessionSchema]
    total: int


class TeacherProfileSchema(BaseModel):
    """Response schema for GET /auth/teacher/profile."""

    id: str
    user_id: str
    bio: str | None
    headline: str | None
    website_url: str | None
    social_links: dict | None
    total_students: int
    total_courses: int
    total_revenue: float


class StudentProfileSchema(BaseModel):
    """Response schema for GET /auth/student/profile."""

    id: str
    user_id: str
    college: str | None
    graduation_year: int | None
    preferred_language: str | None
    total_courses_enrolled: int
    total_courses_completed: int


class PasswordStrengthResponse(BaseModel):
    """Response schema for POST /auth/check-password-strength."""

    score: int = Field(..., ge=0, le=4, description="Complexity score from 0 (weakest) to 4 (strongest).")
    is_valid: bool = Field(..., description="True when all policy rules pass.")
    errors: list[str] = Field(
        ...,
        description="List of human-readable policy violation messages. Empty when is_valid is True.",
    )
