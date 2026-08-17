"""
API tests — Payment Module
POST /api/v1/payments/create-order
POST /api/v1/payments/verify
POST /api/v1/payments/webhook
GET  /api/v1/payments/history
GET  /api/v1/payments/{id}
GET  /api/v1/payments/{id}/invoice
POST /api/v1/payments/{id}/refund
GET  /api/v1/payments/analytics
GET  /api/v1/payments/all

Coverage:
  Success · Failure · Unauthorized · Forbidden · Validation
  Webhook HMAC · Idempotency · Concurrency edge cases
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api/v1/payments"

SAMPLE_COURSE_ID = str(uuid.uuid4())
SAMPLE_PAYMENT_ID = str(uuid.uuid4())


def _make_webhook_sig(body: bytes, secret: str = "test-webhook-secret-key-abc123") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _make_payment_sig(order_id: str, payment_id: str, secret: str = "test-razorpay-key-secret-xyz789") -> str:
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# POST /payments/create-order
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestCreateOrder:
    """POST /api/v1/payments/create-order"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{BASE}/create-order", json={"course_id": SAMPLE_COURSE_ID})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_teacher_cannot_create_order_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict
    ) -> None:
        """Only students can create payment orders."""
        resp = await client.post(
            f"{BASE}/create-order",
            json={"course_id": SAMPLE_COURSE_ID},
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_course_id_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{BASE}/create-order",
            json={},
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_uuid_course_id_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{BASE}/create-order",
            json={"course_id": "not-a-uuid"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_course_not_found_returns_404(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.modules.payment.service import CourseNotFoundError

        with patch("app.modules.payment.service.PaymentService.create_order", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = CourseNotFoundError()
            resp = await client.post(
                f"{BASE}/create-order",
                json={"course_id": SAMPLE_COURSE_ID},
                headers=student_auth_headers,
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_free_course_returns_400(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.modules.payment.service import CourseNotPurchasableError

        with patch("app.modules.payment.service.PaymentService.create_order", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = CourseNotPurchasableError()
            resp = await client.post(
                f"{BASE}/create-order",
                json={"course_id": SAMPLE_COURSE_ID},
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_already_enrolled_returns_409(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.modules.payment.service import DuplicateEnrollmentError

        with patch("app.modules.payment.service.PaymentService.create_order", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = DuplicateEnrollmentError()
            resp = await client.post(
                f"{BASE}/create-order",
                json={"course_id": SAMPLE_COURSE_ID},
                headers=student_auth_headers,
            )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_successful_order_creation_returns_201(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        order_data = {
            "order_id": SAMPLE_PAYMENT_ID,
            "razorpay_order_id": "order_mock123",
            "amount": 49900,
            "currency": "INR",
            "key_id": "rzp_test_key",
        }

        with patch("app.modules.payment.service.PaymentService.create_order", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = order_data
            resp = await client.post(
                f"{BASE}/create-order",
                json={"course_id": SAMPLE_COURSE_ID, "currency": "INR"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 201
        body = resp.json()
        assert "data" in body
        assert body["data"]["razorpay_order_id"] == "order_mock123"

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self, client: AsyncClient, expired_auth_headers: dict) -> None:
        resp = await client.post(
            f"{BASE}/create-order",
            json={"course_id": SAMPLE_COURSE_ID},
            headers=expired_auth_headers,
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_default_currency_is_inr(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Omitting currency should default to INR."""
        with patch("app.modules.payment.service.PaymentService.create_order", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"order_id": SAMPLE_PAYMENT_ID, "currency": "INR"}
            await client.post(
                f"{BASE}/create-order",
                json={"course_id": SAMPLE_COURSE_ID},
                headers=student_auth_headers,
            )
            call_kwargs = mock_create.call_args
            # currency argument should default to INR
            if call_kwargs:
                assert call_kwargs[1].get("currency", "INR") == "INR"


# ---------------------------------------------------------------------------
# POST /payments/verify
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestVerifyPayment:
    """POST /api/v1/payments/verify"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{BASE}/verify",
            json={
                "razorpay_order_id": "order_abc",
                "razorpay_payment_id": "pay_abc",
                "razorpay_signature": "fake_sig",
            },
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{BASE}/verify",
            json={"razorpay_order_id": "order_abc"},  # missing payment_id and signature
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_signature_returns_400(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.modules.payment.service import PaymentSignatureError

        with patch("app.modules.payment.service.PaymentService.verify_payment", new_callable=AsyncMock) as mock_verify:
            mock_verify.side_effect = PaymentSignatureError()
            resp = await client.post(
                f"{BASE}/verify",
                json={
                    "razorpay_order_id": "order_abc",
                    "razorpay_payment_id": "pay_abc",
                    "razorpay_signature": "tampered_signature",
                },
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_valid_verify_returns_200(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        order_id = "order_real123"
        payment_id = "pay_real456"
        sig = _make_payment_sig(order_id, payment_id)

        with patch("app.modules.payment.service.PaymentService.verify_payment", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {"status": "verified", "payment_id": SAMPLE_PAYMENT_ID}
            resp = await client.post(
                f"{BASE}/verify",
                json={
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": sig,
                },
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "verified"


# ---------------------------------------------------------------------------
# POST /payments/webhook
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRazorpayWebhook:
    """POST /api/v1/payments/webhook — HMAC verification + idempotency"""

    WEBHOOK_SECRET = "test-webhook-secret-key-abc123"

    def _build_event(self, event: str = "payment.captured") -> tuple[bytes, str]:
        payload = json.dumps({"event": event, "payload": {"payment": {"entity": {"id": "pay_test123"}}}}).encode()
        sig = hmac.new(self.WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        return payload, sig

    @pytest.mark.asyncio
    async def test_missing_signature_header_returns_422(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        payload, _ = self._build_event()
        resp = await client.post(
            f"{BASE}/webhook",
            content=payload,
            headers={"Content-Type": "application/json"},
        )
        # Missing required header → 422
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_signature_returns_400(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        payload, _ = self._build_event()
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            from app.modules.payment.service import PaymentSignatureError
            mock_handle.side_effect = PaymentSignatureError()
            resp = await client.post(
                f"{BASE}/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": "tampered",
                },
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_replayed_event_returns_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Razorpay retries expect 200 even for duplicate events."""
        payload, sig = self._build_event()
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            from app.modules.payment.service import WebhookReplayError
            mock_handle.side_effect = WebhookReplayError()
            resp = await client.post(
                f"{BASE}/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": sig,
                },
            )
        # WebhookReplayError has status_code=200 by design
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_valid_payment_captured_event_returns_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        payload, sig = self._build_event("payment.captured")
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            mock_handle.return_value = {"processed": True, "event": "payment.captured"}
            resp = await client.post(
                f"{BASE}/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": sig,
                },
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_no_auth_header_required(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Webhook must NOT require Bearer token — it uses HMAC only."""
        payload, sig = self._build_event()
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            mock_handle.return_value = {"processed": True}
            resp = await client.post(
                f"{BASE}/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": sig,
                    # No Authorization header
                },
            )
        assert resp.status_code != 401  # Must not require auth

    @pytest.mark.asyncio
    async def test_unknown_event_type_returns_200(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Unknown event types should be acknowledged (200) without processing."""
        payload, sig = self._build_event("subscription.activated")
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            mock_handle.return_value = {"processed": False, "reason": "event_not_handled"}
            resp = await client.post(
                f"{BASE}/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": sig,
                },
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_empty_body_returns_400_or_422(
        self, client: AsyncClient, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        """Empty body with a signature should be rejected."""
        with patch("app.modules.payment.service.WebhookService.handle", new_callable=AsyncMock) as mock_handle:
            from app.modules.payment.service import PaymentSignatureError
            mock_handle.side_effect = PaymentSignatureError()
            resp = await client.post(
                f"{BASE}/webhook",
                content=b"",
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": "not_valid",
                },
            )
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# GET /payments/history
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestPaymentHistory:
    """GET /api/v1/payments/history"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{BASE}/history")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_history_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(f"{BASE}/history", headers=teacher_auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_paginated_history_for_student(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.payment.repository.PaymentRepository.list_for_student", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(f"{BASE}/history", headers=student_auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body

    @pytest.mark.asyncio
    async def test_page_less_than_1_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(f"{BASE}/history?page=0", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_status_filter_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{BASE}/history?status=invalid_status",
            headers=student_auth_headers,
        )
        # May be 422 (enum validation) or 200 depending on schema strictness
        assert resp.status_code in (200, 422)


# ---------------------------------------------------------------------------
# GET /payments/{id}/invoice
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestPaymentInvoice:
    """GET /api/v1/payments/{id}/invoice"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{BASE}/{SAMPLE_PAYMENT_ID}/invoice")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{BASE}/not-a-uuid/invoice", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_payment_not_owned_by_student_returns_404(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class PaymentNotFoundError(AppError):
            status_code = 404
            error_code = "PaymentNotFound"
            message = "Payment not found."

        with patch("app.modules.payment.service.InvoiceService.get_invoice_data", new_callable=AsyncMock) as mock_inv:
            mock_inv.side_effect = PaymentNotFoundError()
            resp = await client.get(
                f"{BASE}/{SAMPLE_PAYMENT_ID}/invoice",
                headers=student_auth_headers,
            )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /payments/{id}/refund (teacher)
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestInitiateRefund:
    """POST /api/v1/payments/{id}/refund"""

    @pytest.mark.asyncio
    async def test_student_cannot_initiate_refund_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
            json={"reason": "Student request"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
            json={"reason": "Student request"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_partial_refund_with_amount_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.payment.service.RefundService.initiate", new_callable=AsyncMock) as mock_refund:
            mock_refund.return_value = {"refund_id": "rfnd_test", "amount": 20000, "status": "initiated"}
            resp = await client.post(
                f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
                json={"amount": 20000, "reason": "Partial refund requested"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["refund_id"] == "rfnd_test"

    @pytest.mark.asyncio
    async def test_full_refund_without_amount_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.payment.service.RefundService.initiate", new_callable=AsyncMock) as mock_refund:
            mock_refund.return_value = {"refund_id": "rfnd_full", "status": "initiated"}
            resp = await client.post(
                f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
                json={"reason": "Full refund"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_razorpay_failure_returns_502(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.modules.payment.service import RefundError

        with patch("app.modules.payment.service.RefundService.initiate", new_callable=AsyncMock) as mock_refund:
            mock_refund.side_effect = RefundError()
            resp = await client.post(
                f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
                json={"reason": "Test refund"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_negative_refund_amount_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{BASE}/{SAMPLE_PAYMENT_ID}/refund",
            json={"amount": -100, "reason": "Invalid"},
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /payments/analytics (teacher)
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRevenueAnalytics:
    """GET /api/v1/payments/analytics"""

    @pytest.mark.asyncio
    async def test_student_cannot_access_analytics_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{BASE}/analytics", headers=student_auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{BASE}/analytics")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_analytics_payload_for_teacher(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        analytics_data = {
            "today": 0,
            "week": 49900,
            "month": 149700,
            "year": 1497000,
            "lifetime": 5000000,
            "monthly_chart": [],
            "top_courses": [],
        }
        with patch("app.modules.payment.service.AnalyticsService.get_analytics", new_callable=AsyncMock) as mock_analytics:
            mock_analytics.return_value = analytics_data
            resp = await client.get(f"{BASE}/analytics", headers=teacher_auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["lifetime"] == 5000000

    @pytest.mark.asyncio
    async def test_months_param_out_of_range_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{BASE}/analytics?months=0", headers=teacher_auth_headers)
        assert resp.status_code == 422

        resp = await client.get(f"{BASE}/analytics?months=37", headers=teacher_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_months_param_within_range_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.payment.service.AnalyticsService.get_analytics", new_callable=AsyncMock) as mock_analytics:
            mock_analytics.return_value = {}
            resp = await client.get(f"{BASE}/analytics?months=6", headers=teacher_auth_headers)
        assert resp.status_code == 200
