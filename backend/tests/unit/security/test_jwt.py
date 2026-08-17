"""Unit tests for app.core.security.jwt.

Tests cover:
    - Token creation (claims, expiry, JTI generation).
    - Token decoding (roundtrip, validation, error mapping).
    - Remaining-seconds calculation.
    - Security hardening (algorithm pinning, wrong key, wrong audience).

All tests are pure in-process. No database or Redis required.
"""

from __future__ import annotations

import time

import pytest
from jose import jwt

from app.config import settings
from app.core.exceptions.errors import TokenExpiredError, TokenRevokedError
from app.core.security.jwt import (
    AccessTokenPayload,
    create_access_token,
    decode_access_token,
    get_token_remaining_seconds,
)
from app.core.utils.constants import JWT_AUDIENCE, JWT_ISSUER

pytestmark = pytest.mark.unit


# ===========================================================================
# create_access_token()
# ===========================================================================


class TestCreateAccessToken:
    """Tests for create_access_token()."""

    def test_returns_signed_string_and_typed_payload(self) -> None:
        token, payload = create_access_token(
            user_id="user-uuid",
            role="student",
            session_id="session-uuid",
        )
        assert isinstance(token, str)
        assert isinstance(payload, AccessTokenPayload)
        assert len(token.split(".")) == 3  # Three JWT segments.

    def test_sub_claim_matches_user_id(self) -> None:
        user_id = "test-user-123"
        _, payload = create_access_token(
            user_id=user_id, role="student", session_id="s"
        )
        assert payload.sub == user_id

    def test_role_claim_preserved(self) -> None:
        _, p = create_access_token(user_id="u", role="teacher", session_id="s")
        assert p.role == "teacher"

    def test_session_id_claim_preserved(self) -> None:
        session_id = "session-abc-123"
        _, p = create_access_token(user_id="u", role="student", session_id=session_id)
        assert p.session_id == session_id

    def test_iss_and_aud_are_correct(self) -> None:
        _, p = create_access_token(user_id="u", role="student", session_id="s")
        assert p.iss == JWT_ISSUER
        assert p.aud == JWT_AUDIENCE

    def test_expiry_is_in_the_future(self) -> None:
        _, p = create_access_token(user_id="u", role="student", session_id="s")
        assert p.exp > int(time.time())

    def test_iat_is_approximately_now(self) -> None:
        now = int(time.time())
        _, p = create_access_token(user_id="u", role="student", session_id="s")
        assert now - 2 <= p.iat <= now + 2

    def test_custom_jti_is_preserved(self) -> None:
        custom_jti = "my-custom-jti-value"
        _, p = create_access_token(
            user_id="u", role="student", session_id="s", jti=custom_jti
        )
        assert p.jti == custom_jti

    def test_auto_generated_jtis_are_unique(self) -> None:
        """Two tokens for the same user must have different JTIs."""
        _, p1 = create_access_token(user_id="u", role="student", session_id="s")
        _, p2 = create_access_token(user_id="u", role="student", session_id="s")
        assert p1.jti != p2.jti

    def test_custom_expiry_applied(self) -> None:
        expires_in = 300
        _, p = create_access_token(
            user_id="u",
            role="student",
            session_id="s",
            expires_in_seconds=expires_in,
        )
        now = int(time.time())
        assert p.exp >= now + expires_in - 2
        assert p.exp <= now + expires_in + 2

    def test_token_contains_correct_algorithm(self) -> None:
        """The token header must use the configured algorithm."""
        token, _ = create_access_token(user_id="u", role="student", session_id="s")
        header = jwt.get_unverified_header(token)
        assert header["alg"] == settings.JWT_ALGORITHM

    def test_encoded_claims_match_payload(self) -> None:
        """Decoding the raw token must yield claims matching the returned payload."""
        token, payload = create_access_token(
            user_id="check-user", role="teacher", session_id="check-session"
        )
        decoded = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        assert decoded["sub"] == payload.sub
        assert decoded["role"] == payload.role
        assert decoded["session_id"] == payload.session_id
        assert decoded["jti"] == payload.jti


# ===========================================================================
# decode_access_token()
# ===========================================================================


class TestDecodeAccessToken:
    """Tests for decode_access_token()."""

    def test_roundtrip_decode(self) -> None:
        """A freshly created token must decode to the same claims."""
        token, created = create_access_token(
            user_id="round-trip-user",
            role="student",
            session_id="round-trip-session",
        )
        decoded = decode_access_token(token)

        assert decoded.sub == created.sub
        assert decoded.role == created.role
        assert decoded.session_id == created.session_id
        assert decoded.jti == created.jti
        assert decoded.iss == created.iss
        assert decoded.aud == created.aud

    def test_expired_token_raises_token_expired_error(self) -> None:
        """Tokens with exp in the past must raise TokenExpiredError."""
        token, _ = create_access_token(
            user_id="u",
            role="student",
            session_id="s",
            expires_in_seconds=-1,
        )
        with pytest.raises(TokenExpiredError):
            decode_access_token(token)

    def test_wrong_secret_raises_token_revoked_error(self) -> None:
        """A token signed with a different key must be rejected."""
        payload = {
            "sub": "u", "role": "student", "session_id": "s",
            "jti": "j", "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        }
        forged = jwt.encode(payload, "completely-wrong-secret", algorithm="HS256")
        with pytest.raises(TokenRevokedError):
            decode_access_token(forged)

    def test_tampered_signature_raises_token_revoked_error(self) -> None:
        token, _ = create_access_token(user_id="u", role="student", session_id="s")
        # Corrupt the signature segment.
        parts = token.split(".")
        parts[2] = parts[2][:-4] + "XXXX"
        with pytest.raises(TokenRevokedError):
            decode_access_token(".".join(parts))

    def test_wrong_audience_raises_token_revoked_error(self) -> None:
        payload = {
            "sub": "u", "role": "student", "session_id": "s",
            "jti": "j", "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": JWT_ISSUER, "aud": "wrong-audience",
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        with pytest.raises(TokenRevokedError):
            decode_access_token(token)

    def test_wrong_issuer_raises_token_revoked_error(self) -> None:
        payload = {
            "sub": "u", "role": "student", "session_id": "s",
            "jti": "j", "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": "evil-issuer.com", "aud": JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        with pytest.raises(TokenRevokedError):
            decode_access_token(token)

    def test_missing_session_id_claim_raises_token_revoked_error(self) -> None:
        """Tokens missing the session_id claim must be rejected."""
        payload = {
            "sub": "u", "role": "student",  # session_id omitted
            "jti": "j", "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        with pytest.raises(TokenRevokedError):
            decode_access_token(token)

    def test_missing_jti_claim_raises_token_revoked_error(self) -> None:
        payload = {
            "sub": "u", "role": "student", "session_id": "s",
            # jti omitted
            "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        with pytest.raises(TokenRevokedError):
            decode_access_token(token)

    def test_malformed_string_raises_token_revoked_error(self) -> None:
        with pytest.raises(TokenRevokedError):
            decode_access_token("not.a.jwt")

    def test_empty_string_raises_token_revoked_error(self) -> None:
        with pytest.raises(TokenRevokedError):
            decode_access_token("")

    def test_algorithm_none_attack_rejected(self) -> None:
        """The 'none' algorithm attack must be rejected.

        A forged token claiming alg=none must be rejected because
        we explicitly pin the algorithm in decode_access_token.
        """
        header = {"alg": "none", "typ": "JWT"}
        payload = {
            "sub": "admin", "role": "teacher", "session_id": "s",
            "jti": "j", "iat": int(time.time()), "exp": int(time.time()) + 900,
            "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        }
        import base64, json
        def b64url(data: dict) -> str:
            return base64.urlsafe_b64encode(
                json.dumps(data).encode()
            ).rstrip(b"=").decode()
        forged = f"{b64url(header)}.{b64url(payload)}."
        with pytest.raises((TokenRevokedError, TokenExpiredError)):
            decode_access_token(forged)


# ===========================================================================
# get_token_remaining_seconds()
# ===========================================================================


class TestGetTokenRemainingSeconds:
    """Tests for get_token_remaining_seconds()."""

    def test_fresh_token_returns_positive_seconds(self) -> None:
        _, p = create_access_token(
            user_id="u", role="student", session_id="s", expires_in_seconds=900
        )
        remaining = get_token_remaining_seconds(p)
        assert 895 <= remaining <= 900

    def test_expired_token_returns_zero(self) -> None:
        _, p = create_access_token(
            user_id="u", role="student", session_id="s", expires_in_seconds=-1
        )
        remaining = get_token_remaining_seconds(p)
        assert remaining == 0

    def test_does_not_return_negative(self) -> None:
        _, p = create_access_token(
            user_id="u", role="student", session_id="s", expires_in_seconds=-3600
        )
        assert get_token_remaining_seconds(p) >= 0
