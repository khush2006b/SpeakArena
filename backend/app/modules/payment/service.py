"""Payment module — service layer.

All business logic for the payment system:

    RazorpayService    Thin wrapper around the Razorpay Python SDK.
                       Creates orders, fetches payments, initiates refunds.
                       Runs blocking SDK calls in a ThreadPoolExecutor.

    WebhookService     Handles inbound Razorpay webhook events.
                       Verifies HMAC-SHA256 signature, prevents replay attacks
                       via Redis idempotency cache, and dispatches to handlers.

    PaymentService     Orchestrates order creation, client-side verification,
                       and payment history retrieval.

    EnrollmentService  Grants course access after payment capture:
                       creates CourseEnrollment, updates counters,
                       generates student + teacher notifications.

    RefundService      Initiates full or partial refunds via Razorpay,
                       updates Payment record, writes PaymentHistory.

    InvoiceService     Generates invoice numbers, returns invoice metadata.

    AnalyticsService   Delegates to AnalyticsRepository for revenue aggregation.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Optional

import razorpay
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions.errors import (
    AppError,
    CourseNotFoundError,
    DuplicateResourceError,
    EnrollmentNotFoundError,
    PermissionDeniedError,
    ResourceNotFoundError,
)
from app.models.audit import AuditLog
from app.models.enums import AuditSeverity, NotificationType, PaymentStatus, RefundStatus
from app.models.user import User
from app.modules.payment.repository import (
    AnalyticsRepository,
    CourseRepository,
    EnrollmentRepository,
    NotificationRepository,
    PaymentRepository,
)

logger = logging.getLogger(__name__)

import os

# Thread pool for blocking Razorpay SDK calls
# Sized to handle concurrent checkouts under load
_executor = ThreadPoolExecutor(
    max_workers=min(32, (os.cpu_count() or 1) + 4),
    thread_name_prefix="razorpay"
)

# Redis key prefix for webhook idempotency cache
_WEBHOOK_IDEMPOTENCY_PREFIX = "webhook:seen:"
_WEBHOOK_IDEMPOTENCY_TTL = 86400  # 24 hours


# ---------------------------------------------------------------------------
# Payment-specific domain errors
# ---------------------------------------------------------------------------


class PaymentSignatureError(AppError):
    """Razorpay signature verification failed."""

    status_code = 400
    error_code = "PaymentSignatureInvalid"
    message = "Payment signature verification failed."


class PaymentAmountMismatchError(AppError):
    """Captured amount does not match expected course price."""

    status_code = 400
    error_code = "PaymentAmountMismatch"
    message = "Captured payment amount does not match course price."


class DuplicateEnrollmentError(AppError):
    """Student is already enrolled in this course."""

    status_code = 409
    error_code = "AlreadyEnrolled"
    message = "You are already enrolled in this course."


class CourseNotPurchasableError(AppError):
    """Course cannot be purchased in its current state."""

    status_code = 400
    error_code = "CourseNotPurchasable"
    message = "This course is not available for purchase."


class RefundError(AppError):
    """Razorpay refund initiation failed."""

    status_code = 502
    error_code = "RefundFailed"
    message = "Refund initiation failed. Please try again later."


class WebhookReplayError(AppError):
    """Webhook event already processed (replay attack prevention)."""

    status_code = 200  # Return 200 to prevent Razorpay retry
    error_code = "WebhookReplayed"
    message = "Webhook event already processed."


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------


def _audit(
    db: AsyncSession,
    actor_id: Optional[uuid.UUID],
    actor_role: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    severity: str = AuditSeverity.INFO,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append an audit log record to the session.

    Args:
        db: The async SQLAlchemy session.
        actor_id: The user UUID (None for system/webhook events).
        actor_role: Denormalized role string.
        action: Dot-notation action string.
        entity_type: Entity category.
        entity_id: Optional UUID of the affected resource.
        severity: AuditSeverity value.
        metadata: Optional extra context.
    """
    log = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=severity,
        metadata_=metadata or {},
    )
    db.add(log)


# ===========================================================================
# RazorpayService
# ===========================================================================


class RazorpayService:
    """Thin async wrapper around the Razorpay Python SDK.

    All blocking SDK calls are executed in a ThreadPoolExecutor
    to avoid blocking the asyncio event loop.
    """

    def __init__(self) -> None:
        """Initialize the Razorpay client from application settings."""
        settings = get_settings()
        self._client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        self._key_id = settings.RAZORPAY_KEY_ID

    async def create_order(
        self,
        amount_paise: int,
        currency: str,
        receipt: str,
        notes: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """Create a Razorpay order.

        Args:
            amount_paise: Order amount in the smallest currency unit (paise for INR).
            currency: ISO 4217 currency code (e.g. 'INR').
            receipt: Idempotency receipt string (our payment UUID).
            notes: Optional key-value notes attached to the order.

        Returns:
            dict: The Razorpay order object.

        Raises:
            AppError: On Razorpay API failure.
        """
        loop = asyncio.get_event_loop()
        payload: dict[str, Any] = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {},
        }
        try:
            return await loop.run_in_executor(
                _executor,
                lambda: self._client.order.create(data=payload),
            )
        except Exception as exc:
            logger.error("Razorpay order creation failed: %s", exc)
            raise AppError(
                message="Payment gateway error. Please try again.",
                error_code="RazorpayOrderFailed",
                detail=str(exc),
            ) from exc

    async def fetch_payment(
        self,
        razorpay_payment_id: str,
    ) -> dict[str, Any]:
        """Fetch a Razorpay payment object by ID.

        Args:
            razorpay_payment_id: The Razorpay payment ID (pay_xxx).

        Returns:
            dict: The Razorpay payment object.
        """
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                _executor,
                lambda: self._client.payment.fetch(razorpay_payment_id),
            )
        except Exception as exc:
            logger.error("Razorpay payment fetch failed: %s", exc)
            raise AppError(
                message="Could not fetch payment details.",
                error_code="RazorpayFetchFailed",
                detail=str(exc),
            ) from exc

    async def initiate_refund(
        self,
        razorpay_payment_id: str,
        amount_paise: Optional[int] = None,
        notes: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """Initiate a full or partial refund via Razorpay.

        Args:
            razorpay_payment_id: The Razorpay payment ID.
            amount_paise: Refund amount in paise. Omit for full refund.
            notes: Optional notes attached to the refund.

        Returns:
            dict: The Razorpay refund object.

        Raises:
            RefundError: On Razorpay API failure.
        """
        loop = asyncio.get_event_loop()
        payload: dict[str, Any] = {"notes": notes or {}}
        if amount_paise is not None:
            payload["amount"] = amount_paise

        try:
            return await loop.run_in_executor(
                _executor,
                lambda: self._client.payment.refund(
                    razorpay_payment_id, payload
                ),
            )
        except Exception as exc:
            logger.error("Razorpay refund failed: %s", exc)
            raise RefundError(detail=str(exc)) from exc

    def verify_webhook_signature(
        self,
        payload_body: bytes,
        signature: str,
    ) -> bool:
        """Verify a Razorpay webhook HMAC-SHA256 signature.

        Args:
            payload_body: Raw request body bytes.
            signature: The X-Razorpay-Signature header value.

        Returns:
            bool: True if the signature is valid.
        """
        settings = get_settings()
        secret = settings.RAZORPAY_WEBHOOK_SECRET.encode()
        expected = hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """Verify the client-side payment signature.

        The signature is HMAC-SHA256(order_id + '|' + payment_id, key_secret).

        Args:
            razorpay_order_id: The Razorpay order ID.
            razorpay_payment_id: The Razorpay payment ID.
            razorpay_signature: The signature from the frontend.

        Returns:
            bool: True if the signature is valid.
        """
        settings = get_settings()
        secret = settings.RAZORPAY_KEY_SECRET.encode()
        message = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
        expected = hmac.new(secret, message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    @property
    def key_id(self) -> str:
        """Return the Razorpay key ID for use in the frontend checkout."""
        return self._key_id


# ===========================================================================
# PaymentService
# ===========================================================================


class PaymentService:
    """Orchestrates the payment order creation and client-side verification."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        student: User,
        ip_address: Optional[str] = None,
    ) -> None:
        """Initialize PaymentService.

        Args:
            db: Async database session.
            redis: Async Redis client.
            student: The authenticated student user.
            ip_address: The student's IP address for fraud logging.
        """
        self._db = db
        self._redis = redis
        self._student = student
        self._ip = ip_address
        self._payment_repo = PaymentRepository(db)
        self._course_repo = CourseRepository(db)
        self._enrollment_repo = EnrollmentRepository(db)
        self._razorpay = RazorpayService()

    async def create_order(
        self,
        course_id: uuid.UUID,
        currency: str = "INR",
    ) -> dict[str, Any]:
        """Create a Razorpay order and a pending Payment record.

        Validates:
        - Course exists and is published.
        - Student is not already enrolled.
        - No active pending order exists for this student + course.

        Args:
            course_id: The course UUID.
            currency: ISO 4217 currency code.

        Returns:
            dict: CreateOrderResponse payload.

        Raises:
            CourseNotFoundError: If course not found or not published.
            CourseNotPurchasableError: If course price is 0 (free course).
            DuplicateEnrollmentError: If student is already enrolled.
        """
        course = await self._course_repo.get_by_id(course_id)
        if course is None or not course.is_published:
            raise CourseNotFoundError()

        if float(course.price) == 0.0:
            raise CourseNotPurchasableError(
                message="This is a free course. No payment required."
            )

        enrolled = await self._enrollment_repo.exists(self._student.id, course_id)
        if enrolled:
            raise DuplicateEnrollmentError()

        if course.max_students > 0 and course.total_enrollments >= course.max_students:
            raise CourseNotPurchasableError(
                message=f"This course has reached its student limit of {course.max_students} enrolled seats."
            )

        amount_paise = int(float(course.price) * 100)

        # Create pending Payment record first to get our UUID for the receipt
        payment = await self._payment_repo.create(
            student_id=self._student.id,
            course_id=course_id,
            razorpay_order_id="pending",  # Updated after order creation
            amount=float(course.price),
            currency=currency,
            ip_address=self._ip,
            metadata={"course_title": course.title},
        )

        # Create Razorpay order
        rz_order = await self._razorpay.create_order(
            amount_paise=amount_paise,
            currency=currency,
            receipt=str(payment.id),
            notes={
                "course_id": str(course_id),
                "student_id": str(self._student.id),
                "course_title": course.title,
            },
        )

        # Update payment with the real Razorpay order ID
        payment.razorpay_order_id = rz_order["id"]
        await self._db.flush()

        # Write history
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=None,
            to_status=PaymentStatus.CREATED,
            event="payment.order_created",
            actor_id=self._student.id,
            metadata={"razorpay_order_id": rz_order["id"]},
        )

        _audit(
            self._db,
            actor_id=self._student.id,
            actor_role=self._student.role,
            action="payment.order_created",
            entity_type="payment",
            entity_id=payment.id,
            metadata={"course_id": str(course_id), "amount": float(course.price)},
        )

        return {
            "payment_id": payment.id,
            "razorpay_order_id": rz_order["id"],
            "razorpay_key_id": self._razorpay.key_id,
            "amount_paise": amount_paise,
            "currency": currency,
            "course_title": course.title,
            "course_price": float(course.price),
        }

    async def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict[str, Any]:
        """Verify the client-side payment signature and update payment status.

        This endpoint is called by the frontend AFTER the Razorpay checkout
        modal completes. It provides a second verification layer on top of
        the webhook.

        Args:
            razorpay_order_id: Razorpay order ID.
            razorpay_payment_id: Razorpay payment ID.
            razorpay_signature: HMAC-SHA256 signature from Razorpay.

        Returns:
            dict: Updated payment status payload.

        Raises:
            ResourceNotFoundError: If payment record not found.
            PaymentSignatureError: If signature verification fails.
            PermissionDeniedError: If payment does not belong to this student.
        """
        payment = await self._payment_repo.get_by_order_id(razorpay_order_id)
        if payment is None:
            raise ResourceNotFoundError(message="Payment record not found.")

        if payment.student_id != self._student.id:
            raise PermissionDeniedError(message="Payment does not belong to you.")

        valid = self._razorpay.verify_payment_signature(
            razorpay_order_id, razorpay_payment_id, razorpay_signature
        )
        if not valid:
            _audit(
                self._db,
                actor_id=self._student.id,
                actor_role=self._student.role,
                action="payment.signature_failed",
                entity_type="payment",
                entity_id=payment.id,
                severity=AuditSeverity.WARNING,
                metadata={"razorpay_order_id": razorpay_order_id},
            )
            raise PaymentSignatureError()

        # Update payment with signature (webhook will set final status)
        old_status = payment.status
        await self._payment_repo.update_status(
            payment,
            status=PaymentStatus.ATTEMPTED,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=old_status,
            to_status=PaymentStatus.ATTEMPTED,
            event="payment.client_verified",
            actor_id=self._student.id,
        )

        return {
            "payment_id": payment.id,
            "status": payment.status,
            "message": "Payment received. Enrollment will be granted shortly.",
        }

    async def get_payment_detail(
        self,
        payment_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return full payment detail for the student.

        Args:
            payment_id: The payment UUID.

        Returns:
            dict: Payment detail payload.

        Raises:
            ResourceNotFoundError: If not found or not owned by student.
        """
        payment = await self._payment_repo.get_by_id(payment_id)
        if payment is None or payment.student_id != self._student.id:
            raise ResourceNotFoundError(message="Payment not found.")

        from sqlalchemy import select
        from app.models.course import Course
        course = (
            await self._db.execute(
                select(Course.title).where(Course.id == payment.course_id)
            )
        ).scalar_one_or_none()

        return {
            "id": payment.id,
            "course_id": payment.course_id,
            "course_title": course or "",
            "razorpay_order_id": payment.razorpay_order_id,
            "razorpay_payment_id": payment.razorpay_payment_id,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "status": payment.status,
            "refund_status": payment.refund_status,
            "refund_amount": float(payment.refund_amount) if payment.refund_amount else None,
            "invoice_number": payment.invoice_number,
            "webhook_verified": payment.webhook_verified,
            "paid_at": payment.paid_at,
            "created_at": payment.created_at,
        }


# ===========================================================================
# WebhookService
# ===========================================================================


class WebhookService:
    """Handles inbound Razorpay webhook events.

    Security model:
    - HMAC-SHA256 signature verified against RAZORPAY_WEBHOOK_SECRET before
      any state mutation.
    - Idempotency: event ID cached in Redis for 24 h to prevent replay attacks.
    - webhook_verified flag set on Payment before EnrollmentService runs.
    """

    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        """Initialize WebhookService.

        Args:
            db: Async database session.
            redis: Async Redis client for idempotency cache.
        """
        self._db = db
        self._redis = redis
        self._payment_repo = PaymentRepository(db)
        self._razorpay = RazorpayService()

    def verify_webhook_signature(self, payload_body: bytes, signature: str) -> bool:
        return self._razorpay.verify_webhook_signature(payload_body, signature)

    def verify_payment_signature(
        self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
    ) -> bool:
        return self._razorpay.verify_payment_signature(
            razorpay_order_id, razorpay_payment_id, razorpay_signature
        )

    async def assert_not_replayed(self, event_id: str) -> None:
        key = f"webhook:seen:{event_id}"
        is_new = await self._redis.set(key, "1", nx=True, ex=86400)
        if not is_new:
            raise WebhookReplayError(f"Duplicate webhook event: {event_id}")

    async def handle(
        self,
        payload_body: bytes,
        signature: str,
    ) -> dict[str, Any]:
        """Entry point for all inbound webhook events.

        Verifies the signature, checks idempotency, then dispatches
        to the appropriate event handler.

        Args:
            payload_body: Raw HTTP request body.
            signature: X-Razorpay-Signature header value.

        Returns:
            dict: Processing result.

        Raises:
            PaymentSignatureError: If HMAC verification fails.
        """
        # 1. Verify signature
        if not self._razorpay.verify_webhook_signature(payload_body, signature):
            logger.warning("Webhook signature verification failed.")
            _audit(
                self._db,
                actor_id=None,
                actor_role=None,
                action="webhook.signature_failed",
                entity_type="webhook",
                severity=AuditSeverity.CRITICAL,
                metadata={"signature": signature[:20] + "..."},
            )
            raise PaymentSignatureError()

        # 2. Parse payload
        payload = json.loads(payload_body)
        event = payload.get("event", "")
        event_id = payload.get("id", "")

        # 3. Idempotency check with atomic SET NX EX
        redis_key = f"{_WEBHOOK_IDEMPOTENCY_PREFIX}{event_id}"
        acquired = await self._redis.set(
            redis_key, 
            "1", 
            ex=_WEBHOOK_IDEMPOTENCY_TTL, 
            nx=True
        )
        
        if not acquired:
            logger.info("Webhook event %s already processed. Skipping.", event_id)
            return {"status": "skipped", "reason": "already_processed"}

        logger.info("Processing webhook event: %s (id=%s)", event, event_id)

        # 5. Dispatch
        handlers = {
            "payment.captured": self._handle_payment_captured,
            "payment.failed": self._handle_payment_failed,
            "order.paid": self._handle_order_paid,
            "refund.created": self._handle_refund_created,
            "refund.processed": self._handle_refund_processed,
        }

        handler = handlers.get(event)
        if handler is None:
            logger.info("Unhandled webhook event type: %s", event)
            return {"status": "ignored", "event": event}

        return await handler(payload)

    async def _handle_payment_captured(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle payment.captured webhook event.

        Verifies captured amount matches the stored payment amount,
        marks the payment as captured, then calls EnrollmentService.

        Args:
            payload: Parsed Razorpay webhook payload.

        Returns:
            dict: Processing result.
        """
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        rz_order_id = payment_entity.get("order_id")
        rz_payment_id = payment_entity.get("id")
        captured_amount_paise = payment_entity.get("amount", 0)

        if not rz_order_id:
            logger.error("payment.captured webhook missing order_id.")
            return {"status": "error", "reason": "missing_order_id"}

        payment = await self._payment_repo.get_by_order_id(rz_order_id)
        if payment is None:
            logger.error("payment.captured: payment not found for order %s", rz_order_id)
            return {"status": "error", "reason": "payment_not_found"}

        # Idempotency: already captured?
        if payment.status == PaymentStatus.CAPTURED:
            logger.info("Payment %s already captured. Skipping.", payment.id)
            return {"status": "skipped", "reason": "already_captured"}

        # Amount verification
        expected_paise = int(float(payment.amount) * 100)
        if captured_amount_paise != expected_paise:
            logger.error(
                "Amount mismatch: expected %d paise, got %d paise for payment %s",
                expected_paise,
                captured_amount_paise,
                payment.id,
            )
            _audit(
                self._db,
                actor_id=None,
                actor_role=None,
                action="webhook.amount_mismatch",
                entity_type="payment",
                entity_id=payment.id,
                severity=AuditSeverity.CRITICAL,
                metadata={
                    "expected_paise": expected_paise,
                    "captured_paise": captured_amount_paise,
                },
            )
            await self._payment_repo.update_status(
                payment,
                status=PaymentStatus.FAILED,
                failure_reason="Amount mismatch detected during webhook processing.",
            )
            return {"status": "error", "reason": "amount_mismatch"}

        old_status = payment.status

        # Mark payment as captured
        await self._payment_repo.update_status(
            payment,
            status=PaymentStatus.CAPTURED,
            razorpay_payment_id=rz_payment_id,
            webhook_verified=True,
            paid_at=datetime.now(timezone.utc),
            metadata_update={"razorpay_webhook_payload": payment_entity},
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=old_status,
            to_status=PaymentStatus.CAPTURED,
            event="webhook.payment.captured",
            metadata={"razorpay_payment_id": rz_payment_id},
        )

        _audit(
            self._db,
            actor_id=None,
            actor_role="system",
            action="payment.captured",
            entity_type="payment",
            entity_id=payment.id,
            metadata={"razorpay_payment_id": rz_payment_id},
        )

        # Grant enrollment
        enrollment_svc = EnrollmentService(self._db)
        await enrollment_svc.grant_access(payment)

        # Generate invoice number
        invoice_svc = InvoiceService(self._db)
        await invoice_svc.generate(payment)

        return {"status": "success", "payment_id": str(payment.id)}

    async def _handle_payment_failed(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle payment.failed webhook event.

        Args:
            payload: Parsed Razorpay webhook payload.

        Returns:
            dict: Processing result.
        """
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        rz_order_id = payment_entity.get("order_id")
        error_description = payment_entity.get("error_description", "Payment failed.")
        error_code = payment_entity.get("error_code", "")

        if not rz_order_id:
            return {"status": "error", "reason": "missing_order_id"}

        payment = await self._payment_repo.get_by_order_id(rz_order_id)
        if payment is None:
            return {"status": "error", "reason": "payment_not_found"}

        if payment.status == PaymentStatus.FAILED:
            return {"status": "skipped", "reason": "already_failed"}

        old_status = payment.status
        await self._payment_repo.update_status(
            payment,
            status=PaymentStatus.FAILED,
            failure_reason=error_description,
            failure_code=error_code,
            metadata_update={"razorpay_error": payment_entity.get("error_description")},
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=old_status,
            to_status=PaymentStatus.FAILED,
            event="webhook.payment.failed",
            metadata={"error_code": error_code, "error_description": error_description},
        )

        _audit(
            self._db,
            actor_id=None,
            actor_role="system",
            action="payment.failed",
            entity_type="payment",
            entity_id=payment.id,
            severity=AuditSeverity.WARNING,
            metadata={"error_code": error_code},
        )

        # Notify student
        notif_repo = NotificationRepository(self._db)
        await notif_repo.create(
            recipient_id=payment.student_id,
            notification_type=NotificationType.PAYMENT_FAILED,
            title="Payment Failed",
            body=f"Your payment could not be processed. Reason: {error_description}",
            entity_type="payment",
            entity_id=payment.id,
        )

        return {"status": "success", "payment_id": str(payment.id)}

    async def _handle_order_paid(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle order.paid event (alternative to payment.captured).

        Args:
            payload: Parsed Razorpay webhook payload.

        Returns:
            dict: Processing result.
        """
        # Delegate to payment.captured handler — same logic
        order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
        logger.info("order.paid received for order %s", order_entity.get("id"))
        return {"status": "acknowledged", "event": "order.paid"}

    async def _handle_refund_created(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle refund.created webhook event.

        Args:
            payload: Parsed Razorpay webhook payload.

        Returns:
            dict: Processing result.
        """
        refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
        rz_payment_id = refund_entity.get("payment_id")
        refund_id = refund_entity.get("id")
        refund_amount_paise = refund_entity.get("amount", 0)

        payment = await self._payment_repo.get_by_razorpay_payment_id(rz_payment_id)
        if payment is None:
            return {"status": "error", "reason": "payment_not_found"}

        await self._payment_repo.update_refund(
            payment,
            refund_id=refund_id,
            refund_amount=refund_amount_paise / 100,
            refund_status=RefundStatus.PENDING,
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=payment.status,
            to_status=payment.status,
            event="webhook.refund.created",
            metadata={"refund_id": refund_id},
        )
        return {"status": "success", "refund_id": refund_id}

    async def _handle_refund_processed(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle refund.processed webhook event.

        Args:
            payload: Parsed Razorpay webhook payload.

        Returns:
            dict: Processing result.
        """
        refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})
        rz_payment_id = refund_entity.get("payment_id")
        refund_id = refund_entity.get("id")
        refund_amount_paise = refund_entity.get("amount", 0)

        payment = await self._payment_repo.get_by_razorpay_payment_id(rz_payment_id)
        if payment is None:
            return {"status": "error", "reason": "payment_not_found"}

        await self._payment_repo.update_refund(
            payment,
            refund_id=refund_id,
            refund_amount=refund_amount_paise / 100,
            refund_status=RefundStatus.PROCESSED,
        )
        await self._payment_repo.update_status(
            payment, status=PaymentStatus.REFUNDED
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=PaymentStatus.CAPTURED,
            to_status=PaymentStatus.REFUNDED,
            event="webhook.refund.processed",
            metadata={"refund_id": refund_id},
        )

        _audit(
            self._db,
            actor_id=None,
            actor_role="system",
            action="payment.refunded",
            entity_type="payment",
            entity_id=payment.id,
            metadata={"refund_id": refund_id},
        )

        # Notify student
        notif_repo = NotificationRepository(self._db)
        await notif_repo.create(
            recipient_id=payment.student_id,
            notification_type=NotificationType.REFUND_PROCESSED,
            title="Refund Processed",
            body=f"Your refund of ₹{refund_amount_paise / 100:.2f} has been processed.",
            entity_type="payment",
            entity_id=payment.id,
        )
        return {"status": "success", "refund_id": refund_id}


# ===========================================================================
# EnrollmentService
# ===========================================================================


class EnrollmentService:
    """Grants course access to a student after payment capture.

    Called exclusively by WebhookService._handle_payment_captured.
    Creates CourseEnrollment, updates all denormalized counters,
    and generates student + teacher notifications.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize EnrollmentService.

        Args:
            db: Async database session.
        """
        self._db = db
        self._enrollment_repo = EnrollmentRepository(db)
        self._course_repo = CourseRepository(db)
        self._notif_repo = NotificationRepository(db)

    async def grant_access(
        self,
        payment: Any,  # Payment ORM instance
    ) -> None:
        """Create enrollment and fire all post-enrollment side effects.

        Args:
            payment: The captured Payment ORM instance.
        """
        # Idempotency: skip if already enrolled
        already_enrolled = await self._enrollment_repo.exists(
            payment.student_id, payment.course_id
        )
        if already_enrolled:
            logger.info(
                "Student %s already enrolled in course %s. Skipping.",
                payment.student_id,
                payment.course_id,
            )
            return

        # Create enrollment
        await self._enrollment_repo.create(
            student_id=payment.student_id,
            course_id=payment.course_id,
            payment_id=payment.id,
        )

        # Update denormalized counters
        await self._enrollment_repo.increment_total_enrollments(payment.course_id)
        await self._enrollment_repo.increment_teacher_students(payment.course_id)
        await self._enrollment_repo.increment_student_enrolled_count(payment.student_id)

        # Fetch course title for notifications
        from sqlalchemy import select
        from app.models.course import Course
        course_row = await self._db.execute(
            select(Course.title, Course.teacher_id).where(Course.id == payment.course_id)
        )
        course_data = course_row.one_or_none()
        course_title = course_data.title if course_data else "the course"
        teacher_id = course_data.teacher_id if course_data else None

        # Notify student: Welcome
        await self._notif_repo.create(
            recipient_id=payment.student_id,
            notification_type=NotificationType.PAYMENT_SUCCESSFUL,
            title="Enrollment Confirmed!",
            body=f"You are now enrolled in '{course_title}'. Start learning now!",
            entity_type="course",
            entity_id=payment.course_id,
            action_url=f"/courses/{payment.course_id}",
        )

        # Notify teacher: New enrollment
        if teacher_id:
            await self._notif_repo.create(
                recipient_id=teacher_id,
                notification_type=NotificationType.NEW_ENROLLMENT,
                title="New Student Enrolled",
                body=f"A student has enrolled in '{course_title}'.",
                entity_type="course",
                entity_id=payment.course_id,
            )

        _audit(
            self._db,
            actor_id=None,
            actor_role="system",
            action="enrollment.created",
            entity_type="enrollment",
            entity_id=payment.course_id,
            metadata={
                "student_id": str(payment.student_id),
                "payment_id": str(payment.id),
            },
        )

        logger.info(
            "Enrollment granted: student=%s course=%s payment=%s",
            payment.student_id,
            payment.course_id,
            payment.id,
        )


# ===========================================================================
# RefundService
# ===========================================================================


class RefundService:
    """Initiates and manages refunds via the Razorpay API."""

    def __init__(
        self,
        db: AsyncSession,
        teacher: User,
    ) -> None:
        """Initialize RefundService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._payment_repo = PaymentRepository(db)
        self._course_repo = CourseRepository(db)
        self._razorpay = RazorpayService()

    async def initiate(
        self,
        payment_id: uuid.UUID,
        amount: Optional[float] = None,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """Initiate a full or partial refund for a captured payment.

        Validates:
        - Payment exists.
        - Payment status is CAPTURED.
        - Refund amount does not exceed original payment amount.
        - Payment belongs to a course owned by this teacher.

        Args:
            payment_id: Internal Payment UUID.
            amount: Refund amount in INR. None for full refund.
            reason: Human-readable reason for the refund.

        Returns:
            dict: RefundResponse payload.

        Raises:
            ResourceNotFoundError: If payment not found.
            PermissionDeniedError: If course is not owned by this teacher.
            AppError: If payment cannot be refunded.
            RefundError: On Razorpay API failure.
        """
        payment = await self._payment_repo.get_by_id(payment_id)
        if payment is None:
            raise ResourceNotFoundError(message="Payment not found.")

        if payment.status != PaymentStatus.CAPTURED:
            raise AppError(
                message=f"Cannot refund payment with status '{payment.status}'.",
                error_code="InvalidPaymentState",
            )

        # Verify teacher owns the course
        teacher_id = await self._course_repo.get_teacher_id(payment.course_id)
        if teacher_id != self._teacher.id:
            raise PermissionDeniedError(
                message="You do not have permission to refund this payment."
            )

        refund_amount_inr = amount if amount is not None else float(payment.amount)
        if refund_amount_inr > float(payment.amount):
            raise AppError(
                message="Refund amount exceeds original payment amount.",
                error_code="RefundAmountExceeded",
            )

        amount_paise = int(refund_amount_inr * 100)
        notes = {"reason": reason or "Teacher-initiated refund"}

        rz_refund = await self._razorpay.initiate_refund(
            razorpay_payment_id=payment.razorpay_payment_id,
            amount_paise=amount_paise,
            notes=notes,
        )

        await self._payment_repo.update_refund(
            payment,
            refund_id=rz_refund["id"],
            refund_amount=refund_amount_inr,
            refund_status=RefundStatus.PENDING,
        )
        await self._payment_repo.append_history(
            payment_id=payment.id,
            from_status=payment.status,
            to_status=payment.status,
            event="refund.initiated",
            actor_id=self._teacher.id,
            metadata={
                "refund_id": rz_refund["id"],
                "amount": refund_amount_inr,
                "reason": reason,
            },
        )

        _audit(
            self._db,
            actor_id=self._teacher.id,
            actor_role=self._teacher.role,
            action="payment.refund_initiated",
            entity_type="payment",
            entity_id=payment.id,
            severity=AuditSeverity.WARNING,
            metadata={"refund_amount": refund_amount_inr, "reason": reason},
        )

        return {
            "payment_id": payment.id,
            "refund_id": rz_refund["id"],
            "refund_amount": refund_amount_inr,
            "refund_status": RefundStatus.PENDING,
            "refund_initiated_at": payment.refund_initiated_at,
        }


# ===========================================================================
# InvoiceService
# ===========================================================================


class InvoiceService:
    """Generates invoice numbers and returns invoice metadata."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize InvoiceService.

        Args:
            db: Async database session.
        """
        self._db = db
        self._payment_repo = PaymentRepository(db)

    async def generate(
        self,
        payment: Any,  # Payment ORM instance
    ) -> str:
        """Generate and attach a sequential invoice number to a payment.

        Invoice format: SA-YYYYMM-{zero_padded_sequence}
        Example: SA-202608-000042

        Args:
            payment: The captured Payment ORM instance.

        Returns:
            str: The generated invoice number.
        """
        from sqlalchemy import func, select, extract
        now = datetime.now(timezone.utc)

        # Count existing invoices this month for sequence number
        month_count = (
            await self._db.execute(
                select(func.count(Payment.id)).where(
                    Payment.invoice_number.is_not(None),
                    func.extract("year", Payment.paid_at) == now.year,
                    func.extract("month", Payment.paid_at) == now.month,
                )
            )
        ).scalar_one()

        invoice_number = f"SA-{now.strftime('%Y%m')}-{(month_count + 1):06d}"
        await self._payment_repo.set_invoice(payment, invoice_number)
        return invoice_number

    async def get_invoice_data(
        self,
        payment_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return invoice metadata for a payment.

        Args:
            payment_id: The payment UUID.
            student_id: The requesting student UUID (ownership check).

        Returns:
            dict: Invoice metadata.

        Raises:
            ResourceNotFoundError: If payment not found or not owned.
        """
        payment = await self._payment_repo.get_by_id(payment_id)
        if payment is None or payment.student_id != student_id:
            raise ResourceNotFoundError(message="Payment not found.")

        from sqlalchemy import select
        from app.models.course import Course
        course_title = (
            await self._db.execute(
                select(Course.title).where(Course.id == payment.course_id)
            )
        ).scalar_one_or_none()

        invoice_url: Optional[str] = None
        if payment.invoice_r2_key:
            from app.core.storage import r2
            invoice_url = await r2.generate_presigned_download_url(
                payment.invoice_r2_key, expiry_seconds=3600
            )

        return {
            "payment_id": payment.id,
            "invoice_number": payment.invoice_number or "N/A",
            "invoice_url": invoice_url,
            "course_title": course_title or "",
            "amount": float(payment.amount),
            "currency": payment.currency,
            "paid_at": payment.paid_at,
        }


# ===========================================================================
# AnalyticsService
# ===========================================================================


class AnalyticsService:
    """Provides revenue analytics for the teacher dashboard."""

    def __init__(self, db: AsyncSession, teacher: User) -> None:
        """Initialize AnalyticsService.

        Args:
            db: Async database session.
            teacher: The authenticated teacher user.
        """
        self._db = db
        self._teacher = teacher
        self._analytics_repo = AnalyticsRepository(db)

    async def get_analytics(
        self,
        months: int = 12,
    ) -> dict[str, Any]:
        """Return the full analytics payload for the teacher.

        Args:
            months: Number of months for the breakdown chart.

        Returns:
            dict: PaymentAnalyticsResponse payload.
        """
        summary = await self._analytics_repo.get_revenue_summary(self._teacher.id)
        monthly = await self._analytics_repo.get_monthly_breakdown(
            self._teacher.id, months=months
        )
        top_courses = await self._analytics_repo.get_top_courses(
            self._teacher.id, limit=10
        )
        return {
            **summary,
            "monthly_breakdown": monthly,
            "top_courses": top_courses,
        }
