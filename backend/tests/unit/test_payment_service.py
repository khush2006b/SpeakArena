"""
@pytest.mark.unit

Unit tests for the payment module's WebhookService — specifically the:
    1. HMAC-SHA256 webhook signature verification
    2. Redis idempotency check (atomic SET NX EX)
    3. Payment signature verification
    4. PaymentService.create_order() business rules

All external dependencies (DB, Redis, Razorpay SDK) are mocked.
No real network calls, no test database required.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.payment.service import (
    CourseNotFoundError,
    CourseNotPurchasableError,
    DuplicateEnrollmentError,
    PaymentSignatureError,
    WebhookReplayError,
    WebhookService,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_valid_signature(payload: bytes, secret: str) -> str:
    """Compute a valid HMAC-SHA256 signature for a payload."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _make_payment_signature(order_id: str, payment_id: str, secret: str) -> str:
    """Compute the Razorpay client-side payment signature."""
    message = f"{order_id}|{payment_id}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def webhook_secret() -> str:
    return "test-webhook-secret-key-abc123"


@pytest.fixture
def razorpay_key_secret() -> str:
    return "test-razorpay-key-secret-xyz789"


@pytest.fixture
def webhook_service(mock_db: AsyncMock, mock_redis: AsyncMock) -> WebhookService:
    """Return a WebhookService instance with mocked dependencies."""
    return WebhookService(db=mock_db, redis=mock_redis)


# ---------------------------------------------------------------------------
# 1. Webhook signature verification
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWebhookSignatureVerification:
    """Tests for WebhookService.verify_webhook_signature()."""

    def test_valid_signature_returns_true(
        self, webhook_service: WebhookService, webhook_secret: str
    ) -> None:
        payload = b'{"event": "payment.captured"}'
        sig = _make_valid_signature(payload, webhook_secret)

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = webhook_secret
            result = webhook_service.verify_webhook_signature(payload, sig)

        assert result is True

    def test_tampered_payload_returns_false(
        self, webhook_service: WebhookService, webhook_secret: str
    ) -> None:
        original_payload = b'{"event": "payment.captured"}'
        tampered_payload = b'{"event": "payment.refunded"}'
        sig = _make_valid_signature(original_payload, webhook_secret)

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = webhook_secret
            result = webhook_service.verify_webhook_signature(tampered_payload, sig)

        assert result is False

    def test_wrong_secret_returns_false(
        self, webhook_service: WebhookService
    ) -> None:
        payload = b'{"event": "payment.captured"}'
        sig = _make_valid_signature(payload, "correct-secret")

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = "wrong-secret"
            result = webhook_service.verify_webhook_signature(payload, sig)

        assert result is False

    def test_empty_payload_with_correct_signature(
        self, webhook_service: WebhookService, webhook_secret: str
    ) -> None:
        payload = b""
        sig = _make_valid_signature(payload, webhook_secret)

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = webhook_secret
            result = webhook_service.verify_webhook_signature(payload, sig)

        assert result is True

    def test_empty_signature_returns_false(
        self, webhook_service: WebhookService, webhook_secret: str
    ) -> None:
        payload = b'{"event": "payment.captured"}'

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = webhook_secret
            result = webhook_service.verify_webhook_signature(payload, "")

        assert result is False


# ---------------------------------------------------------------------------
# 2. Webhook idempotency (Redis SET NX EX)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWebhookIdempotency:
    """Tests for WebhookService.check_idempotency() — atomic SET NX EX."""

    @pytest.mark.asyncio
    async def test_first_event_passes_idempotency_check(
        self,
        webhook_service: WebhookService,
        mock_redis: AsyncMock,
    ) -> None:
        """First occurrence of an event_id should NOT raise."""
        event_id = "evt_" + uuid.uuid4().hex
        # Simulate Redis returning True = key was SET (first time)
        mock_redis.set.return_value = True

        # Should not raise
        await webhook_service.assert_not_replayed(event_id)

        mock_redis.set.assert_called_once_with(
            f"webhook:seen:{event_id}",
            "1",
            nx=True,
            ex=86400,
        )

    @pytest.mark.asyncio
    async def test_duplicate_event_raises_webhook_replay_error(
        self,
        webhook_service: WebhookService,
        mock_redis: AsyncMock,
    ) -> None:
        """Second occurrence of same event_id should raise WebhookReplayError."""
        event_id = "evt_duplicate"
        # Simulate Redis returning None = key already exists (SET NX failed)
        mock_redis.set.return_value = None

        with pytest.raises(WebhookReplayError):
            await webhook_service.assert_not_replayed(event_id)

    @pytest.mark.asyncio
    async def test_idempotency_key_uses_correct_prefix(
        self,
        webhook_service: WebhookService,
        mock_redis: AsyncMock,
    ) -> None:
        event_id = "evt_test_prefix"
        mock_redis.set.return_value = True
        await webhook_service.assert_not_replayed(event_id)

        call_args = mock_redis.set.call_args
        key_used = call_args[0][0]  # First positional argument
        assert key_used == "webhook:seen:evt_test_prefix"

    @pytest.mark.asyncio
    async def test_idempotency_ttl_is_24_hours(
        self,
        webhook_service: WebhookService,
        mock_redis: AsyncMock,
    ) -> None:
        event_id = "evt_ttl_check"
        mock_redis.set.return_value = True
        await webhook_service.assert_not_replayed(event_id)

        call_kwargs = mock_redis.set.call_args[1]
        assert call_kwargs["ex"] == 86400  # 24 hours in seconds
        assert call_kwargs["nx"] is True


# ---------------------------------------------------------------------------
# 3. Payment signature verification (client-side)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestPaymentSignatureVerification:
    """Tests for WebhookService.verify_payment_signature()."""

    def test_valid_client_payment_signature(
        self, webhook_service: WebhookService, razorpay_key_secret: str
    ) -> None:
        order_id = "order_" + uuid.uuid4().hex
        payment_id = "pay_" + uuid.uuid4().hex
        sig = _make_payment_signature(order_id, payment_id, razorpay_key_secret)

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_KEY_SECRET = razorpay_key_secret
            result = webhook_service.verify_payment_signature(
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                razorpay_signature=sig,
            )

        assert result is True

    def test_invalid_payment_signature_returns_false(
        self, webhook_service: WebhookService, razorpay_key_secret: str
    ) -> None:
        order_id = "order_abc"
        payment_id = "pay_abc"

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_KEY_SECRET = razorpay_key_secret
            result = webhook_service.verify_payment_signature(
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                razorpay_signature="tampered_signature",
            )

        assert result is False

    def test_signature_uses_pipe_separator(
        self, webhook_service: WebhookService, razorpay_key_secret: str
    ) -> None:
        """Razorpay spec: message = order_id + '|' + payment_id."""
        order_id = "order_xyz"
        payment_id = "pay_xyz"

        # Correct: with pipe
        correct_sig = _make_payment_signature(order_id, payment_id, razorpay_key_secret)
        # Incorrect: with dash (wrong separator)
        wrong_sig = hmac.new(
            razorpay_key_secret.encode(),
            f"{order_id}-{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        with patch("app.modules.payment.service.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_KEY_SECRET = razorpay_key_secret
            assert webhook_service.verify_payment_signature(order_id, payment_id, correct_sig) is True
            assert webhook_service.verify_payment_signature(order_id, payment_id, wrong_sig) is False


# ---------------------------------------------------------------------------
# 4. PaymentService.create_order() business rules
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestCreateOrder:
    """Tests for PaymentService.create_order() business rule enforcement."""

    @pytest.mark.asyncio
    async def test_raises_course_not_found_for_missing_course(
        self,
        mock_db: AsyncMock,
        mock_redis: AsyncMock,
        mock_student_user: MagicMock,
    ) -> None:
        from app.modules.payment.service import PaymentService

        service = PaymentService(
            db=mock_db, redis=mock_redis, student=mock_student_user
        )

        with patch.object(service._course_repo, "get_by_id", return_value=None):
            with pytest.raises(CourseNotFoundError):
                await service.create_order(course_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_course_not_found_for_unpublished_course(
        self,
        mock_db: AsyncMock,
        mock_redis: AsyncMock,
        mock_student_user: MagicMock,
    ) -> None:
        from app.modules.payment.service import PaymentService

        service = PaymentService(
            db=mock_db, redis=mock_redis, student=mock_student_user
        )

        unpublished_course = MagicMock()
        unpublished_course.is_published = False
        unpublished_course.price = 499.0

        with patch.object(
            service._course_repo, "get_by_id", return_value=unpublished_course
        ):
            with pytest.raises(CourseNotFoundError):
                await service.create_order(course_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_not_purchasable_for_free_course(
        self,
        mock_db: AsyncMock,
        mock_redis: AsyncMock,
        mock_student_user: MagicMock,
    ) -> None:
        from app.modules.payment.service import PaymentService

        service = PaymentService(
            db=mock_db, redis=mock_redis, student=mock_student_user
        )

        free_course = MagicMock()
        free_course.is_published = True
        free_course.price = 0.0

        with patch.object(service._course_repo, "get_by_id", return_value=free_course):
            with pytest.raises(CourseNotPurchasableError):
                await service.create_order(course_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_duplicate_enrollment_if_already_enrolled(
        self,
        mock_db: AsyncMock,
        mock_redis: AsyncMock,
        mock_student_user: MagicMock,
    ) -> None:
        from app.modules.payment.service import PaymentService

        service = PaymentService(
            db=mock_db, redis=mock_redis, student=mock_student_user
        )

        paid_course = MagicMock()
        paid_course.is_published = True
        paid_course.price = 499.0

        with patch.object(service._course_repo, "get_by_id", return_value=paid_course):
            with patch.object(
                service._enrollment_repo, "exists", return_value=True
            ):
                with pytest.raises(DuplicateEnrollmentError):
                    await service.create_order(course_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_course_not_found_for_zero_price_float_edge_case(
        self,
        mock_db: AsyncMock,
        mock_redis: AsyncMock,
        mock_student_user: MagicMock,
    ) -> None:
        """Edge case: price = '0.0000' from DB should still be free."""
        from app.modules.payment.service import PaymentService

        service = PaymentService(
            db=mock_db, redis=mock_redis, student=mock_student_user
        )

        free_course = MagicMock()
        free_course.is_published = True
        free_course.price = "0.0000"  # Decimal string from DB

        with patch.object(service._course_repo, "get_by_id", return_value=free_course):
            with pytest.raises(CourseNotPurchasableError):
                await service.create_order(course_id=uuid.uuid4())
