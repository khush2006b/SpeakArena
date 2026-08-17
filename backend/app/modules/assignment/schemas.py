"""Assignment module — Pydantic schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Query
from pydantic import BaseModel, Field


# ===========================================================================
# Teacher — Assignment Management
# ===========================================================================


class CreateAssignmentRequest(BaseModel):
    """Request body for creating an assignment."""

    course_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(
        default=None,
        max_length=10000,
        description="Markdown-formatted assignment instructions.",
    )
    due_at: Optional[datetime] = Field(
        default=None, description="Assignment deadline (UTC). NULL = no deadline."
    )
    max_score: int = Field(default=100, ge=1, le=1000)
    allow_late_submission: bool = Field(default=True)


class UpdateAssignmentRequest(BaseModel):
    """Request body for partial update of an assignment."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    due_at: Optional[datetime] = Field(default=None)
    max_score: Optional[int] = Field(default=None, ge=1, le=1000)
    allow_late_submission: Optional[bool] = Field(default=None)


class GradeSubmissionRequest(BaseModel):
    """Request body for grading a student submission."""

    score: int = Field(..., ge=0, description="Score awarded. Must not exceed max_score.")
    feedback: Optional[str] = Field(
        default=None, max_length=5000, description="Markdown feedback for the student."
    )


# ===========================================================================
# Student — Submission
# ===========================================================================


class SubmitTextRequest(BaseModel):
    """Request body for a text-based assignment submission."""

    text_response: str = Field(..., min_length=1, max_length=50000)


class InitiateFileSubmissionRequest(BaseModel):
    """Request body to get a presigned R2 PUT URL for file submission."""

    assignment_id: uuid.UUID
    file_name: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., description="MIME type of the submission file.")
    file_size_bytes: int = Field(..., gt=0, le=52428800)  # 50 MB max


class ConfirmFileSubmissionRequest(BaseModel):
    """Request body to confirm a file submission landed in R2."""

    assignment_id: uuid.UUID
    r2_object_key: str = Field(..., min_length=1, max_length=512)
    file_size_bytes: Optional[int] = Field(default=None)


# ===========================================================================
# Response Schemas
# ===========================================================================


class AssignmentResponse(BaseModel):
    """Assignment metadata response."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    max_score: int
    is_published: bool
    allow_late_submission: bool
    submission_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    """Assignment submission response."""

    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    r2_object_key: Optional[str] = None
    text_response: Optional[str] = None
    score: Optional[int] = None
    feedback: Optional[str] = None
    is_late: bool
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FileSubmissionPresignResponse(BaseModel):
    """Presigned upload URL for a file submission."""

    upload_url: str
    r2_key: str
    expires_in_seconds: int
    method: str = "PUT"


# ===========================================================================
# Query Parameter Classes
# ===========================================================================


class AssignmentListParams:
    """Query parameters for listing assignments."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        published_only: bool = Query(default=False),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.published_only = published_only


class SubmissionListParams:
    """Query parameters for listing submissions (teacher view)."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        graded_only: bool = Query(default=False),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.graded_only = graded_only
