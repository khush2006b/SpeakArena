"""
API tests — Chat module (comprehensive)
GET    /api/v1/chat/{course_id}                           Room detail (student enrolled OR teacher)
PATCH  /api/v1/chat/{course_id}/settings                  Update room settings (teacher only)
GET    /api/v1/chat/{course_id}/messages                  List messages (cursor-based)
POST   /api/v1/chat/{course_id}/messages                  Send message (201)
PATCH  /api/v1/chat/{course_id}/messages/{id}             Edit message (sender or teacher)
DELETE /api/v1/chat/{course_id}/messages/{id}             Delete message (204, sender or teacher)
POST   /api/v1/chat/{course_id}/messages/{id}/pin         Pin message (teacher only)
DELETE /api/v1/chat/{course_id}/messages/{id}/pin         Unpin (teacher only, 204)
POST   /api/v1/chat/{course_id}/messages/{id}/react       Add emoji reaction
DELETE /api/v1/chat/{course_id}/messages/{id}/react       Remove reaction (204)
POST   /api/v1/chat/{course_id}/announcements             Create announcement (teacher only, 201)
DELETE /api/v1/chat/{course_id}/messages/{id}/moderate    Force-delete any message (teacher only, 204)
POST   /api/v1/chat/{course_id}/attachments/presign       Get R2 presigned upload URL
GET    /api/v1/chat/{course_id}/search                    Full-text search
GET    /api/v1/chat/{course_id}/analytics/summary         Chat analytics (teacher only)

Coverage: Success · 401 · 403 · 422 · Slow-mode 429 · Unsupported MIME · Cursor pagination
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

CHAT_BASE = "/api/v1/chat"
SAMPLE_COURSE_ID = str(uuid.uuid4())
SAMPLE_MSG_ID = str(uuid.uuid4())


@pytest.mark.api
class TestGetChatRoom:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(f"{CHAT_BASE}/not-a-uuid", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_enrolled_student_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class EnrollmentRequiredError(AppError):
            status_code = 403
            error_code = "NotEnrolled"
            message = "You must be enrolled."

        with patch("app.modules.chat.service.ChatRoomService.get_room", new_callable=AsyncMock) as m:
            m.side_effect = EnrollmentRequiredError()
            resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}", headers=student_auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_enrolled_student_gets_room(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ChatRoomService.get_room", new_callable=AsyncMock) as m:
            m.return_value = {"id": str(uuid.uuid4()), "is_active": True, "slow_mode_seconds": 0}
            resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}", headers=student_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_teacher_unrestricted_access(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ChatRoomService.get_room", new_callable=AsyncMock) as m:
            m.return_value = {"id": str(uuid.uuid4()), "course_id": SAMPLE_COURSE_ID}
            resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}", headers=teacher_auth_headers)
        assert resp.status_code == 200


@pytest.mark.api
class TestUpdateRoomSettings:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.patch(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/settings", json={"slow_mode_seconds": 30})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_student_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.patch(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/settings", json={"slow_mode_seconds": 30}, headers=student_auth_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_updates_successfully(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ChatRoomService.update_settings", new_callable=AsyncMock) as m:
            m.return_value = {"slow_mode_seconds": 30}
            resp = await client.patch(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/settings", json={"slow_mode_seconds": 30}, headers=teacher_auth_headers
            )
        assert resp.status_code == 200


@pytest.mark.api
class TestListMessages:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_cursor_pagination_via_before_param(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        cursor_id = str(uuid.uuid4())
        with patch("app.modules.chat.service.MessageService.list_messages", new_callable=AsyncMock) as m:
            m.return_value = []
            resp = await client.get(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages?before={cursor_id}&limit=25",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_limit_out_of_range_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages?limit=0", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_announcements_only_filter(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.list_messages", new_callable=AsyncMock) as m:
            m.return_value = []
            resp = await client.get(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages?announcements_only=true", headers=teacher_auth_headers
            )
        assert resp.status_code == 200


@pytest.mark.api
class TestSendMessage:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages", json={"content": "Hi"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_content_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages", json={"content": ""}, headers=student_auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_student_sends_message_returns_201(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.send_message", new_callable=AsyncMock) as m:
            m.return_value = {"id": str(uuid.uuid4()), "content": "Hello!", "content_type": "text"}
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages",
                json={"content": "Hello!", "content_type": "text"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 201
        assert resp.json()["data"]["content"] == "Hello!"

    @pytest.mark.asyncio
    async def test_slow_mode_returns_429(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class SlowModeError(AppError):
            status_code = 429
            error_code = "SlowMode"
            message = "Wait before sending another message."

        with patch("app.modules.chat.service.MessageService.send_message", new_callable=AsyncMock) as m:
            m.side_effect = SlowModeError()
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages", json={"content": "Spam"}, headers=student_auth_headers
            )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_invalid_content_type_enum_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages",
            json={"content": "test", "content_type": "binary"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 422


@pytest.mark.api
class TestEditMessage:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.patch(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}", json={"content": "edit"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_non_owner_student_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class ForbiddenError(AppError):
            status_code = 403
            error_code = "NotMessageOwner"
            message = "You can only edit your own messages."

        with patch("app.modules.chat.service.MessageService.edit_message", new_callable=AsyncMock) as m:
            m.side_effect = ForbiddenError()
            resp = await client.patch(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}",
                json={"content": "hacked!"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_sender_edits_own_message_returns_200(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.edit_message", new_callable=AsyncMock) as m:
            m.return_value = {"id": SAMPLE_MSG_ID, "content": "Edited!"}
            resp = await client.patch(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}",
                json={"content": "Edited!"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_teacher_can_edit_any_message(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.edit_message", new_callable=AsyncMock) as m:
            m.return_value = {"id": SAMPLE_MSG_ID, "content": "Teacher edit"}
            resp = await client.patch(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}",
                json={"content": "Teacher edit"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200


@pytest.mark.api
class TestDeleteMessage:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.delete(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_sender_deletes_own_message_returns_204(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.delete_message", new_callable=AsyncMock):
            resp = await client.delete(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}", headers=student_auth_headers
            )
        assert resp.status_code == 204
        assert resp.content == b""

    @pytest.mark.asyncio
    async def test_non_owner_student_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class ForbiddenError(AppError):
            status_code = 403
            error_code = "NotMessageOwner"
            message = "Cannot delete other's message."

        with patch("app.modules.chat.service.MessageService.delete_message", new_callable=AsyncMock) as m:
            m.side_effect = ForbiddenError()
            resp = await client.delete(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}", headers=student_auth_headers
            )
        assert resp.status_code == 403


@pytest.mark.api
class TestPinMessage:
    @pytest.mark.asyncio
    async def test_student_cannot_pin_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/pin", headers=student_auth_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_pins_message_returns_200(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ModerationService.pin_message", new_callable=AsyncMock) as m:
            m.return_value = {"id": SAMPLE_MSG_ID, "is_pinned": True}
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/pin", headers=teacher_auth_headers
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_teacher_unpins_returns_204(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ModerationService.unpin_message", new_callable=AsyncMock):
            resp = await client.delete(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/pin", headers=teacher_auth_headers
            )
        assert resp.status_code == 204


@pytest.mark.api
class TestReactions:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/react", json={"emoji": "👍"}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_add_reaction_returns_200_or_201(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.add_reaction", new_callable=AsyncMock) as m:
            m.return_value = {"emoji": "👍", "count": 1}
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/react",
                json={"emoji": "👍"},
                headers=student_auth_headers,
            )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_missing_emoji_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/react", json={}, headers=student_auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_remove_reaction_returns_204(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.remove_reaction", new_callable=AsyncMock):
            resp = await client.delete(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/react",
                json={"emoji": "👍"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 204


@pytest.mark.api
class TestAnnouncements:
    @pytest.mark.asyncio
    async def test_student_cannot_post_announcement_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/announcements",
            json={"content": "Class cancelled!"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_empty_content_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/announcements", json={}, headers=teacher_auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_teacher_creates_announcement_returns_201(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.send_message", new_callable=AsyncMock) as m:
            m.return_value = {"id": str(uuid.uuid4()), "content": "Exam moved.", "is_announcement": True}
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/announcements",
                json={"content": "Exam moved."},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 201


@pytest.mark.api
class TestModerateMessage:
    @pytest.mark.asyncio
    async def test_student_cannot_moderate_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.delete(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/moderate", headers=student_auth_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_force_deletes_any_message_returns_204(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ModerationService.moderate_message", new_callable=AsyncMock):
            resp = await client.delete(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/messages/{SAMPLE_MSG_ID}/moderate", headers=teacher_auth_headers
            )
        assert resp.status_code == 204


@pytest.mark.api
class TestAttachmentPresign:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/attachments/presign",
            json={"file_name": "photo.png", "content_type": "image/png"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_unsupported_mime_type_returns_400_or_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class UnsupportedMimeType(AppError):
            status_code = 400
            error_code = "UnsupportedMimeType"
            message = "File type not allowed."

        with patch("app.modules.chat.service.ChatRoomService.get_attachment_presign_url", new_callable=AsyncMock) as m:
            m.side_effect = UnsupportedMimeType()
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/attachments/presign",
                json={"file_name": "virus.exe", "content_type": "application/x-msdownload"},
                headers=student_auth_headers,
            )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_valid_mime_type_returns_presigned_url(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ChatRoomService.get_attachment_presign_url", new_callable=AsyncMock) as m:
            m.return_value = {"upload_url": "https://r2.example.com/presigned", "object_key": "chat/photo.png"}
            resp = await client.post(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/attachments/presign",
                json={"file_name": "photo.png", "content_type": "image/png"},
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert "upload_url" in resp.json()["data"]


@pytest.mark.api
class TestChatSearch:
    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/search?q=exam")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_results(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.MessageService.search_messages", new_callable=AsyncMock) as m:
            m.return_value = []
            resp = await client.get(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/search?q=exam", headers=student_auth_headers
            )
        assert resp.status_code == 200


@pytest.mark.api
class TestChatAnalytics:
    @pytest.mark.asyncio
    async def test_student_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/analytics/summary", headers=student_auth_headers
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_gets_analytics(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        with patch("app.modules.chat.service.ChatRoomService.get_analytics", new_callable=AsyncMock) as m:
            m.return_value = {"total_messages": 1240, "active_users": 35}
            resp = await client.get(
                f"{CHAT_BASE}/{SAMPLE_COURSE_ID}/analytics/summary", headers=teacher_auth_headers
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["total_messages"] == 1240
