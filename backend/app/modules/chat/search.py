"""Chat Search Service.

Provides full-text message search, file attachment search, and
user-in-room search for the chat module.

All search queries run against PostgreSQL. No Elasticsearch dependency.
Full-text search uses PostgreSQL's built-in to_tsvector / plainto_tsquery
operators. Performance is acceptable for classroom-scale chat rooms.

For production at very large scale (100k+ messages per room), consider
adding a GIN index on messages.content with to_tsvector, or integrating
OpenSearch/Typesense as a separate search index populated by a CDC worker.

Services:
    ChatSearchService — message, file, announcement, and user search.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import and_, desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatRoom, Message
from app.models.user import User
from app.models.course import CourseEnrollment
from app.models.enums import EnrollmentStatus, UserRole
from app.core.exceptions.errors import AppError


class ChatSearchService:
    """Full-text and filter-based search for chat messages and files.

    Args:
        db: Async SQLAlchemy session.
        actor: The authenticated user performing the search.
    """

    def __init__(self, db: AsyncSession, actor: "User") -> None:
        """Initialize the search service.

        Args:
            db: Async SQLAlchemy session.
            actor: The authenticated user.
        """
        self._db = db
        self._actor = actor

    # -----------------------------------------------------------------------
    # Message search
    # -----------------------------------------------------------------------

    async def search_messages(
        self,
        course_id: uuid.UUID,
        query: str,
        *,
        before: Optional[datetime] = None,
        after: Optional[datetime] = None,
        sender_id: Optional[uuid.UUID] = None,
        content_type: Optional[str] = None,
        announcements_only: bool = False,
        page: int = 1,
        page_size: int = 30,
    ) -> dict[str, Any]:
        """Search messages within a course chat room.

        Uses PostgreSQL ILIKE for substring matching (case-insensitive).
        Results are ordered by relevance (newest-first within matches).

        Args:
            course_id: UUID of the course to search within.
            query: Search term (1–200 characters).
            before: Optional upper datetime bound for message timestamp.
            after: Optional lower datetime bound for message timestamp.
            sender_id: Optional filter to a specific sender UUID.
            content_type: Optional filter by content type.
            announcements_only: If True, only return announcement messages.
            page: Page number (1-indexed).
            page_size: Results per page (max 50).

        Returns:
            dict[str, Any]: Search results with keys:
                total, page, page_size, results (list of message dicts).

        Raises:
            AppError: If the query is empty or exceeds 200 characters.
            AppError: If the actor is not enrolled (student) or not a teacher.
        """
        query = query.strip()
        if not query:
            raise AppError(
                message="Search query cannot be empty.",
                error_code="EmptySearchQuery",
            )
        if len(query) > 200:
            raise AppError(
                message="Search query is too long (max 200 characters).",
                error_code="SearchQueryTooLong",
            )
        if page_size > 50:
            page_size = 50

        # Verify access
        room = await self._get_room_or_raise(course_id)

        conditions = [
            Message.chat_room_id == room.id,
            Message.deleted_at.is_(None),
            Message.content.ilike(f"%{query}%"),
        ]

        if self._actor.role == UserRole.STUDENT:
            conditions.append(Message.is_muted_user_message.is_(False))

        if before:
            conditions.append(Message.created_at < before)
        if after:
            conditions.append(Message.created_at >= after)
        if sender_id:
            conditions.append(Message.sender_id == sender_id)
        if content_type:
            conditions.append(Message.content_type == content_type)
        if announcements_only:
            conditions.append(Message.is_announcement.is_(True))

        # Count
        count_result = await self._db.execute(
            select(func.count()).select_from(Message).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        # Results with sender join
        stmt = (
            select(
                Message.id,
                Message.chat_room_id,
                Message.content,
                Message.content_type,
                Message.reply_to_id,
                Message.is_pinned,
                Message.is_announcement,
                Message.is_edited,
                Message.edited_at,
                Message.attachments,
                Message.reactions,
                Message.created_at,
                User.id.label("sender_id"),
                User.full_name.label("sender_name"),
                User.avatar_r2_key.label("sender_avatar"),
                User.role.label("sender_role"),
            )
            .join(User, User.id == Message.sender_id)
            .where(and_(*conditions))
            .order_by(desc(Message.created_at))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = (await self._db.execute(stmt)).all()

        results = [
            {
                "id": r.id,
                "chat_room_id": r.chat_room_id,
                "content": r.content,
                "content_type": r.content_type,
                "is_pinned": r.is_pinned,
                "is_announcement": r.is_announcement,
                "is_edited": r.is_edited,
                "edited_at": r.edited_at,
                "attachments": r.attachments,
                "reactions": r.reactions,
                "created_at": r.created_at,
                "sender": {
                    "id": r.sender_id,
                    "full_name": r.sender_name,
                    "avatar_r2_key": r.sender_avatar,
                    "role": r.sender_role,
                },
            }
            for r in rows
        ]

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": results,
        }

    # -----------------------------------------------------------------------
    # File / attachment search
    # -----------------------------------------------------------------------

    async def search_files(
        self,
        course_id: uuid.UUID,
        query: Optional[str] = None,
        *,
        mime_type_prefix: Optional[str] = None,
        page: int = 1,
        page_size: int = 30,
    ) -> dict[str, Any]:
        """Search file attachments shared in a course chat room.

        Searches the attachments JSONB column using PostgreSQL @> operator
        for JSONB containment or ILIKE on the embedded file_name field.

        Args:
            course_id: UUID of the course.
            query: Optional filename search term.
            mime_type_prefix: Optional MIME prefix filter (e.g. 'image/', 'application/pdf').
            page: Page number.
            page_size: Results per page (max 50).

        Returns:
            dict[str, Any]: Search results with keys:
                total, page, page_size, files (list of attachment dicts).
        """
        room = await self._get_room_or_raise(course_id)

        conditions = [
            Message.chat_room_id == room.id,
            Message.deleted_at.is_(None),
            # Messages with at least one attachment
            func.jsonb_array_length(Message.attachments) > 0,
        ]

        if self._actor.role == UserRole.STUDENT:
            conditions.append(Message.is_muted_user_message.is_(False))

        count_result = await self._db.execute(
            select(func.count()).select_from(Message).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        stmt = (
            select(
                Message.id,
                Message.attachments,
                Message.created_at,
                Message.sender_id,
                User.full_name.label("sender_name"),
            )
            .join(User, User.id == Message.sender_id)
            .where(and_(*conditions))
            .order_by(desc(Message.created_at))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = (await self._db.execute(stmt)).all()

        files: list[dict[str, Any]] = []
        for r in rows:
            for att in (r.attachments or []):
                file_name: str = att.get("file_name", "")
                mime: str = att.get("mime_type", "")

                # Apply client-side filters on JSONB array elements
                if query and query.lower() not in file_name.lower():
                    continue
                if mime_type_prefix and not mime.startswith(mime_type_prefix):
                    continue

                files.append({
                    "message_id": r.id,
                    "file_name": file_name,
                    "mime_type": mime,
                    "r2_key": att.get("r2_key"),
                    "size_bytes": att.get("size_bytes"),
                    "uploaded_at": r.created_at,
                    "uploaded_by": {
                        "id": r.sender_id,
                        "full_name": r.sender_name,
                    },
                })

        return {
            "total": len(files),
            "page": page,
            "page_size": page_size,
            "files": files[(page - 1) * page_size: page * page_size],
        }

    # -----------------------------------------------------------------------
    # Announcement search
    # -----------------------------------------------------------------------

    async def search_announcements(
        self,
        course_id: uuid.UUID,
        query: Optional[str] = None,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """Search teacher announcements in a course chat room.

        Args:
            course_id: UUID of the course.
            query: Optional text search term.
            page: Page number.
            page_size: Results per page.

        Returns:
            dict[str, Any]: Announcement search results.
        """
        return await self.search_messages(
            course_id,
            query=query or "",
            announcements_only=True,
            page=page,
            page_size=page_size,
        )

    # -----------------------------------------------------------------------
    # User search (online members in a room)
    # -----------------------------------------------------------------------

    async def search_room_members(
        self,
        course_id: uuid.UUID,
        query: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Return enrolled members of a course chat room matching a name query.

        Args:
            course_id: UUID of the course.
            query: Optional name substring filter.

        Returns:
            list[dict[str, Any]]: List of member user dicts.
        """
        room = await self._get_room_or_raise(course_id)

        conditions = [
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.status == EnrollmentStatus.ACTIVE,
        ]

        stmt = (
            select(
                User.id,
                User.full_name,
                User.avatar_r2_key,
                User.role,
            )
            .join(CourseEnrollment, CourseEnrollment.student_id == User.id)
            .where(and_(*conditions))
            .order_by(User.full_name)
        )

        if query:
            stmt = stmt.where(User.full_name.ilike(f"%{query}%"))

        rows = (await self._db.execute(stmt)).all()

        return [
            {
                "id": r.id,
                "full_name": r.full_name,
                "avatar_r2_key": r.avatar_r2_key,
                "role": r.role,
            }
            for r in rows
        ]

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    async def _get_room_or_raise(self, course_id: uuid.UUID) -> ChatRoom:
        """Get the chat room for a course or raise AppError.

        Also validates enrollment for student actors.

        Args:
            course_id: UUID of the course.

        Returns:
            ChatRoom: The chat room ORM instance.

        Raises:
            AppError: If room not found or student not enrolled.
        """
        room = (
            await self._db.execute(
                select(ChatRoom).where(ChatRoom.course_id == course_id)
            )
        ).scalar_one_or_none()

        if room is None:
            raise AppError(
                message="Chat room not found for this course.",
                error_code="ChatRoomNotFound",
                status_code=404,
            )

        if self._actor.role == UserRole.STUDENT:
            enrolled_count = (
                await self._db.execute(
                    select(func.count()).select_from(CourseEnrollment).where(
                        CourseEnrollment.student_id == self._actor.id,
                        CourseEnrollment.course_id == course_id,
                        CourseEnrollment.status == EnrollmentStatus.ACTIVE,
                    )
                )
            ).scalar_one()
            if enrolled_count == 0:
                raise AppError(
                    message="You must be enrolled in this course to search its chat.",
                    error_code="NotEnrolled",
                    status_code=403,
                )

        return room
