"""Service layer for tests and grades."""

from datetime import datetime, timezone
import uuid
from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course, CourseEnrollment
from app.models.test import CourseTest, TestGrade
from app.models.user import User
from app.modules.teacher.repository import StudentManagementRepository
from app.modules.test.repository import TestRepository
from app.modules.test.schemas import (
    BulkGradeRequest,
    CreateTestRequest,
    StudentTestResponse,
    TeacherTestResponse,
    TestGradeResponse,
    UpdateTestRequest,
)


class TestService:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._repo = TestRepository(db)
        self._student_repo = StudentManagementRepository(db)

    async def create_test(self, teacher_id: uuid.UUID, body: CreateTestRequest) -> TeacherTestResponse:
        test = await self._repo.create_test(
            course_id=body.course_id,
            teacher_id=teacher_id,
            title=body.title,
            description=body.description,
            google_form_url=body.google_form_url,
            start_time=body.start_time,
            end_time=body.end_time,
            max_score=body.max_score,
        )
        return await self._format_teacher_test(test)

    async def update_test(
        self, teacher_id: uuid.UUID, test_id: uuid.UUID, body: UpdateTestRequest
    ) -> TeacherTestResponse:
        test = await self._repo.get_test(test_id)
        if not test or test.teacher_id != teacher_id:
            raise ValueError("Test not found or access denied")

        if body.title is not None:
            test.title = body.title
        if body.description is not None:
            test.description = body.description
        if body.google_form_url is not None:
            test.google_form_url = body.google_form_url
        if body.start_time is not None:
            test.start_time = body.start_time
        if body.end_time is not None:
            test.end_time = body.end_time
        if body.max_score is not None:
            test.max_score = body.max_score

        await self._db.flush()
        return await self._format_teacher_test(test)

    async def delete_test(self, teacher_id: uuid.UUID, test_id: uuid.UUID) -> None:
        test = await self._repo.get_test(test_id)
        if not test or test.teacher_id != teacher_id:
            raise ValueError("Test not found or access denied")
        await self._repo.delete_test(test)

    async def list_teacher_tests(
        self, teacher_id: uuid.UUID, course_id: Optional[uuid.UUID] = None
    ) -> list[TeacherTestResponse]:
        tests = await self._repo.list_teacher_tests(teacher_id, course_id)
        return [await self._format_teacher_test(t) for t in tests]

    async def save_grades(
        self, teacher_id: uuid.UUID, test_id: uuid.UUID, body: BulkGradeRequest
    ) -> TeacherTestResponse:
        test = await self._repo.get_test(test_id)
        if not test or test.teacher_id != teacher_id:
            raise ValueError("Test not found or access denied")

        for item in body.grades:
            await self._repo.save_grade(
                test_id=test_id,
                student_id=item.student_id,
                score=item.score,
                feedback=item.feedback,
            )
        await self._db.flush()
        return await self._format_teacher_test(test)

    async def list_student_tests(self, student_id: uuid.UUID) -> list[StudentTestResponse]:
        raw_list = await self._repo.list_student_tests(student_id)
        now = datetime.now(timezone.utc)

        responses = []
        for test, grade in raw_list:
            s_time = test.start_time if test.start_time.tzinfo else test.start_time.replace(tzinfo=timezone.utc)
            e_time = test.end_time if test.end_time.tzinfo else test.end_time.replace(tzinfo=timezone.utc)

            is_open = s_time <= now <= e_time
            if now < s_time:
                status = "UPCOMING"
            elif s_time <= now <= e_time:
                status = "OPEN"
            else:
                status = "CLOSED"

            course = await self._db.get(Course, test.course_id)
            c_title = course.title if course else "Enrolled Course"

            responses.append(
                StudentTestResponse(
                    id=str(test.id),
                    course_id=str(test.course_id),
                    course_title=c_title,
                    title=test.title,
                    description=test.description,
                    google_form_url=test.google_form_url if is_open else None,
                    start_time=s_time.isoformat(),
                    end_time=e_time.isoformat(),
                    max_score=test.max_score,
                    is_open=is_open,
                    status=status,
                    score=grade.score if grade else None,
                    feedback=grade.feedback if grade else None,
                    is_graded=grade is not None,
                )
            )
        return responses

    async def _format_teacher_test(self, test: CourseTest) -> TeacherTestResponse:
        now = datetime.now(timezone.utc)
        s_time = test.start_time if test.start_time.tzinfo else test.start_time.replace(tzinfo=timezone.utc)
        e_time = test.end_time if test.end_time.tzinfo else test.end_time.replace(tzinfo=timezone.utc)

        is_open = s_time <= now <= e_time
        if now < s_time:
            status = "UPCOMING"
        elif s_time <= now <= e_time:
            status = "OPEN"
        else:
            status = "CLOSED"

        course = await self._db.get(Course, test.course_id)
        c_title = course.title if course else "Course"

        students_tuple = await self._student_repo.list_enrolled_students(
            teacher_id=test.teacher_id, course_id=test.course_id, page_size=100
        )
        enrolled_students = students_tuple[0] if isinstance(students_tuple, tuple) else []

        grades_map = {g.student_id: g for g in test.grades}
        grade_responses = []

        for st in enrolled_students:
            st_id = uuid.UUID(st["student_id"]) if isinstance(st["student_id"], str) else st["student_id"]
            g = grades_map.get(st_id)

            grade_responses.append(
                TestGradeResponse(
                    id=str(g.id) if g else f"pending-{st_id}",
                    student_id=str(st_id),
                    student_name=st.get("full_name") or st.get("student_name") or "Student",
                    student_email=st.get("email") or st.get("student_email") or "",
                    score=g.score if g else 0.0,
                    feedback=g.feedback if g else None,
                    graded_at=g.graded_at.isoformat() if g else "",
                )
            )

        return TeacherTestResponse(
            id=str(test.id),
            course_id=str(test.course_id),
            course_title=c_title,
            title=test.title,
            description=test.description,
            google_form_url=test.google_form_url,
            start_time=s_time.isoformat(),
            end_time=e_time.isoformat(),
            max_score=test.max_score,
            is_open=is_open,
            status=status,
            grades=grade_responses,
        )
