"""Pydantic schemas for the Tests & Grading system."""

from datetime import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CreateTestRequest(BaseModel):
    course_id: uuid.UUID
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    google_form_url: str = Field(..., max_length=512)
    start_time: datetime
    end_time: datetime
    max_score: float = Field(default=100.0, gt=0)

    model_config = ConfigDict(populate_by_name=True)


class UpdateTestRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    google_form_url: Optional[str] = Field(default=None, max_length=512)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_score: Optional[float] = Field(default=None, gt=0)

    model_config = ConfigDict(populate_by_name=True)


class GradeStudentItem(BaseModel):
    student_id: uuid.UUID
    score: float = Field(..., ge=0)
    feedback: Optional[str] = Field(default=None, max_length=1000)


class BulkGradeRequest(BaseModel):
    grades: list[GradeStudentItem]


class TestGradeResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    score: float
    feedback: Optional[str] = None
    graded_at: str


class TeacherTestResponse(BaseModel):
    id: str
    course_id: str
    course_title: str
    title: str
    description: Optional[str] = None
    google_form_url: str
    start_time: str
    end_time: str
    max_score: float
    is_open: bool
    status: str  # "UPCOMING" | "OPEN" | "CLOSED"
    grades: list[TestGradeResponse] = []


class StudentTestResponse(BaseModel):
    id: str
    course_id: str
    course_title: str
    title: str
    description: Optional[str] = None
    google_form_url: Optional[str] = None  # Delivered ONLY if is_open is True!
    start_time: str
    end_time: str
    max_score: float
    is_open: bool
    status: str  # "UPCOMING" | "OPEN" | "CLOSED"
    score: Optional[float] = None
    feedback: Optional[str] = None
    is_graded: bool = False
