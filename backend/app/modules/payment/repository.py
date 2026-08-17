"""Payment module — repository layer.

All database I/O for the payment module. No business logic lives here.

Repositories:
    PaymentRepository         CRUD for Payment and PaymentHistory.
    EnrollmentRepository      CourseEnrollment creation and lookup.
    CourseRepository          Read-only course access for price validation.
    AnalyticsRepository       Revenue aggregation queries.
    NotificationRepository    Insert payment notifications.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, case, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course, CourseEnrollment
from app.models.enums import (
    EnrollmentStatus,
    NotificationChannel,
    NotificationType,
    PaymentStatus,
    RefundStatus,
)
from app.models.notification import Notification
from app.models.payment import Payment, PaymentHistory
from app.models.user import TeacherProfile, User


# ===========================================================================
# PaymentRepository
# ===========================================================================


class PaymentRepository:
    """Primary repository for Payment and PaymentHistory records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        razorpay_order_id: str,
        amount: float,
        currency: str,
        ip_address: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Payment:
        """Create a new Payment record for a checkout session.

        Args:
            student_id: The student initiating checkout.
            course_id: The course being purchased.
            razorpay_order_id: The Razorpay order ID returned from the API.
            amount: The amount in INR.
            currency: The ISO 4217 currency code.
            ip_address: The student's IP address for fraud logging.
            metadata: Optional extra context (UTM, promo code, etc.).

        Returns:
            Payment: The newly created payment record.
        """
        payment = Payment(
            student_id=student_id,
            course_id=course_id,
            razorpay_order_id=razorpay_order_id,
            amount=amount,
            currency=currency,
            status=PaymentStatus.CREATED,
            ip_address=ip_address,
            metadata_=metadata or {},
        )
        self._db.add(payment)
        await self._db.flush()
        return payment

    async def get_by_id(
        self,
        payment_id: uuid.UUID,
    ) -> Optional[Payment]:
        """Fetch a payment by internal UUID.

        Args:
            payment_id: The payment UUID.

        Returns:
            Payment | None: The payment or None.
        """
        return (
            await self._db.execute(
                select(Payment).where(Payment.id == payment_id)
            )
        ).scalar_one_or_none()

    async def get_by_order_id(
        self,
        razorpay_order_id: str,
    ) -> Optional[Payment]:
        """Fetch a payment by Razorpay order ID.

        Used by the webhook handler to locate the payment record.

        Args:
            razorpay_order_id: The Razorpay order ID.

        Returns:
            Payment | None: The payment or None.
        """
        return (
            await self._db.execute(
                select(Payment).where(
                    Payment.razorpay_order_id == razorpay_order_id
                )
            )
        ).scalar_one_or_none()

    async def get_by_razorpay_payment_id(
        self,
        razorpay_payment_id: str,
    ) -> Optional[Payment]:
        """Fetch a payment by Razorpay payment ID.

        Used by the webhook handler to detect already-processed events.

        Args:
            razorpay_payment_id: The Razorpay payment ID.

        Returns:
            Payment | None: The payment or None.
        """
        return (
            await self._db.execute(
                select(Payment).where(
                    Payment.razorpay_payment_id == razorpay_payment_id
                )
            )
        ).scalar_one_or_none()

    async def update_status(
        self,
        payment: Payment,
        status: str,
        razorpay_payment_id: Optional[str] = None,
        razorpay_signature: Optional[str] = None,
        failure_reason: Optional[str] = None,
        failure_code: Optional[str] = None,
        webhook_verified: bool = False,
        paid_at: Optional[datetime] = None,
        metadata_update: Optional[dict[str, Any]] = None,
    ) -> Payment:
        """Update the status and optional fields of a Payment record.

        Args:
            payment: The Payment ORM instance to update.
            status: New PaymentStatus value.
            razorpay_payment_id: Razorpay payment ID (set on capture).
            razorpay_signature: HMAC signature string.
            failure_reason: Human-readable failure description.
            failure_code: Razorpay failure code.
            webhook_verified: True after HMAC verification passes.
            paid_at: Timestamp when payment was captured.
            metadata_update: Additional fields to merge into metadata_.

        Returns:
            Payment: The updated payment instance.
        """
        old_status = payment.status
        payment.status = status

        if razorpay_payment_id is not None:
            payment.razorpay_payment_id = razorpay_payment_id
        if razorpay_signature is not None:
            payment.razorpay_signature = razorpay_signature
        if failure_reason is not None:
            payment.failure_reason = failure_reason
        if failure_code is not None:
            payment.failure_code = failure_code
        if webhook_verified:
            payment.webhook_verified = True
        if paid_at is not None:
            payment.paid_at = paid_at
        if metadata_update:
            payment.metadata_ = {**payment.metadata_, **metadata_update}

        await self._db.flush()
        return payment

    async def update_refund(
        self,
        payment: Payment,
        refund_id: str,
        refund_amount: float,
        refund_status: str,
    ) -> Payment:
        """Update refund fields on the payment record.

        Args:
            payment: The Payment ORM instance.
            refund_id: Razorpay refund ID.
            refund_amount: Amount refunded in INR.
            refund_status: New RefundStatus value.

        Returns:
            Payment: The updated payment instance.
        """
        payment.refund_id = refund_id
        payment.refund_amount = refund_amount
        payment.refund_status = refund_status
        payment.refund_initiated_at = datetime.now(timezone.utc)
        await self._db.flush()
        return payment

    async def set_invoice(
        self,
        payment: Payment,
        invoice_number: str,
        invoice_r2_key: Optional[str] = None,
    ) -> Payment:
        """Attach invoice metadata to the payment record.

        Args:
            payment: The Payment ORM instance.
            invoice_number: Sequential invoice number string.
            invoice_r2_key: R2 key for the PDF invoice file.

        Returns:
            Payment: The updated payment instance.
        """
        payment.invoice_number = invoice_number
        if invoice_r2_key is not None:
            payment.invoice_r2_key = invoice_r2_key
        await self._db.flush()
        return payment

    async def append_history(
        self,
        payment_id: uuid.UUID,
        from_status: Optional[str],
        to_status: str,
        event: str,
        actor_id: Optional[uuid.UUID] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> PaymentHistory:
        """Append an immutable state transition record to payment_history.

        Args:
            payment_id: The payment UUID.
            from_status: Previous status (None for initial creation).
            to_status: New status after transition.
            event: Dot-notation event string (e.g. 'webhook.payment.captured').
            actor_id: User who triggered the event. None for system events.
            metadata: Optional context (raw Razorpay payload, etc.).

        Returns:
            PaymentHistory: The newly created history record.
        """
        record = PaymentHistory(
            payment_id=payment_id,
            from_status=from_status,
            to_status=to_status,
            event=event,
            actor_id=actor_id,
            metadata_=metadata or {},
        )
        self._db.add(record)
        await self._db.flush()
        return record

    async def list_for_student(
        self,
        student_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        course_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated payment history for a student.

        Args:
            student_id: The student UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            status: Optional status filter.
            course_id: Optional course filter.

        Returns:
            tuple: (list of payment dicts, total count).
        """
        conditions = [Payment.student_id == student_id]
        if status:
            conditions.append(Payment.status == status)
        if course_id:
            conditions.append(Payment.course_id == course_id)

        count_stmt = select(func.count(Payment.id)).where(and_(*conditions))
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(
                Payment.id,
                Payment.course_id,
                Course.title.label("course_title"),
                Payment.amount,
                Payment.currency,
                Payment.status,
                Payment.refund_status,
                Payment.invoice_number,
                Payment.paid_at,
                Payment.created_at,
            )
            .join(Course, Course.id == Payment.course_id)
            .where(and_(*conditions))
            .order_by(desc(Payment.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self._db.execute(data_stmt)).all()
        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "amount": float(r.amount),
                "currency": r.currency,
                "status": r.status,
                "refund_status": r.refund_status,
                "invoice_number": r.invoice_number,
                "paid_at": r.paid_at,
                "created_at": r.created_at,
            }
            for r in rows
        ], total

    async def list_for_teacher(
        self,
        teacher_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        course_id: Optional[uuid.UUID] = None,
        student_id: Optional[uuid.UUID] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        search: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return paginated payments across all teacher's courses.

        Args:
            teacher_id: The teacher UUID.
            page: 1-indexed page number.
            page_size: Items per page.
            status: Optional payment status filter.
            course_id: Optional course filter.
            student_id: Optional student filter.
            from_date: Optional date range start.
            to_date: Optional date range end.
            search: Optional student name / email search.

        Returns:
            tuple: (list of payment dicts, total count).
        """
        conditions = [Course.teacher_id == teacher_id]
        if status:
            conditions.append(Payment.status == status)
        if course_id:
            conditions.append(Payment.course_id == course_id)
        if student_id:
            conditions.append(Payment.student_id == student_id)
        if from_date:
            conditions.append(Payment.created_at >= from_date)
        if to_date:
            conditions.append(Payment.created_at <= to_date)
        if search:
            conditions.append(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                )
            )

        base = (
            select(
                Payment.id,
                Payment.course_id,
                Course.title.label("course_title"),
                Payment.student_id,
                User.full_name.label("student_name"),
                User.email.label("student_email"),
                Payment.amount,
                Payment.currency,
                Payment.status,
                Payment.refund_status,
                Payment.refund_amount,
                Payment.razorpay_order_id,
                Payment.razorpay_payment_id,
                Payment.invoice_number,
                Payment.webhook_verified,
                Payment.paid_at,
                Payment.created_at,
            )
            .join(Course, Course.id == Payment.course_id)
            .join(User, User.id == Payment.student_id)
            .where(and_(*conditions))
        )

        count_stmt = select(func.count()).select_from(base.subquery())
        total: int = (await self._db.execute(count_stmt)).scalar_one()

        rows = (
            await self._db.execute(
                base.order_by(desc(Payment.created_at))
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()

        return [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_title": r.course_title,
                "student_id": r.student_id,
                "student_name": r.student_name,
                "student_email": r.student_email,
                "amount": float(r.amount),
                "currency": r.currency,
                "status": r.status,
                "refund_status": r.refund_status,
                "refund_amount": float(r.refund_amount) if r.refund_amount else None,
                "razorpay_order_id": r.razorpay_order_id,
                "razorpay_payment_id": r.razorpay_payment_id,
                "invoice_number": r.invoice_number,
                "webhook_verified": r.webhook_verified,
                "paid_at": r.paid_at,
                "created_at": r.created_at,
            }
            for r in rows
        ], total

    async def get_history(
        self,
        payment_id: uuid.UUID,
    ) -> list[PaymentHistory]:
        """Return all state transition records for a payment.

        Args:
            payment_id: The payment UUID.

        Returns:
            list[PaymentHistory]: Ordered history records.
        """
        return list(
            (
                await self._db.execute(
                    select(PaymentHistory)
                    .where(PaymentHistory.payment_id == payment_id)
                    .order_by(PaymentHistory.created_at.asc())
                )
            )
            .scalars()
            .all()
        )


# ===========================================================================
# EnrollmentRepository
# ===========================================================================


class EnrollmentRepository:
    """Repository for creating and querying CourseEnrollment records."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def exists(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
    ) -> bool:
        """Check if an enrollment record already exists for this student + course.

        Used for duplicate enrollment prevention.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.

        Returns:
            bool: True if an enrollment exists.
        """
        count = (
            await self._db.execute(
                select(func.count(CourseEnrollment.id)).where(
                    CourseEnrollment.student_id == student_id,
                    CourseEnrollment.course_id == course_id,
                )
            )
        ).scalar_one()
        return count > 0

    async def create(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        payment_id: uuid.UUID,
    ) -> CourseEnrollment:
        """Create an active enrollment record after successful payment.

        Args:
            student_id: The student UUID.
            course_id: The course UUID.
            payment_id: The Payment UUID (for FK linkage).

        Returns:
            CourseEnrollment: The newly created enrollment.
        """
        enrollment = CourseEnrollment(
            student_id=student_id,
            course_id=course_id,
            payment_id=payment_id,
            status=EnrollmentStatus.ACTIVE,
            enrolled_at=datetime.now(timezone.utc),
        )
        self._db.add(enrollment)
        await self._db.flush()
        return enrollment

    async def increment_total_enrollments(
        self,
        course_id: uuid.UUID,
    ) -> None:
        """Increment the denormalized total_enrollments counter on Course.

        Args:
            course_id: The course UUID.
        """
        await self._db.execute(
            update(Course)
            .where(Course.id == course_id)
            .values(total_enrollments=Course.total_enrollments + 1)
        )
        await self._db.flush()

    async def increment_teacher_students(
        self,
        course_id: uuid.UUID,
    ) -> None:
        """Increment the teacher's denormalized total_students counter.

        Args:
            course_id: The course UUID.
        """
        from app.models.user import TeacherProfile

        teacher_id_stmt = select(Course.teacher_id).where(Course.id == course_id)
        teacher_id = (await self._db.execute(teacher_id_stmt)).scalar_one_or_none()
        if teacher_id is None:
            return

        await self._db.execute(
            update(TeacherProfile)
            .where(TeacherProfile.user_id == teacher_id)
            .values(total_students=TeacherProfile.total_students + 1)
        )
        await self._db.flush()

    async def increment_student_enrolled_count(
        self,
        student_id: uuid.UUID,
    ) -> None:
        """Increment the denormalized total_courses_enrolled counter on StudentProfile.

        Args:
            student_id: The student UUID.
        """
        from app.models.user import StudentProfile

        await self._db.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == student_id)
            .values(
                total_courses_enrolled=StudentProfile.total_courses_enrolled + 1
            )
        )
        await self._db.flush()


# ===========================================================================
# CourseRepository
# ===========================================================================


class CourseRepository:
    """Read-only course data access for price and status validation."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_by_id(
        self,
        course_id: uuid.UUID,
    ) -> Optional[Course]:
        """Fetch a course by UUID.

        Args:
            course_id: The course UUID.

        Returns:
            Course | None: The course or None.
        """
        return (
            await self._db.execute(
                select(Course).where(
                    Course.id == course_id,
                    Course.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def get_teacher_id(
        self,
        course_id: uuid.UUID,
    ) -> Optional[uuid.UUID]:
        """Return the teacher_id of a course.

        Args:
            course_id: The course UUID.

        Returns:
            uuid.UUID | None: The teacher user UUID.
        """
        return (
            await self._db.execute(
                select(Course.teacher_id).where(Course.id == course_id)
            )
        ).scalar_one_or_none()


# ===========================================================================
# AnalyticsRepository
# ===========================================================================


class AnalyticsRepository:
    """Revenue aggregation queries scoped to a teacher's courses."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def get_revenue_summary(
        self,
        teacher_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Return period-level revenue aggregates for the teacher.

        Computes today, this week, this month, this year, and lifetime
        totals from captured payments on the teacher's courses.

        Args:
            teacher_id: The teacher UUID.

        Returns:
            dict: Revenue summary.
        """
        from sqlalchemy import extract, literal_column
        now = datetime.now(timezone.utc)

        base_cond = and_(
            Course.teacher_id == teacher_id,
            Payment.status == PaymentStatus.CAPTURED,
        )

        stmt = (
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                func.date(Payment.paid_at)
                                == func.date(func.now()),
                                Payment.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("today"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Payment.paid_at >= func.date_trunc("week", func.now()),
                                Payment.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("week"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Payment.paid_at >= func.date_trunc("month", func.now()),
                                Payment.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("month"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Payment.paid_at >= func.date_trunc("year", func.now()),
                                Payment.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("year"),
                func.coalesce(func.sum(Payment.amount), 0).label("total"),
                func.count(
                    case((Payment.paid_at >= func.date_trunc("month", func.now()), 1))
                ).label("month_tx"),
                func.count(Payment.id).label("total_tx"),
                func.count(
                    case(
                        (
                            func.date(Payment.paid_at) == func.date(func.now()),
                            1,
                        )
                    )
                ).label("today_tx"),
            )
            .join(Course, Course.id == Payment.course_id)
            .where(base_cond)
        )
        row = (await self._db.execute(stmt)).one()

        # Refund totals
        refund_stmt = (
            select(
                func.coalesce(func.sum(Payment.refund_amount), 0).label("total_refunds"),
                func.count(
                    case((Payment.refund_status != RefundStatus.NONE, 1))
                ).label("refund_count"),
            )
            .join(Course, Course.id == Payment.course_id)
            .where(Course.teacher_id == teacher_id)
        )
        refund_row = (await self._db.execute(refund_stmt)).one()

        # Failed count
        failed_count = (
            await self._db.execute(
                select(func.count(Payment.id))
                .join(Course, Course.id == Payment.course_id)
                .where(
                    Course.teacher_id == teacher_id,
                    Payment.status == PaymentStatus.FAILED,
                )
            )
        ).scalar_one()

        return {
            "today_revenue": float(row.today),
            "week_revenue": float(row.week),
            "month_revenue": float(row.month),
            "year_revenue": float(row.year),
            "total_revenue": float(row.total),
            "today_transactions": row.today_tx or 0,
            "month_transactions": row.month_tx or 0,
            "total_transactions": row.total_tx or 0,
            "total_refunds": float(refund_row.total_refunds),
            "refund_count": refund_row.refund_count or 0,
            "failed_count": failed_count,
        }

    async def get_monthly_breakdown(
        self,
        teacher_id: uuid.UUID,
        months: int = 12,
    ) -> list[dict[str, Any]]:
        """Return monthly revenue grouped by calendar month.

        Args:
            teacher_id: The teacher UUID.
            months: Number of past months to include.

        Returns:
            list[dict]: Monthly revenue data.
        """
        from sqlalchemy import extract, text as sa_text

        stmt = (
            select(
                func.to_char(Payment.paid_at, "YYYY-MM").label("period"),
                func.coalesce(func.sum(Payment.amount), 0).label("revenue"),
                func.count(Payment.id).label("transaction_count"),
                func.coalesce(
                    func.sum(
                        case((Payment.refund_amount.is_not(None), Payment.refund_amount), else_=0)
                    ),
                    0,
                ).label("refund_amount"),
            )
            .join(Course, Course.id == Payment.course_id)
            .where(
                Course.teacher_id == teacher_id,
                Payment.status == PaymentStatus.CAPTURED,
                Payment.paid_at >= func.date_trunc(
                    "month",
                    func.now() - func.cast(
                        func.concat(str(months), " months"),
                        sa_text("interval"),
                    ),
                ),
            )
            .group_by(func.to_char(Payment.paid_at, "YYYY-MM"))
            .order_by(func.to_char(Payment.paid_at, "YYYY-MM").asc())
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "period": r.period,
                "revenue": float(r.revenue),
                "transaction_count": r.transaction_count,
                "refund_amount": float(r.refund_amount),
                "net_revenue": float(r.revenue) - float(r.refund_amount),
            }
            for r in rows
        ]

    async def get_top_courses(
        self,
        teacher_id: uuid.UUID,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Return the teacher's highest-revenue courses.

        Args:
            teacher_id: The teacher UUID.
            limit: Maximum courses to return.

        Returns:
            list[dict]: Course revenue data.
        """
        stmt = (
            select(
                Course.id.label("course_id"),
                Course.title.label("course_title"),
                func.coalesce(func.sum(Payment.amount), 0).label("total_revenue"),
                func.count(Payment.id).label("total_enrollments"),
                func.coalesce(
                    func.sum(
                        case(
                            (Payment.refund_amount.is_not(None), Payment.refund_amount),
                            else_=0,
                        )
                    ),
                    0,
                ).label("refund_amount"),
            )
            .join(Payment, Payment.course_id == Course.id)
            .where(
                Course.teacher_id == teacher_id,
                Payment.status == PaymentStatus.CAPTURED,
            )
            .group_by(Course.id, Course.title)
            .order_by(desc(func.sum(Payment.amount)))
            .limit(limit)
        )
        rows = (await self._db.execute(stmt)).all()
        return [
            {
                "course_id": r.course_id,
                "course_title": r.course_title,
                "total_revenue": float(r.total_revenue),
                "total_enrollments": r.total_enrollments,
                "refund_amount": float(r.refund_amount),
                "net_revenue": float(r.total_revenue) - float(r.refund_amount),
            }
            for r in rows
        ]


# ===========================================================================
# NotificationRepository
# ===========================================================================


class NotificationRepository:
    """Inserts payment-related notifications."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with an async database session.

        Args:
            db: The async SQLAlchemy session.
        """
        self._db = db

    async def create(
        self,
        recipient_id: uuid.UUID,
        notification_type: str,
        title: str,
        body: str,
        actor_id: Optional[uuid.UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[uuid.UUID] = None,
        action_url: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Notification:
        """Insert a new in-app notification record.

        Args:
            recipient_id: The user who will receive this notification.
            notification_type: NotificationType enum value string.
            title: Short notification title.
            body: Full notification body text.
            actor_id: Optional user who triggered the event.
            entity_type: Optional entity category (e.g. 'course').
            entity_id: Optional entity UUID.
            action_url: Optional deep link URL.
            metadata: Optional extra context.

        Returns:
            Notification: The inserted notification record.
        """
        notification = Notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            type=notification_type,
            title=title,
            body=body,
            action_url=action_url,
            entity_type=entity_type,
            entity_id=entity_id,
            channel=NotificationChannel.IN_APP,
            metadata_=metadata or {},
        )
        self._db.add(notification)
        await self._db.flush()
        return notification
