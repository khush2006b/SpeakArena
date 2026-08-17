"""Payment module — router.

Mounts at /api/v1/payments.

Endpoints:
    POST /payments/create-order     Create Razorpay order (student).
    POST /payments/verify           Client-side verification (student).
    POST /payments/webhook          Razorpay inbound webhook (no auth).
    GET  /payments/history          Student payment history.
    GET  /payments/{id}             Payment detail (student).
    GET  /payments/{id}/invoice     Invoice metadata (student).
    POST /payments/{id}/refund      Initiate refund (teacher).
    GET  /payments/analytics        Revenue analytics (teacher).
    GET  /payments/all              All payments across courses (teacher).

Security:
    Webhook endpoint is unauthenticated but HMAC-verified.
    create-order, verify, history, detail, invoice: student only.
    refund, analytics, all: teacher only.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis.client import get_redis
from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import (
    get_client_ip,
    get_current_student,
    get_current_teacher,
)
from app.modules.payment.schemas import (
    CreateOrderRequest,
    CreateRefundRequest,
    PaymentHistoryParams,
    TeacherPaymentParams,
    VerifyPaymentRequest,
)
from app.modules.payment.service import (
    AnalyticsService,
    InvoiceService,
    PaymentService,
    PaymentSignatureError,
    RefundService,
    WebhookService,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ===========================================================================
# Student Endpoints
# ===========================================================================


@router.post(
    "/create-order",
    summary="Create Razorpay payment order",
    description=(
        "Creates a Razorpay order for a course purchase. "
        "Returns the order ID, Razorpay key, and amount for the frontend checkout modal. "
        "The student must not already be enrolled in the course."
    ),
    status_code=201,
)
async def create_order(
    body: CreateOrderRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    ip_address: Optional[str] = Depends(get_client_ip),
) -> JSONResponse:
    """Create a Razorpay order for course checkout."""
    svc = PaymentService(db, redis, student, ip_address=ip_address)
    data = await svc.create_order(body.course_id, body.currency)
    await db.commit()
    return success_response(data, status_code=201)


@router.post(
    "/verify",
    summary="Verify client-side payment",
    description=(
        "Called by the frontend after the Razorpay checkout modal closes successfully. "
        "Verifies the payment signature on the server side. "
        "Final enrollment is granted by the webhook handler."
    ),
)
async def verify_payment(
    body: VerifyPaymentRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Verify client-side payment signature."""
    svc = PaymentService(db, redis, student)
    data = await svc.verify_payment(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature,
    )
    await db.commit()
    return success_response(data)


@router.get(
    "/history",
    summary="Student payment history",
    description="Returns the student's paginated payment history.",
)
async def get_student_payment_history(
    params: PaymentHistoryParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return student's payment history."""
    from app.modules.payment.repository import PaymentRepository

    repo = PaymentRepository(db)
    payments, total = await repo.list_for_student(
        student.id,
        page=params.page,
        page_size=params.page_size,
        status=params.status,
        course_id=params.course_id,
    )
    return paginated_response(
        payments, page=params.page, page_size=params.page_size, total=total
    )


@router.get(
    "/{payment_id}",
    summary="Payment detail",
    description="Returns full payment detail for the authenticated student.",
)
async def get_payment_detail(
    payment_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> JSONResponse:
    """Return payment detail for a student."""
    svc = PaymentService(db, redis, student)
    data = await svc.get_payment_detail(payment_id)
    return success_response(data)


@router.get(
    "/{payment_id}/invoice",
    summary="Payment invoice",
    description=(
        "Returns invoice metadata and a presigned R2 URL to the PDF invoice if available. "
        "Only the student who made the payment can access their invoice."
    ),
)
async def get_invoice(
    payment_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return invoice metadata for a student."""
    svc = InvoiceService(db)
    data = await svc.get_invoice_data(payment_id, student.id)
    return success_response(data)


# ===========================================================================
# Webhook Endpoint (unauthenticated, HMAC-verified)
# ===========================================================================


@router.post(
    "/webhook",
    summary="Razorpay webhook receiver",
    description=(
        "Receives inbound webhook events from Razorpay. "
        "HMAC-SHA256 signature is verified before any state mutation. "
        "Idempotency is enforced via Redis event ID cache (24 h TTL). "
        "DO NOT add authentication to this endpoint."
    ),
    include_in_schema=True,
)
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    x_razorpay_signature: str = Header(
        ...,
        alias="X-Razorpay-Signature",
        description="HMAC-SHA256 signature from Razorpay.",
    ),
) -> JSONResponse:
    """Handle inbound Razorpay webhook events."""
    payload_body = await request.body()
    svc = WebhookService(db, redis)
    result = await svc.handle(payload_body, x_razorpay_signature)
    await db.commit()
    return success_response(result)


# ===========================================================================
# Teacher Endpoints
# ===========================================================================


@router.post(
    "/{payment_id}/refund",
    summary="Initiate refund (teacher)",
    description=(
        "Teacher initiates a full or partial refund for a captured payment. "
        "Only the teacher who owns the course can initiate a refund. "
        "Partial refund: specify amount. Full refund: omit amount."
    ),
)
async def initiate_refund(
    payment_id: uuid.UUID,
    body: CreateRefundRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Initiate a refund for a captured payment."""
    svc = RefundService(db, teacher)
    data = await svc.initiate(
        payment_id=payment_id,
        amount=body.amount,
        reason=body.reason,
    )
    await db.commit()
    return success_response(data, message="Refund initiated successfully.")


@router.get(
    "/analytics",
    summary="Revenue analytics (teacher)",
    description=(
        "Returns comprehensive revenue analytics for the teacher's courses: "
        "today, week, month, year, and lifetime revenue; monthly breakdown chart; "
        "top-performing courses; refund and failure stats."
    ),
)
async def get_analytics(
    months: int = Query(default=12, ge=1, le=36),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return revenue analytics for the teacher."""
    svc = AnalyticsService(db, teacher)
    data = await svc.get_analytics(months=months)
    return success_response(data)


@router.get(
    "/all",
    summary="All payments (teacher)",
    description=(
        "Returns paginated payments across all teacher's courses. "
        "Supports filtering by status, course, student, date range, and search."
    ),
)
async def list_all_payments(
    params: TeacherPaymentParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return all payments across teacher's courses."""
    from app.modules.payment.repository import PaymentRepository

    repo = PaymentRepository(db)
    payments, total = await repo.list_for_teacher(
        teacher.id,
        page=params.page,
        page_size=params.page_size,
        status=params.status,
        course_id=params.course_id,
        student_id=params.student_id,
        from_date=params.from_date,
        to_date=params.to_date,
        search=params.search,
    )
    return paginated_response(
        payments, page=params.page, page_size=params.page_size, total=total
    )
