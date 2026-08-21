"""Payment module — Pydantic schemas.

Request bodies, response models, and query parameter classes for the
payment portal. Covers the full lifecycle from order creation through
webhook handling, refunds, and analytics.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Query
from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Request Schemas
# ===========================================================================


class CreateOrderRequest(BaseModel):
    """Request body for creating a Razorpay order."""

    course_id: uuid.UUID = Field(..., description="UUID of the course to purchase.")
    currency: str = Field(
        default="INR",
        max_length=3,
        description="ISO 4217 currency code.",
    )

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        """Normalize currency to uppercase."""
        return v.upper()


class VerifyPaymentRequest(BaseModel):
    """Client-side verification request after Razorpay checkout completes.

    The frontend sends all three Razorpay identifiers after the checkout
    modal closes successfully. The server re-verifies the signature before
    marking the payment as captured.
    """

    razorpay_order_id: str = Field(..., min_length=1)
    razorpay_payment_id: str = Field(..., min_length=1)
    razorpay_signature: str = Field(..., min_length=1)


class CreateRefundRequest(BaseModel):
    """Request body for initiating a refund."""

    payment_id: uuid.UUID = Field(..., description="Internal Payment UUID.")
    amount: Optional[float] = Field(
        default=None,
        gt=0,
        description="Refund amount in INR. Omit for full refund.",
    )
    reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Reason for the refund (visible to the student).",
    )


# ===========================================================================
# Response Schemas
# ===========================================================================


class CreateOrderResponse(BaseModel):
    """Response body after a Razorpay order is created."""

    payment_id: uuid.UUID
    razorpay_order_id: str
    razorpay_key_id: str
    amount_paise: int
    currency: str
    course_title: str
    course_price: float


class PaymentStatusResponse(BaseModel):
    """Single payment status payload."""

    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: float
    currency: str
    status: str
    refund_status: str
    refund_amount: Optional[float] = None
    invoice_number: Optional[str] = None
    webhook_verified: bool
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentHistoryItem(BaseModel):
    """Lightweight payment row for list views."""

    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    amount: float
    currency: str
    status: str
    refund_status: str
    invoice_number: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentHistoryEventItem(BaseModel):
    """Single payment state transition event."""

    from_status: Optional[str]
    to_status: str
    event: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RefundResponse(BaseModel):
    """Refund initiation response."""

    payment_id: uuid.UUID
    refund_id: str
    refund_amount: float
    refund_status: str
    refund_initiated_at: datetime


class InvoiceResponse(BaseModel):
    """Invoice metadata response."""

    payment_id: uuid.UUID
    invoice_number: str
    invoice_url: Optional[str] = None  # Presigned R2 URL if PDF exists
    course_title: str
    amount: float
    currency: str
    paid_at: Optional[datetime]


# ===========================================================================
# Analytics Schemas
# ===========================================================================


class RevenueBreakdown(BaseModel):
    """Revenue grouped by period."""

    period: str  # e.g. "2026-08"
    revenue: float
    transaction_count: int
    refund_amount: float
    net_revenue: float


class CourseRevenueItem(BaseModel):
    """Revenue per course."""

    course_id: uuid.UUID
    course_title: str
    total_revenue: float
    total_enrollments: int
    refund_amount: float
    net_revenue: float


class PaymentAnalyticsResponse(BaseModel):
    """Full analytics payload for the teacher dashboard."""

    today_revenue: float
    week_revenue: float
    month_revenue: float
    year_revenue: float
    total_revenue: float
    today_transactions: int
    month_transactions: int
    total_transactions: int
    total_refunds: float
    refund_count: int
    failed_count: int
    monthly_breakdown: list[RevenueBreakdown] = Field(default_factory=list)
    top_courses: list[CourseRevenueItem] = Field(default_factory=list)


# ===========================================================================
# Query Parameter Classes
# ===========================================================================


class PaymentHistoryParams:
    """Query parameters for payment history listing."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: Optional[int] = Query(default=None, ge=1, le=100),
        pageSize: Optional[int] = Query(default=None, ge=1, le=100),
        status: Optional[str] = Query(default=None),
        course_id: Optional[uuid.UUID] = Query(default=None),
    ) -> None:
        self.page = page
        self.page_size = page_size or pageSize or 20
        self.status = status
        self.course_id = course_id


class TeacherPaymentParams:
    """Query parameters for teacher payment overview."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        status: Optional[str] = Query(default=None),
        course_id: Optional[uuid.UUID] = Query(default=None),
        student_id: Optional[uuid.UUID] = Query(default=None),
        from_date: Optional[datetime] = Query(default=None),
        to_date: Optional[datetime] = Query(default=None),
        search: Optional[str] = Query(default=None, max_length=200),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.status = status
        self.course_id = course_id
        self.student_id = student_id
        self.from_date = from_date
        self.to_date = to_date
        self.search = search
