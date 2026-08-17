"""Student profile router.

Mounts at /api/v1/profile — provides student profile read, update,
avatar upload presign, and password change.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.response import success_response
from app.database import get_db_session
from app.models.user import User
from app.modules.student.dependencies import get_current_student
from app.modules.student.schemas import (
    PresignUploadRequest,
    UpdatePasswordRequest,
    UpdateProfileRequest,
)
from app.modules.student.service import ProfileService

router = APIRouter(prefix="/profile", tags=["Student - Profile"])


@router.get(
    "",
    summary="Get student profile",
    description="Returns the student's profile including bio, stats, and preferences.",
)
async def get_profile(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Return the student's own profile."""
    svc = ProfileService(db, student)
    data = await svc.get_profile()
    return success_response(data)


@router.patch(
    "",
    summary="Update student profile",
    description="Partial update of student profile fields. All fields are optional.",
)
async def update_profile(
    body: UpdateProfileRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Update the student's profile."""
    svc = ProfileService(db, student)
    data = await svc.update_profile(body)
    await db.commit()
    return success_response(data, message="Profile updated successfully.")


@router.post(
    "/avatar",
    summary="Get avatar upload URL",
    description=(
        "Generates a presigned R2 PUT URL for uploading a profile avatar image. "
        "Upload the image directly to R2 using the returned upload_url."
    ),
)
async def get_avatar_upload_url(
    body: PresignUploadRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Generate a presigned URL for avatar upload."""
    svc = ProfileService(db, student)
    result = await svc.get_avatar_presign_url(body.content_type, body.file_name)
    await db.commit()
    return success_response(result)


@router.post(
    "/change-password",
    summary="Change password",
    description=(
        "Verify the current password and set a new Argon2id hash. "
        "Requires the correct current password. Logs the change in the audit trail."
    ),
)
async def change_password(
    body: UpdatePasswordRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Change the student's password."""
    svc = ProfileService(db, student)
    await svc.change_password(body)
    await db.commit()
    return success_response(message="Password updated successfully.")
