"""Resource notification dispatchers.

Dispatches in-app notifications to all actively enrolled students of a course
when a teacher confirms or publishes a resource (video or PDF).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course, CourseEnrollment
from app.models.enums import EnrollmentStatus, NotificationChannel, NotificationType
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)


async def notify_enrolled_students_of_resource(
    db: AsyncSession,
    course_id: uuid.UUID,
    resource_title: str,
    resource_type: str,  # "video" or "pdf"
    resource_id: uuid.UUID,
    teacher: Optional[User] = None,
    teacher_id: Optional[uuid.UUID] = None,
) -> int:
    """Send an in-app notification to all actively enrolled students of a course when a resource is added.

    Args:
        db: Async database session.
        course_id: The course UUID.
        resource_title: The title of the resource.
        resource_type: "video" or "pdf".
        resource_id: The UUID of the video or PDF.
        teacher: Optional teacher User object.
        teacher_id: Optional teacher UUID.

    Returns:
        int: Number of student notifications created.
    """
    try:
        res_type_clean = resource_type.lower().strip()

        # Prevent duplicate notifications if already dispatched for this resource
        existing = await db.execute(
            select(Notification.id).where(
                Notification.entity_type == res_type_clean,
                Notification.entity_id == resource_id,
            ).limit(1)
        )
        if existing.first():
            logger.debug(
                "Notification already exists for %s %s, skipping.",
                res_type_clean,
                resource_id,
            )
            return 0

        # Fetch course details
        course_res = await db.execute(
            select(Course.title, Course.teacher_id).where(Course.id == course_id)
        )
        row = course_res.first()
        if not row:
            logger.warning("Course %s not found for resource notification.", course_id)
            return 0

        course_title = row.title or "Course"
        t_id = (teacher.id if teacher else teacher_id) or row.teacher_id

        # Resolve teacher display name
        teacher_name = "Your instructor"
        if teacher and getattr(teacher, "full_name", None):
            teacher_name = teacher.full_name
        elif t_id:
            user_res = await db.execute(select(User.full_name).where(User.id == t_id))
            user_row = user_res.first()
            if user_row and user_row.full_name:
                teacher_name = user_row.full_name

        # Query all active enrolled students
        result = await db.execute(
            select(CourseEnrollment.student_id).where(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        student_ids = result.scalars().all()
        if not student_ids:
            logger.info(
                "No active students enrolled in course %s to notify for %s %s.",
                course_id,
                res_type_clean,
                resource_id,
            )
            return 0

        res_label = "video lesson" if res_type_clean == "video" else "study material (PDF)"

        notifs_added = 0
        for student_id in student_ids:
            # Do not notify the teacher if they enrolled in their own course
            if t_id and student_id == t_id:
                continue

            db.add(
                Notification(
                    recipient_id=student_id,
                    actor_id=t_id,
                    type=NotificationType.RESOURCE_UPLOADED,
                    title=f"New {res_label.title()} Added",
                    body=f'{teacher_name} uploaded "{resource_title}" in {course_title}.',
                    entity_type=res_type_clean,
                    entity_id=resource_id,
                    action_url=f"/student/resources?courseId={course_id}",
                    channel=NotificationChannel.IN_APP,
                )
            )
            notifs_added += 1

        logger.info(
            "Created %d in-app notification(s) for course=%s resource=%s (%s)",
            notifs_added,
            course_id,
            resource_id,
            res_type_clean,
        )
        return notifs_added

    except Exception as exc:
        logger.error(
            "Failed to notify students of resource for course=%s resource=%s: %s",
            course_id,
            resource_id,
            exc,
            exc_info=True,
        )
        return 0
