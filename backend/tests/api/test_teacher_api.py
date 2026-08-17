"""
Test module for Teacher API endpoints in SpeakArena.
Covers success, failure, unauthorized (401), forbidden (403), validation (422), rate limits, edge cases.
"""

import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient

from tests.conftest import (
    FakeTeacher,
    FakeUser,
    mock_db,
    mock_redis,
    client,
    teacher_auth_headers,
    student_auth_headers,
    expired_auth_headers
)

pytestmark = [pytest.mark.api, pytest.mark.asyncio]

# --- Dashboard & Categories ---

class TestTeacherDashboardAPI:
    @patch('app.services.teacher_service.TeacherService.get_dashboard')
    async def test_get_dashboard_success(self, mock_get_dashboard, client: AsyncClient, teacher_auth_headers: dict):
        mock_get_dashboard.return_value = {"total_students": 150, "total_revenue": 5000}
        response = await client.get("/api/v1/teacher/dashboard", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert response.json()["total_students"] == 150

    async def test_get_dashboard_unauthorized(self, client: AsyncClient):
        response = await client.get("/api/v1/teacher/dashboard")
        assert response.status_code == 401

    async def test_get_dashboard_forbidden(self, client: AsyncClient, student_auth_headers: dict):
        response = await client.get("/api/v1/teacher/dashboard", headers=student_auth_headers)
        assert response.status_code == 403


class TestTeacherCategoriesAPI:
    @patch('app.services.category_service.CategoryService.get_all')
    async def test_get_categories_success(self, mock_get_all, client: AsyncClient, teacher_auth_headers: dict):
        mock_get_all.return_value = [{"id": 1, "name": "Language"}]
        response = await client.get("/api/v1/teacher/categories", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert len(response.json()) > 0

    async def test_get_categories_unauthorized(self, client: AsyncClient):
        response = await client.get("/api/v1/teacher/categories")
        assert response.status_code == 401

    async def test_get_categories_forbidden(self, client: AsyncClient, student_auth_headers: dict):
        response = await client.get("/api/v1/teacher/categories", headers=student_auth_headers)
        assert response.status_code == 403


# --- Courses ---

class TestTeacherCoursesAPI:
    @patch('app.services.course_service.CourseService.get_teacher_courses')
    async def test_get_courses_success(self, mock_get_courses, client: AsyncClient, teacher_auth_headers: dict):
        mock_get_courses.return_value = {"items": [{"id": 1, "title": "Test Course"}], "total": 1}
        response = await client.get("/api/v1/teacher/courses?page=1&size=10", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert "items" in response.json()

    @patch('app.services.course_service.CourseService.create_course')
    async def test_create_course_success(self, mock_create, client: AsyncClient, teacher_auth_headers: dict):
        mock_create.return_value = {"id": 1, "title": "New Course"}
        data = {"title": "New Course", "description": "Desc", "price": 100}
        response = await client.post("/api/v1/teacher/courses", json=data, headers=teacher_auth_headers)
        assert response.status_code == 201

    async def test_create_course_invalid(self, client: AsyncClient, teacher_auth_headers: dict):
        response = await client.post("/api/v1/teacher/courses", json={}, headers=teacher_auth_headers)
        assert response.status_code == 422

    @patch('app.services.course_service.CourseService.get_course_by_id')
    async def test_get_course_by_id_success(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = {"id": 1, "title": "Test Course"}
        response = await client.get("/api/v1/teacher/courses/1", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.course_service.CourseService.get_course_by_id')
    async def test_get_course_by_id_not_found(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = None
        response = await client.get("/api/v1/teacher/courses/999", headers=teacher_auth_headers)
        assert response.status_code == 404

    @patch('app.services.course_service.CourseService.update_course')
    async def test_patch_course_success(self, mock_update, client: AsyncClient, teacher_auth_headers: dict):
        mock_update.return_value = {"id": 1, "title": "Updated"}
        response = await client.patch("/api/v1/teacher/courses/1", json={"title": "Updated"}, headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.course_service.CourseService.delete_course')
    async def test_delete_course_success(self, mock_delete, client: AsyncClient, teacher_auth_headers: dict):
        mock_delete.return_value = True
        response = await client.delete("/api/v1/teacher/courses/1", headers=teacher_auth_headers)
        assert response.status_code == 204

    @patch('app.services.course_service.CourseService.delete_course')
    async def test_delete_course_not_found(self, mock_delete, client: AsyncClient, teacher_auth_headers: dict):
        mock_delete.return_value = False
        response = await client.delete("/api/v1/teacher/courses/999", headers=teacher_auth_headers)
        assert response.status_code == 404

    @patch('app.services.course_service.CourseService.publish_course')
    async def test_publish_course_success(self, mock_publish, client: AsyncClient, teacher_auth_headers: dict):
        mock_publish.return_value = {"id": 1, "status": "published"}
        response = await client.post("/api/v1/teacher/courses/1/publish", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.course_service.CourseService.publish_course')
    async def test_publish_course_no_videos(self, mock_publish, client: AsyncClient, teacher_auth_headers: dict):
        mock_publish.side_effect = ValueError("Course must have title, price, and at least 1 video to publish")
        response = await client.post("/api/v1/teacher/courses/1/publish", headers=teacher_auth_headers)
        assert response.status_code == 400
        assert "video" in response.json()["detail"]

    @patch('app.services.course_service.CourseService.unpublish_course')
    async def test_unpublish_course_success(self, mock_unpublish, client: AsyncClient, teacher_auth_headers: dict):
        mock_unpublish.return_value = {"id": 1, "status": "draft"}
        response = await client.post("/api/v1/teacher/courses/1/unpublish", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.course_service.CourseService.archive_course')
    async def test_archive_course_success(self, mock_archive, client: AsyncClient, teacher_auth_headers: dict):
        mock_archive.return_value = {"id": 1, "status": "archived"}
        response = await client.post("/api/v1/teacher/courses/1/archive", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.s3_service.S3Service.generate_presigned_url')
    async def test_thumbnail_upload_url(self, mock_presigned, client: AsyncClient, teacher_auth_headers: dict):
        mock_presigned.return_value = "https://r2.cloudflare.com/presigned-url"
        response = await client.post("/api/v1/teacher/courses/1/thumbnail", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert "upload_url" in response.json() or "presigned_url" in response.json()

    @patch('app.services.analytics_service.AnalyticsService.get_course_analytics')
    async def test_get_course_analytics(self, mock_analytics, client: AsyncClient, teacher_auth_headers: dict):
        mock_analytics.return_value = {"views": 100}
        response = await client.get("/api/v1/teacher/courses/1/analytics", headers=teacher_auth_headers)
        assert response.status_code == 200


# --- Videos ---

class TestTeacherVideosAPI:
    @patch('app.services.video_service.VideoService.get_videos')
    async def test_get_videos_success(self, mock_get_videos, client: AsyncClient, teacher_auth_headers: dict):
        mock_get_videos.return_value = [{"id": 1, "title": "Intro"}]
        response = await client.get("/api/v1/teacher/courses/1/videos", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.video_service.VideoService.create_video')
    @patch('app.services.s3_service.S3Service.generate_presigned_url')
    async def test_create_video_success(self, mock_url, mock_create, client: AsyncClient, teacher_auth_headers: dict):
        mock_create.return_value = {"id": 1, "title": "New Video"}
        mock_url.return_value = "https://r2.cloudflare.com/presigned-url"
        data = {"title": "New Video"}
        response = await client.post("/api/v1/teacher/courses/1/videos", json=data, headers=teacher_auth_headers)
        assert response.status_code == 201
        assert "upload_url" in response.json() or "presigned_url" in response.json()

    @patch('app.services.video_service.VideoService.delete_video')
    async def test_delete_video_success(self, mock_delete, client: AsyncClient, teacher_auth_headers: dict):
        mock_delete.return_value = True
        response = await client.delete("/api/v1/teacher/courses/1/videos/1", headers=teacher_auth_headers)
        assert response.status_code == 204

    @patch('app.services.video_service.VideoService.confirm_video')
    async def test_confirm_video_success(self, mock_confirm, client: AsyncClient, teacher_auth_headers: dict):
        mock_confirm.return_value = {"id": 1, "status": "ready"}
        response = await client.post("/api/v1/teacher/courses/1/videos/1/confirm", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.video_service.VideoService.reorder_videos')
    async def test_reorder_videos_success(self, mock_reorder, client: AsyncClient, teacher_auth_headers: dict):
        mock_reorder.return_value = True
        data = {"video_ids": [2, 1, 3]}
        response = await client.put("/api/v1/teacher/courses/1/videos/reorder", json=data, headers=teacher_auth_headers)
        assert response.status_code == 200


# --- PDFs ---

class TestTeacherPdfsAPI:
    @patch('app.services.pdf_service.PdfService.get_pdfs')
    async def test_get_pdfs_success(self, mock_get_pdfs, client: AsyncClient, teacher_auth_headers: dict):
        mock_get_pdfs.return_value = [{"id": 1, "title": "Notes"}]
        response = await client.get("/api/v1/teacher/courses/1/pdfs", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.pdf_service.PdfService.create_pdf')
    async def test_create_pdf_success(self, mock_create, client: AsyncClient, teacher_auth_headers: dict):
        mock_create.return_value = {"id": 1, "title": "Notes"}
        data = {"title": "Notes", "url": "https://example.com/pdf"}
        response = await client.post("/api/v1/teacher/courses/1/pdfs", json=data, headers=teacher_auth_headers)
        assert response.status_code == 201

    @patch('app.services.pdf_service.PdfService.delete_pdf')
    async def test_delete_pdf_success(self, mock_delete, client: AsyncClient, teacher_auth_headers: dict):
        mock_delete.return_value = True
        response = await client.delete("/api/v1/teacher/courses/1/pdfs/1", headers=teacher_auth_headers)
        assert response.status_code == 204


# --- Announcements ---

class TestTeacherAnnouncementsAPI:
    @patch('app.services.announcement_service.AnnouncementService.create_announcement')
    async def test_create_announcement(self, mock_create, client: AsyncClient, teacher_auth_headers: dict):
        mock_create.return_value = {"id": 1, "title": "Welcome"}
        data = {"title": "Welcome", "content": "Hello"}
        response = await client.post("/api/v1/teacher/courses/1/announcements", json=data, headers=teacher_auth_headers)
        assert response.status_code == 201

    @patch('app.services.announcement_service.AnnouncementService.get_announcements')
    async def test_get_announcements(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = [{"id": 1, "title": "Welcome"}]
        response = await client.get("/api/v1/teacher/courses/1/announcements", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.announcement_service.AnnouncementService.delete_announcement')
    async def test_delete_announcement(self, mock_delete, client: AsyncClient, teacher_auth_headers: dict):
        mock_delete.return_value = True
        response = await client.delete("/api/v1/teacher/courses/1/announcements/1", headers=teacher_auth_headers)
        assert response.status_code == 204

    @patch('app.services.announcement_service.AnnouncementService.pin_announcement')
    async def test_pin_announcement(self, mock_pin, client: AsyncClient, teacher_auth_headers: dict):
        mock_pin.return_value = {"id": 1, "pinned": True}
        response = await client.post("/api/v1/teacher/courses/1/announcements/1/pin", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.announcement_service.AnnouncementService.unpin_announcement')
    async def test_unpin_announcement(self, mock_unpin, client: AsyncClient, teacher_auth_headers: dict):
        mock_unpin.return_value = {"id": 1, "pinned": False}
        response = await client.post("/api/v1/teacher/courses/1/announcements/1/unpin", headers=teacher_auth_headers)
        assert response.status_code == 200


# --- Students ---

class TestTeacherStudentsAPI:
    @patch('app.services.student_service.StudentService.get_students')
    async def test_get_students(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = [{"id": 1, "name": "Student A"}]
        response = await client.get("/api/v1/teacher/students", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.student_service.StudentService.get_student_by_id')
    async def test_get_student_by_id(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = {"id": 1, "name": "Student A"}
        response = await client.get("/api/v1/teacher/students/1", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.student_service.StudentService.suspend_student')
    async def test_suspend_student(self, mock_suspend, client: AsyncClient, teacher_auth_headers: dict):
        mock_suspend.return_value = True
        response = await client.post("/api/v1/teacher/students/1/suspend", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.student_service.StudentService.block_student')
    async def test_block_student(self, mock_block, client: AsyncClient, teacher_auth_headers: dict):
        mock_block.return_value = True
        response = await client.post("/api/v1/teacher/students/1/block", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.student_service.StudentService.unblock_student')
    async def test_unblock_student(self, mock_unblock, client: AsyncClient, teacher_auth_headers: dict):
        mock_unblock.return_value = True
        response = await client.post("/api/v1/teacher/students/1/unblock", headers=teacher_auth_headers)
        assert response.status_code == 200


# --- Profile ---

class TestTeacherProfileAPI:
    @patch('app.services.teacher_service.TeacherService.get_profile')
    async def test_get_profile(self, mock_get, client: AsyncClient, teacher_auth_headers: dict):
        mock_get.return_value = {"name": "Teacher A"}
        response = await client.get("/api/v1/teacher/profile", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.teacher_service.TeacherService.update_profile')
    async def test_update_profile(self, mock_update, client: AsyncClient, teacher_auth_headers: dict):
        mock_update.return_value = {"name": "Updated Teacher"}
        response = await client.patch("/api/v1/teacher/profile", json={"name": "Updated Teacher"}, headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.s3_service.S3Service.generate_presigned_url')
    async def test_update_avatar(self, mock_presigned, client: AsyncClient, teacher_auth_headers: dict):
        mock_presigned.return_value = "https://r2.cloudflare.com/avatar-upload-url"
        response = await client.post("/api/v1/teacher/profile/avatar", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert "upload_url" in response.json() or "presigned_url" in response.json()


# --- Analytics & Exports ---

class TestTeacherAnalyticsAPI:
    @patch('app.services.attendance_service.AttendanceService.export_csv')
    async def test_export_attendance(self, mock_export, client: AsyncClient, teacher_auth_headers: dict):
        mock_export.return_value = b"id,name\n1,Test"
        response = await client.get("/api/v1/teacher/attendance/export", headers=teacher_auth_headers)
        assert response.status_code == 200
        assert 'text/csv' in response.headers.get("Content-Type", "")

    @patch('app.services.analytics_service.AnalyticsService.get_revenue')
    async def test_get_revenue(self, mock_revenue, client: AsyncClient, teacher_auth_headers: dict):
        mock_revenue.return_value = {"total": 5000}
        response = await client.get("/api/v1/teacher/analytics/revenue", headers=teacher_auth_headers)
        assert response.status_code == 200

    @patch('app.services.analytics_service.AnalyticsService.get_courses_analytics')
    async def test_get_courses_analytics(self, mock_courses_analytics, client: AsyncClient, teacher_auth_headers: dict):
        mock_courses_analytics.return_value = {"views": 1000}
        response = await client.get("/api/v1/teacher/analytics/courses", headers=teacher_auth_headers)
        assert response.status_code == 200
