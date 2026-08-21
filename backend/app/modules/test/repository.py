"""Repository layer for tests and grades."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course, CourseEnrollment
from app.models.test import CourseTest, TestGrade


class TestRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create_test(
        self,
        course_id: uuid.UUID,
        teacher_id: uuid.UUID,
        title: str,
        google_form_url: str,
        start_time: datetime,
        end_time: datetime,
        max_score: float = 100.0,
        description: Optional[str] = None,
    ) -> CourseTest:
        test = CourseTest(
            course_id=course_id,
            teacher_id=teacher_id,
            title=title,
            description=description,
            google_form_url=google_form_url,
            start_time=start_time,
            end_time=end_time,
            max_score=max_score,
            is_active=True,
        )
        self._db.add(test)
        await self._db.flush()
        await self._db.refresh(test)
        return test

    async def get_test(self, test_id: uuid.UUID) -> Optional[CourseTest]:
        stmt = select(CourseTest).where(CourseTest.id == test_id, CourseTest.is_active.is_(True))
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def list_teacher_tests(
        self, teacher_id: uuid.UUID, course_id: Optional[uuid.UUID] = None
    ) -> list[CourseTest]:
        stmt = (
            select(CourseTest)
            .join(Course, Course.id == CourseTest.course_id)
            .where(
                CourseTest.teacher_id == teacher_id,
                CourseTest.is_active.is_(True),
                Course.deleted_at.is_(None),
            )
            .order_by(CourseTest.created_at.desc())
        )
        if course_id:
            stmt = stmt.where(CourseTest.course_id == course_id)
        return list((await self._db.execute(stmt)).scalars().all())

    async def list_student_tests(self, student_id: uuid.UUID) -> list[tuple[CourseTest, Optional[TestGrade]]]:
        # Enrolled courses for this student
        enrolled_stmt = select(CourseEnrollment.course_id).where(CourseEnrollment.student_id == student_id)
        course_ids = list((await self._db.execute(enrolled_stmt)).scalars().all())
        if not course_ids:
            return []

        tests_stmt = (
            select(CourseTest)
            .where(
                CourseTest.course_id.in_(course_ids),
                CourseTest.is_active.is_(True),
            )
            .order_by(CourseTest.start_time.asc())
        )
        tests = list((await self._db.execute(tests_stmt)).scalars().all())

        results = []
        for t in tests:
            grade_stmt = select(TestGrade).where(TestGrade.test_id == t.id, TestGrade.student_id == student_id)
            grade = (await self._db.execute(grade_stmt)).scalar_one_or_none()
            results.append((t, grade))

        return results

    async def save_grade(
        self, test_id: uuid.UUID, student_id: uuid.UUID, score: float, feedback: Optional[str] = None
    ) -> TestGrade:
        stmt = select(TestGrade).where(TestGrade.test_id == test_id, TestGrade.student_id == student_id)
        grade = (await self._db.execute(stmt)).scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if grade:
            grade.score = score
            grade.feedback = feedback
            grade.graded_at = now
        else:
            grade = TestGrade(
                test_id=test_id,
                student_id=student_id,
                score=score,
                feedback=feedback,
                graded_at=now,
            )
            self._db.add(grade)
        await self._db.flush()
        return grade

    async def delete_test(self, test: CourseTest) -> None:
        test.is_active = False
        await self._db.flush()
