"""Student notifications router.

Mounts at /api/v1/notifications — provides notification history,
unread count, mark-read, mark-all-read, and delete.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import NotificationFilterParams
from app.modules.student.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Student - Notifications"])


@router.get(
    "",
    summary="List notifications",
    description=(
        "Returns paginated notifications for the student, newest first. "
        "Filter by unread_only or notification_type."
    ),
)
async def list_notifications(
    filters: NotificationFilterParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List student notifications."""
    svc = NotificationService(db, student)
    notifications, total = await svc.list_notifications(
        page=filters.page,
        page_size=filters.page_size,
        unread_only=filters.unread_only,
        notification_type=filters.notification_type,
    )
    return paginated_response(
        notifications, page=filters.page, page_size=filters.page_size, total=total
    )


@router.get(
    "/unread-count",
    summary="Unread notification count",
    description="Returns the count of unread notifications. Used for the notification badge.",
)
async def get_unread_count(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return unread notification badge count."""
    svc = NotificationService(db, student)
    count = await svc.get_unread_count()
    return success_response({"unread_count": count})


@router.post(
    "/{notification_id}/read",
    summary="Mark notification as read",
)
async def mark_notification_read(
    notification_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark a single notification as read."""
    svc = NotificationService(db, student)
    await svc.mark_read(notification_id)
    await db.commit()
    return success_response(message="Notification marked as read.")


@router.post(
    "/read-all",
    summary="Mark all notifications as read",
    description="Marks all unread notifications as read in a single batch operation.",
)
async def mark_all_notifications_read(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Mark all unread notifications as read."""
    svc = NotificationService(db, student)
    count = await svc.mark_all_read()
    await db.commit()
    return success_response(
        {"marked_count": count}, message=f"{count} notifications marked as read."
    )


@router.delete(
    "/{notification_id}",
    summary="Delete notification",
    status_code=204,
)
async def delete_notification(
    notification_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete a notification."""
    svc = NotificationService(db, student)
    await svc.delete_notification(notification_id)
    await db.commit()
    return Response(status_code=204)


@router.get(
    "/payments",
    summary="Payment history",
    description=(
        "Returns paginated payment records for the student, newest first. "
        "Includes course title, amount, status, and refund status."
    ),
)
async def list_payments(
    page: int = 1,
    page_size: int = 20,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List student payment history."""
    from app.modules.student.service import PaymentService
    svc = PaymentService(db, student)
    payments, total = await svc.list_payments(page=page, page_size=page_size)
    await db.commit()
    return paginated_response(payments, page=page, page_size=page_size, total=total)


@router.get(
    "/payments/{payment_id}",
    summary="Payment detail",
    description="Returns full detail for a single payment record.",
)
async def get_payment(
    payment_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return payment detail."""
    from app.modules.student.service import PaymentService
    svc = PaymentService(db, student)
    data = await svc.get_payment_detail(payment_id)
    return success_response(data)
