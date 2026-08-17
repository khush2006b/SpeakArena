"""
Tests for Media Upload (Cloudflare R2) and Notification APIs.
"""
import pytest
from unittest.mock import AsyncMock, patch

pytestmark = [pytest.mark.api, pytest.mark.asyncio]


class TestVideoUploadAPI:
    """Tests for Video Upload endpoints."""

    async def test_initiate_upload_success(self, client, teacher_auth_headers):
        payload = {"filename": "lecture.mp4", "content_type": "video/mp4", "course_id": 1}
        with patch("app.modules.resource.service.video_service.initiate_upload", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"upload_url": "https://presigned.url", "video_id": 123}
            response = await client.post("/api/v1/videos/initiate-upload", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 201
            assert "upload_url" in response.json()

    async def test_initiate_upload_unauthorized(self, client):
        payload = {"filename": "lecture.mp4", "content_type": "video/mp4", "course_id": 1}
        response = await client.post("/api/v1/videos/initiate-upload", json=payload)
        assert response.status_code == 401

    async def test_initiate_upload_forbidden(self, client, student_auth_headers):
        payload = {"filename": "lecture.mp4", "content_type": "video/mp4", "course_id": 1}
        response = await client.post("/api/v1/videos/initiate-upload", json=payload, headers=student_auth_headers)
        assert response.status_code == 403

    async def test_initiate_upload_invalid_mime(self, client, teacher_auth_headers):
        payload = {"filename": "notes.txt", "content_type": "text/plain", "course_id": 1}
        response = await client.post("/api/v1/videos/initiate-upload", json=payload, headers=teacher_auth_headers)
        assert response.status_code in [400, 422]

    async def test_confirm_upload_success(self, client, teacher_auth_headers):
        payload = {"video_id": 123}
        with patch("app.modules.resource.service.video_service.confirm_upload", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"status": "completed"}
            response = await client.post("/api/v1/videos/confirm-upload", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 200

    async def test_multipart_initiate_success(self, client, teacher_auth_headers):
        payload = {"filename": "big_lecture.mp4", "content_type": "video/mp4", "course_id": 1}
        with patch("app.modules.resource.service.video_service.multipart_initiate", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"upload_id": "up_123", "video_id": 456}
            response = await client.post("/api/v1/videos/multipart/initiate", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 201

    async def test_multipart_presign_parts_success(self, client, teacher_auth_headers):
        payload = {"part_numbers": [1, 2]}
        with patch("app.modules.resource.service.video_service.multipart_presign_parts", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"1": "url1", "2": "url2"}
            response = await client.post("/api/v1/videos/multipart/up_123/presign-parts", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 200

    async def test_multipart_complete_success(self, client, teacher_auth_headers):
        payload = {"parts": [{"part_number": 1, "etag": "etag1"}]}
        with patch("app.modules.resource.service.video_service.multipart_complete", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"status": "completed"}
            response = await client.post("/api/v1/videos/multipart/up_123/complete", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 200

    async def test_multipart_abort_success(self, client, teacher_auth_headers):
        with patch("app.modules.resource.service.video_service.multipart_abort", new_callable=AsyncMock) as mock_service:
            response = await client.delete("/api/v1/videos/multipart/up_123", headers=teacher_auth_headers)
            assert response.status_code == 204

    async def test_stream_video_success(self, client, student_auth_headers):
        with patch("app.modules.resource.service.video_service.get_stream_url", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"url": "https://stream.url"}
            response = await client.get("/api/v1/videos/1/123/stream", headers=student_auth_headers)
            assert response.status_code == 200

    async def test_stream_video_unenrolled(self, client, student_auth_headers):
        with patch("app.modules.resource.service.video_service.get_stream_url", new_callable=AsyncMock) as mock_service:
            # Simulate exception for unenrolled
            mock_service.side_effect = Exception("Not enrolled")
            # In a real app this would be handled by a dependency or custom exception handler returning 403
            response = await client.get("/api/v1/videos/99/123/stream", headers=student_auth_headers)
            # Assuming the app handles it correctly and returns 403
            assert response.status_code in [403, 400]

    async def test_video_progress_success(self, client, student_auth_headers):
        payload = {"watch_position_seconds": 120.5}
        with patch("app.modules.resource.service.video_service.update_progress", new_callable=AsyncMock) as mock_service:
            response = await client.post("/api/v1/videos/123/progress", json=payload, headers=student_auth_headers)
            assert response.status_code == 200

    async def test_video_progress_validation(self, client, student_auth_headers):
        payload = {"watch_position_seconds": -5}
        response = await client.post("/api/v1/videos/123/progress", json=payload, headers=student_auth_headers)
        assert response.status_code == 422

    async def test_recently_watched_success(self, client, student_auth_headers):
        with patch("app.modules.resource.service.video_service.get_recently_watched", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = []
            response = await client.get("/api/v1/videos/recently-watched", headers=student_auth_headers)
            assert response.status_code == 200


class TestPdfUploadAPI:
    """Tests for PDF Upload endpoints."""

    async def test_initiate_upload_success(self, client, teacher_auth_headers):
        payload = {"filename": "doc.pdf", "content_type": "application/pdf", "course_id": 1}
        with patch("app.modules.resource.service.pdf_service.initiate_upload", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"upload_url": "url", "pdf_id": 100}
            response = await client.post("/api/v1/pdfs/initiate-upload", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 201

    async def test_initiate_upload_invalid_mime(self, client, teacher_auth_headers):
        payload = {"filename": "doc.txt", "content_type": "text/plain", "course_id": 1}
        response = await client.post("/api/v1/pdfs/initiate-upload", json=payload, headers=teacher_auth_headers)
        assert response.status_code in [400, 422]

    async def test_confirm_upload_success(self, client, teacher_auth_headers):
        payload = {"pdf_id": 100}
        with patch("app.modules.resource.service.pdf_service.confirm_upload", new_callable=AsyncMock) as mock_service:
            response = await client.post("/api/v1/pdfs/confirm-upload", json=payload, headers=teacher_auth_headers)
            assert response.status_code == 200

    async def test_access_pdf_success(self, client, student_auth_headers):
        with patch("app.modules.resource.service.pdf_service.get_access_url", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"url": "https://access.url"}
            response = await client.get("/api/v1/pdfs/100/access", headers=student_auth_headers)
            assert response.status_code == 200

    async def test_delete_pdf_success(self, client, teacher_auth_headers):
        with patch("app.modules.resource.service.pdf_service.delete_pdf", new_callable=AsyncMock) as mock_service:
            response = await client.delete("/api/v1/pdfs/100", headers=teacher_auth_headers)
            assert response.status_code == 204


class TestStorageAPI:
    """Tests for Storage Stats endpoints."""

    async def test_get_storage_stats_success(self, client, teacher_auth_headers):
        with patch("app.modules.resource.service.storage_service.get_stats", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"total_bytes": 1024, "usage_percentage": 10.5}
            response = await client.get("/api/v1/storage/1/stats", headers=teacher_auth_headers)
            assert response.status_code == 200

    async def test_get_storage_stats_forbidden(self, client, student_auth_headers):
        response = await client.get("/api/v1/storage/1/stats", headers=student_auth_headers)
        assert response.status_code == 403


class TestNotificationsAPI:
    """Tests for Notifications endpoints."""

    async def test_get_notifications_success(self, client, student_auth_headers):
        with patch("app.modules.student.service.notification_service.get_notifications", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"items": [], "total": 0}
            response = await client.get("/api/v1/notifications?unread_only=true", headers=student_auth_headers)
            assert response.status_code == 200

    async def test_get_notifications_forbidden(self, client, teacher_auth_headers):
        response = await client.get("/api/v1/notifications", headers=teacher_auth_headers)
        assert response.status_code == 403

    async def test_get_unread_count_success(self, client, student_auth_headers):
        with patch("app.modules.student.service.notification_service.get_unread_count", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"unread_count": 5}
            response = await client.get("/api/v1/notifications/unread-count", headers=student_auth_headers)
            assert response.status_code == 200
            assert "unread_count" in response.json()

    async def test_mark_read_success(self, client, student_auth_headers):
        with patch("app.modules.student.service.notification_service.mark_as_read", new_callable=AsyncMock) as mock_service:
            response = await client.post("/api/v1/notifications/1/read", headers=student_auth_headers)
            assert response.status_code == 200

    async def test_mark_all_read_success(self, client, student_auth_headers):
        with patch("app.modules.student.service.notification_service.mark_all_as_read", new_callable=AsyncMock) as mock_service:
            mock_service.return_value = {"marked_count": 10}
            response = await client.post("/api/v1/notifications/read-all", headers=student_auth_headers)
            assert response.status_code == 200
            assert "marked_count" in response.json()

    async def test_delete_notification_success(self, client, student_auth_headers):
        with patch("app.modules.student.service.notification_service.delete_notification", new_callable=AsyncMock) as mock_service:
            response = await client.delete("/api/v1/notifications/1", headers=student_auth_headers)
            assert response.status_code == 204
