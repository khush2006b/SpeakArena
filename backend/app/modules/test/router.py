"""FastAPI routes for the Tests & Grading system."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_student, get_current_teacher
from app.database import get_db_session
from app.models.user import User
from app.modules.test.schemas import BulkGradeRequest, CreateTestRequest, UpdateTestRequest
from app.modules.test.service import TestService
from app.core.utils.response import success_response

router = APIRouter(prefix="", tags=["tests"])


# ============================================================================
# Teacher Endpoints
# ============================================================================

@router.get(
    "/teacher/tests",
    summary="List tests created by teacher",
)
async def list_teacher_tests(
    course_id: Optional[uuid.UUID] = Query(default=None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    data = await svc.list_teacher_tests(teacher.id, course_id)
    return success_response([d.model_dump() for d in data])


@router.post(
    "/teacher/tests",
    summary="Create test for a course",
    status_code=status.HTTP_201_CREATED,
)
async def create_test(
    body: CreateTestRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    data = await svc.create_test(teacher.id, body)
    await db.commit()
    return success_response(data.model_dump(), status_code=status.HTTP_201_CREATED)


@router.put(
    "/teacher/tests/{test_id}",
    summary="Update a test",
)
async def update_test(
    test_id: uuid.UUID,
    body: UpdateTestRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    data = await svc.update_test(teacher.id, test_id, body)
    await db.commit()
    return success_response(data.model_dump())


@router.delete(
    "/teacher/tests/{test_id}",
    summary="Delete a test",
)
async def delete_test(
    test_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    await svc.delete_test(teacher.id, test_id)
    await db.commit()
    return success_response(message="Test deleted successfully.")


@router.post(
    "/teacher/tests/{test_id}/grades",
    summary="Save student grades for a test",
)
async def save_grades(
    test_id: uuid.UUID,
    body: BulkGradeRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    data = await svc.save_grades(teacher.id, test_id, body)
    await db.commit()
    return success_response(data.model_dump())


# ============================================================================
# Student Endpoints
# ============================================================================

@router.get(
    "/student/tests",
    summary="List tests for student's enrolled courses",
)
async def list_student_tests(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    svc = TestService(db)
    data = await svc.list_student_tests(student.id)
    return success_response([d.model_dump() for d in data])
