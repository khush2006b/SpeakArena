"""Chat module — Pydantic schemas.

All request bodies, response models, and query parameter classes
for the chat API.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Query
from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Request Schemas
# ===========================================================================


class SendMessageRequest(BaseModel):
    """Request body for sending a new chat message."""

    content: str = Field(..., min_length=1, max_length=4000)
    content_type: str = Field(default="text")
    reply_to_id: Optional[uuid.UUID] = Field(
        default=None,
        description="UUID of the message being replied to.",
    )
    recipient_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional recipient user UUID for 1-on-1 direct messages.",
    )
    room_id: Optional[uuid.UUID] = Field(default=None)
    room_type: Optional[str] = Field(default=None)
    is_announcement: Optional[bool] = Field(default=False)
    attachments: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of {r2_key, file_name, mime_type, size_bytes}.",
        max_length=5,
    )

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        """Validate content type is a supported value."""
        allowed = {"text", "image", "file", "video", "audio"}
        if v not in allowed:
            raise ValueError(f"content_type must be one of: {allowed}")
        return v


class EditMessageRequest(BaseModel):
    """Request body for editing an existing message."""

    content: str = Field(..., min_length=1, max_length=4000)


class ReactRequest(BaseModel):
    """Request body for adding or removing a reaction."""

    emoji: str = Field(..., min_length=1, max_length=10)


class CreateAnnouncementRequest(BaseModel):
    """Request body for a teacher-only announcement."""

    content: str = Field(..., min_length=1, max_length=4000)
    pin: bool = Field(
        default=True,
        description="If true, the announcement is also pinned to the room header.",
    )


class UpdateRoomSettingsRequest(BaseModel):
    """Request body for updating chat room settings (teacher-only)."""

    name: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    slow_mode_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    is_active: Optional[bool] = Field(default=None)


class AttachmentPresignRequest(BaseModel):
    """Request body for getting a presigned R2 upload URL for an attachment."""

    file_name: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., min_length=1, max_length=100)
    size_bytes: int = Field(..., gt=0, le=52428800)  # 50 MB max


# ===========================================================================
# Response Schemas
# ===========================================================================


class SenderInfo(BaseModel):
    """Lightweight sender identity for message rendering."""

    id: uuid.UUID
    full_name: str
    avatar_r2_key: Optional[str] = None
    role: str

    model_config = {"from_attributes": True}


class ReplyPreview(BaseModel):
    """Compact preview of the message being replied to."""

    id: uuid.UUID
    content: str
    sender_name: str


class MessageResponse(BaseModel):
    """Full message payload for list and detail views."""

    id: uuid.UUID
    chat_room_id: uuid.UUID
    sender: SenderInfo
    recipient_id: Optional[uuid.UUID] = None  # Set for 1-on-1 DMs; None for public messages
    content: str
    content_type: str
    reply_to: Optional[ReplyPreview] = None
    reply_count: int
    is_pinned: bool
    pinned_at: Optional[datetime] = None
    is_announcement: bool
    is_edited: bool
    edited_at: Optional[datetime] = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    reactions: dict[str, list[str]] = Field(default_factory=dict)
    is_deleted: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None


class ChatRoomResponse(BaseModel):
    """Chat room detail payload."""

    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    slow_mode_seconds: int
    pinned_message: Optional[MessageResponse] = None
    created_at: datetime


class AttachmentPresignResponse(BaseModel):
    """Presigned upload URL for a chat attachment."""

    upload_url: str
    r2_key: str
    expires_in_seconds: int


# ===========================================================================
# Query Parameter Classes
# ===========================================================================


class MessageListParams:
    """Query parameters for listing chat messages (cursor-based pagination)."""

    def __init__(
        self,
        before: Optional[datetime] = Query(
            default=None,
            description="Return messages created before this UTC timestamp (cursor).",
        ),
        limit: int = Query(default=50, ge=1, le=100),
        announcements_only: bool = Query(default=False),
        recipient_id: Optional[uuid.UUID] = Query(default=None),
        public_only: bool = Query(default=False),
        dm_student_id: Optional[uuid.UUID] = Query(default=None),
        room_type: Optional[str] = Query(default=None),
        room_id: Optional[uuid.UUID] = Query(default=None),
    ) -> None:
        self.before = before
        self.limit = limit
        self.announcements_only = announcements_only
        self.recipient_id = recipient_id
        self.public_only = public_only
        self.dm_student_id = dm_student_id
        self.room_type = room_type
        self.room_id = room_id

