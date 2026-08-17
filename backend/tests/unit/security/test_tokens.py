"""Unit tests for app.core.security.tokens.

Covers raw token generation, SHA-256 hashing, and constant-time comparison.
"""

import pytest

from app.core.security.tokens import (
    constant_time_compare,
    generate_raw_token,
    hash_token,
)

pytestmark = pytest.mark.unit


class TestGenerateRawToken:
    """Tests for generate_raw_token()."""

    def test_returns_string(self) -> None:
        assert isinstance(generate_raw_token(), str)

    def test_default_token_is_sufficiently_long(self) -> None:
        """Base64url-encoded 32 bytes yields ~43 characters."""
        token = generate_raw_token()
        assert len(token) >= 40

    def test_uniqueness_over_many_calls(self) -> None:
        """100 consecutive calls must produce 100 distinct tokens."""
        tokens = {generate_raw_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_custom_nbytes_increases_length(self) -> None:
        short = generate_raw_token(nbytes=16)
        long_ = generate_raw_token(nbytes=64)
        assert len(short) < len(long_)

    def test_token_contains_no_padding(self) -> None:
        """URL-safe base64 tokens must not contain '=' padding characters."""
        for _ in range(20):
            assert "=" not in generate_raw_token()

    def test_token_is_url_safe(self) -> None:
        """Tokens must only contain URL-safe characters."""
        import re
        url_safe = re.compile(r"^[A-Za-z0-9_-]+$")
        for _ in range(20):
            assert url_safe.match(generate_raw_token())


class TestHashToken:
    """Tests for hash_token()."""

    def test_returns_hex_string(self) -> None:
        h = hash_token("sometoken")
        assert isinstance(h, str)
        assert all(c in "0123456789abcdef" for c in h)

    def test_sha256_output_is_64_chars(self) -> None:
        assert len(hash_token("sometoken")) == 64

    def test_same_input_produces_same_hash(self) -> None:
        assert hash_token("abc") == hash_token("abc")

    def test_different_inputs_produce_different_hashes(self) -> None:
        assert hash_token("abc") != hash_token("xyz")

    def test_empty_string_produces_valid_sha256(self) -> None:
        h = hash_token("")
        assert len(h) == 64
        # SHA-256 of empty string is well-known.
        assert h == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_unicode_input_is_handled(self) -> None:
        h = hash_token("Tést")
        assert len(h) == 64

    def test_hash_is_lowercase(self) -> None:
        h = hash_token("MixedCase")
        assert h == h.lower()


class TestConstantTimeCompare:
    """Tests for constant_time_compare()."""

    def test_equal_strings_return_true(self) -> None:
        assert constant_time_compare("hello", "hello") is True

    def test_different_strings_return_false(self) -> None:
        assert constant_time_compare("hello", "world") is False

    def test_empty_strings_are_equal(self) -> None:
        assert constant_time_compare("", "") is True

    def test_different_lengths_return_false(self) -> None:
        assert constant_time_compare("hello", "hello world") is False

    def test_case_sensitive(self) -> None:
        assert constant_time_compare("Hello", "hello") is False

    def test_unicode_equality(self) -> None:
        assert constant_time_compare("café", "café") is True

    def test_unicode_inequality(self) -> None:
        assert constant_time_compare("café", "cafe") is False
