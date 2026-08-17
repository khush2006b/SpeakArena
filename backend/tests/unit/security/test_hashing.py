"""Unit tests for app.core.security.hashing (Argon2id).

Tests verify correctness, security properties, and timing characteristics
of the password hashing module.
"""

import pytest

from app.core.security.hashing import hash_password, needs_rehash, verify_password

pytestmark = pytest.mark.unit


class TestHashPassword:
    """Tests for hash_password()."""

    def test_returns_string(self) -> None:
        assert isinstance(hash_password("TestPass1!"), str)

    def test_result_is_argon2id_format(self) -> None:
        """The hash must begin with the Argon2id PHC identifier."""
        result = hash_password("TestPass1!")
        assert "$argon2id$" in result

    def test_hashes_differ_per_call_due_to_random_salt(self) -> None:
        """Same password must produce different hashes (random salt)."""
        h1 = hash_password("TestPass1!")
        h2 = hash_password("TestPass1!")
        assert h1 != h2

    def test_different_passwords_produce_different_hashes(self) -> None:
        h1 = hash_password("TestPass1!")
        h2 = hash_password("DifferentPass2@")
        assert h1 != h2

    def test_plaintext_not_in_hash(self) -> None:
        password = "TestPass1!"
        assert password not in hash_password(password)

    def test_hash_is_non_empty(self) -> None:
        assert len(hash_password("TestPass1!")) > 0


class TestVerifyPassword:
    """Tests for verify_password()."""

    def test_correct_password_returns_true(self) -> None:
        password = "TestPass1!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password_returns_false(self) -> None:
        hashed = hash_password("TestPass1!")
        assert verify_password("WrongPass2!", hashed) is False

    def test_case_sensitive_verification(self) -> None:
        hashed = hash_password("TestPass1!")
        assert verify_password("testpass1!", hashed) is False

    def test_empty_password_returns_false(self) -> None:
        hashed = hash_password("TestPass1!")
        assert verify_password("", hashed) is False

    def test_whitespace_password_returns_false(self) -> None:
        hashed = hash_password("TestPass1!")
        assert verify_password("   ", hashed) is False

    def test_unicode_password_roundtrip(self) -> None:
        password = "TéstPàss1!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_unicode_returns_false(self) -> None:
        hashed = hash_password("TéstPàss1!")
        assert verify_password("TestPass1!", hashed) is False

    def test_multiple_different_passwords_all_verify_correctly(self) -> None:
        passwords = ["TestPass1!", "AnotherPass2@", "ThirdPass3#", "FourthPass4$"]
        hashes = [hash_password(p) for p in passwords]
        for password, hashed in zip(passwords, hashes):
            assert verify_password(password, hashed) is True

    def test_cross_verification_fails(self) -> None:
        """Verifying password A against hash of password B must return False."""
        h1 = hash_password("TestPass1!")
        h2 = hash_password("OtherPass2@")
        assert verify_password("TestPass1!", h2) is False
        assert verify_password("OtherPass2@", h1) is False


class TestNeedsRehash:
    """Tests for needs_rehash()."""

    def test_fresh_argon2id_hash_does_not_need_rehash(self) -> None:
        hashed = hash_password("TestPass1!")
        assert needs_rehash(hashed) is False

    def test_bcrypt_hash_needs_rehash(self) -> None:
        """A bcrypt hash (legacy algorithm) must signal a rehash is needed."""
        # A well-formed bcrypt hash from the old passlib library.
        bcrypt_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
        assert needs_rehash(bcrypt_hash) is True
