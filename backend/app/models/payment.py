"""Payment and PaymentHistory models.

Payment       : Razorpay payment record. Financial source of truth.
PaymentHistory: Append-only state transition audit trail.

Financial records are never deleted. ON DELETE RESTRICT on both
student_id and course_id prevents any accidental orphaning.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentStatus, RefundStatus

if TYPE_CHECKING:
    from app.models.course import Course, CourseEnrollment
    from app.models.user import User


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Razorpay payment record. The financial source of truth.

    Created when the student initiates checkout. Updated via the
    Razorpay webhook after payment capture or failure.
    webhook_verified must be True before the enrollment service
    grants course access.

    This table is never deleted. GDPR erasure anonymizes the student_id
    FK by setting it to the system-anonymous user, preserving accounting
    records while removing PII linkage.
    """

    __tablename__ = "payments"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    razorpay_order_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, default=None, unique=True
    )
    razorpay_signature: Mapped[Optional[str]] = mapped_column(
        String(256), nullable=True, default=None,
        comment="HMAC-SHA256 signature for server-side verification.",
    )
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False,
        comment="Paid amount in INR.",
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PaymentStatus.CREATED,
        server_default="created",
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default=None
    )
    failure_code: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, default=None
    )
    refund_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, default=None
    )
    refund_amount: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True, default=None
    )
    refund_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=RefundStatus.NONE,
        server_default="none",
    )
    refund_initiated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default=None
    )
    invoice_r2_key: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    webhook_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        comment="Must be True before enrollment is granted.",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True, default=None)
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
        comment="UTM, promo codes, raw Razorpay webhook payload.",
    )
    captured_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )

    # --- Relationships ---
    student: Mapped[User] = relationship(
        "User", back_populates="payments", foreign_keys=[student_id]
    )
    course: Mapped[Course] = relationship("Course", foreign_keys=[course_id])
    enrollment: Mapped[Optional[CourseEnrollment]] = relationship(
        "CourseEnrollment",
        back_populates="payment",
        foreign_keys="CourseEnrollment.payment_id",
        uselist=False,
    )
    history: Mapped[list[PaymentHistory]] = relationship(
        "PaymentHistory",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="PaymentHistory.created_at.asc()",
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Payment id={self.id} status={self.status} amount={self.amount}>"


class PaymentHistory(UUIDPrimaryKeyMixin, Base):
    """Append-only payment state transition log.

    One record per state change, written by the webhook handler and
    the refund service. Used for dispute resolution and customer support.
    This table is never updated or deleted after insertion.
    actor_id is NULL for system and webhook-initiated transitions.
    """

    __tablename__ = "payment_history"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    event: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="e.g. webhook.payment.captured | refund.initiated",
    )
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    payment: Mapped[Payment] = relationship("Payment", back_populates="history")
    actor: Mapped[Optional[User]] = relationship("User", foreign_keys=[actor_id])

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<PaymentHistory payment={self.payment_id} event={self.event}>"
