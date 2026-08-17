"""Assignment module — router.

Mounts at /api/v1/assignments.

Teacher Endpoints:
    POST /assignments                       Create assignment.
    GET  /assignments/{course_id}           List all assignments.
    PATCH /assignments/{assignment_id}      Update assignment.
    POST /assignments/{assignment_id}/publish  Publish assignment.
    DELETE /assignments/{assignment_id}     Delete assignment.
    GET  /assignments/{assignment_id}/submissions  List submissions.
    POST /assignments/submissions/{id}/grade  Grade a submission.

Student Endpoints:
    GET  /assignments/{course_id}/me           List published + my submission.
    POST /assignments/{assignment_id}/submit/text  Text submission.
    POST /assignments/{assignment_id}/submit/file-initiate  Presign upload.
    POST /assignments/{assignment_id}/submit/file-confirm   Confirm upload.
    GET  /assignments/{assignment_id}/my-submission   My submission status.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import paginated_response, success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.auth.dependencies import get_current_student, get_current_teacher, get_current_user
from app.modules.assignment.schemas import (
    AssignmentListParams,
    ConfirmFileSubmissionRequest,
    CreateAssignmentRequest,
    GradeSubmissionRequest,
    InitiateFileSubmissionRequest,
    SubmissionListParams,
    SubmitTextRequest,
    UpdateAssignmentRequest,
)
from app.modules.assignment.service import (
    AssignmentService,
    StudentAssignmentService,
    SubmissionService,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])


# ===========================================================================
# Teacher — Assignment CRUD
# ===========================================================================


@router.post(
    "",
    summary="Create assignment (teacher)",
    description=(
        "Create a new assignment for a course. Assignments are hidden from "
        "students until explicitly published via the /publish endpoint."
    ),
    status_code=201,
)
async def create_assignment(
    body: CreateAssignmentRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Create a new assignment."""
    svc = AssignmentService(db, teacher)
    data = await svc.create(body)
    await db.commit()
    return success_response(data, status_code=201)


@router.get(
    "/{course_id}",
    summary="List assignments (teacher)",
    description="List all assignments for a course including unpublished ones.",
)
async def list_assignments_teacher(
    course_id: uuid.UUID,
    params: AssignmentListParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List all assignments for a course."""
    svc = AssignmentService(db, teacher)
    assignments, total = await svc.list_assignments(
        course_id,
        page=params.page,
        page_size=params.page_size,
    )
    return paginated_response(
        assignments, page=params.page, page_size=params.page_size, total=total
    )


@router.patch(
    "/{assignment_id}",
    summary="Update assignment (teacher)",
    description="Partial update of assignment title, description, due date, or scoring.",
)
async def update_assignment(
    assignment_id: uuid.UUID,
    body: UpdateAssignmentRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update assignment metadata."""
    svc = AssignmentService(db, teacher)
    data = await svc.update(assignment_id, body)
    await db.commit()
    return success_response(data)


@router.post(
    "/{assignment_id}/publish",
    summary="Publish assignment (teacher)",
    description="Publish an assignment, making it visible to enrolled students.",
)
async def publish_assignment(
    assignment_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Publish an assignment."""
    svc = AssignmentService(db, teacher)
    data = await svc.publish(assignment_id)
    await db.commit()
    return success_response(data, message="Assignment published.")


@router.delete(
    "/{assignment_id}",
    summary="Delete assignment (teacher)",
    description="Soft-delete an assignment and all its submissions.",
    status_code=204,
)
async def delete_assignment(
    assignment_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Delete an assignment."""
    svc = AssignmentService(db, teacher)
    await svc.delete(assignment_id)
    await db.commit()
    return Response(status_code=204)


# ===========================================================================
# Teacher — Submissions Management
# ===========================================================================


@router.get(
    "/{assignment_id}/submissions",
    summary="List submissions (teacher)",
    description="List all student submissions for an assignment.",
)
async def list_submissions(
    assignment_id: uuid.UUID,
    params: SubmissionListParams = Depends(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List submissions for an assignment."""
    svc = SubmissionService(db, teacher)
    submissions, total = await svc.list_submissions(
        assignment_id,
        page=params.page,
        page_size=params.page_size,
        graded_only=params.graded_only,
    )
    return paginated_response(
        submissions, page=params.page, page_size=params.page_size, total=total
    )


@router.post(
    "/submissions/{submission_id}/grade",
    summary="Grade submission (teacher)",
    description=(
        "Score and provide Markdown feedback for a student's submission. "
        "Score must not exceed the assignment's max_score. "
        "A notification is sent to the student on grading."
    ),
)
async def grade_submission(
    submission_id: uuid.UUID,
    body: GradeSubmissionRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Grade a student submission."""
    svc = SubmissionService(db, teacher)
    data = await svc.grade(submission_id, body)
    await db.commit()
    return success_response(data, message="Submission graded.")


# ===========================================================================
# Student — Assignment Listing
# ===========================================================================


@router.get(
    "/{course_id}/me",
    summary="List assignments with my submissions (student)",
    description=(
        "Returns published assignments for a course, each augmented with "
        "the student's own submission (if any). Student must be enrolled."
    ),
)
async def list_assignments_student(
    course_id: uuid.UUID,
    params: AssignmentListParams = Depends(),
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """List published assignments with submission status."""
    svc = StudentAssignmentService(db, student)
    assignments, total = await svc.list_assignments(
        course_id,
        page=params.page,
        page_size=params.page_size,
    )
    return paginated_response(
        assignments, page=params.page, page_size=params.page_size, total=total
    )


# ===========================================================================
# Student — Submission Flows
# ===========================================================================


@router.post(
    "/{assignment_id}/submit/text",
    summary="Submit text response (student)",
    description=(
        "Submit an inline text answer to a published assignment. "
        "One submission per student per assignment is enforced."
    ),
    status_code=201,
)
async def submit_text(
    assignment_id: uuid.UUID,
    body: SubmitTextRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Submit a text response."""
    svc = SubmissionService(db, student)
    data = await svc.submit_text(assignment_id, body)
    await db.commit()
    return success_response(data, status_code=201)


@router.post(
    "/{assignment_id}/submit/file-initiate",
    summary="Initiate file submission (student)",
    description=(
        "Get a presigned R2 PUT URL for uploading a submission file. "
        "Supports PDF, images, ZIP, text, and Office documents up to 50 MB."
    ),
)
async def initiate_file_submission(
    assignment_id: uuid.UUID,
    body: InitiateFileSubmissionRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Get a presigned upload URL for a file submission."""
    svc = SubmissionService(db, student)
    data = await svc.initiate_file_submission(body)
    return success_response(data)


@router.post(
    "/{assignment_id}/submit/file-confirm",
    summary="Confirm file submission (student)",
    description=(
        "Confirm that a file has been uploaded to R2 and create the submission record. "
        "Verifies the object exists in R2 before committing."
    ),
    status_code=201,
)
async def confirm_file_submission(
    assignment_id: uuid.UUID,
    body: ConfirmFileSubmissionRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Confirm file upload and create submission."""
    svc = SubmissionService(db, student)
    data = await svc.confirm_file_submission(body)
    await db.commit()
    return success_response(data, status_code=201)


@router.get(
    "/{assignment_id}/my-submission",
    summary="My submission status (student)",
    description="Return the current student's submission for an assignment, or null if not submitted.",
)
async def get_my_submission(
    assignment_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return the student's submission."""
    svc = SubmissionService(db, student)
    data = await svc.get_my_submission(assignment_id)
    return success_response(data)
