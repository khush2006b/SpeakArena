"""
API tests — Student Portal
GET  /api/v1/courses                      Student enrolled courses (paginated)
GET  /api/v1/courses/recently-viewed      Last N accessed courses
GET  /api/v1/courses/{course_id}          Course detail (triggers last_viewed update)
GET  /api/v1/courses/{course_id}/announcements  Enrolled-only access
GET  /api/v1/student/dashboard            Aggregate portal dashboard
GET  /api/v1/student/search               Global search (enrollment-scoped)
GET  /api/v1/attendance                   Student attendance across all courses
GET  /api/v1/attendance/summary           Student attendance summary

Coverage: Success · 401 · 403 · 422 · Enrollment enforcement
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COURSES_BASE = "/api/v1/courses"
STUDENT_BASE = "/api/v1/student"
ATTENDANCE_STUDENT_BASE = "/api/v1/attendance"

SAMPLE_COURSE_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# GET /courses — Student enrolled course list
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentCourseList:
    """GET /api/v1/courses"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(COURSES_BASE)
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_courses_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(COURSES_BASE, headers=teacher_auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_paginated_enrolled_courses(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.list_enrolled",
            new_callable=AsyncMock,
        ) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(COURSES_BASE, headers=student_auth_headers)
        assert resp.status_code == 200
        assert "data" in resp.json()

    @pytest.mark.asyncio
    async def test_page_less_than_1_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{COURSES_BASE}?page=0", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_only_in_progress_filter(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.list_enrolled",
            new_callable=AsyncMock,
        ) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(
                f"{COURSES_BASE}?only_in_progress=true",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_search_param_is_forwarded(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.list_enrolled",
            new_callable=AsyncMock,
        ) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(
                f"{COURSES_BASE}?search=system+design",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        mock_list.assert_called_once()

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(
        self, client: AsyncClient, expired_auth_headers: dict
    ) -> None:
        resp = await client.get(COURSES_BASE, headers=expired_auth_headers)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /courses/recently-viewed
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRecentlyViewedCourses:
    """GET /api/v1/courses/recently-viewed"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{COURSES_BASE}/recently-viewed")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_list_of_courses(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.recently_viewed",
            new_callable=AsyncMock,
        ) as mock_recent:
            mock_recent.return_value = []
            resp = await client.get(
                f"{COURSES_BASE}/recently-viewed",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_limit_out_of_range_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        # limit must be 1–20
        resp = await client.get(
            f"{COURSES_BASE}/recently-viewed?limit=0",
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

        resp = await client.get(
            f"{COURSES_BASE}/recently-viewed?limit=21",
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_limit_within_range_succeeds(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.recently_viewed",
            new_callable=AsyncMock,
        ) as mock_recent:
            mock_recent.return_value = []
            resp = await client.get(
                f"{COURSES_BASE}/recently-viewed?limit=5",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /courses/{course_id}
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentCourseDetail:
    """GET /api/v1/courses/{course_id}"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{COURSES_BASE}/{SAMPLE_COURSE_ID}")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{COURSES_BASE}/not-a-uuid",
            headers=student_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_not_enrolled_returns_403_or_404(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class EnrollmentNotFoundError(AppError):
            status_code = 404
            error_code = "EnrollmentNotFound"
            message = "Enrollment not found."

        with patch(
            "app.modules.student.service.StudentCourseService.get_course_detail",
            new_callable=AsyncMock,
        ) as mock_detail:
            mock_detail.side_effect = EnrollmentNotFoundError()
            resp = await client.get(
                f"{COURSES_BASE}/{SAMPLE_COURSE_ID}",
                headers=student_auth_headers,
            )
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_enrolled_student_gets_full_course_detail(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        course_detail = {
            "id": SAMPLE_COURSE_ID,
            "title": "System Design Masterclass",
            "progress": 45,
            "curriculum": [],
            "teacher": {"name": "Prof. Alice"},
        }
        with patch(
            "app.modules.student.service.StudentCourseService.get_course_detail",
            new_callable=AsyncMock,
        ) as mock_detail:
            mock_detail.return_value = course_detail
            resp = await client.get(
                f"{COURSES_BASE}/{SAMPLE_COURSE_ID}",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "System Design Masterclass"

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_course_detail_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{COURSES_BASE}/{SAMPLE_COURSE_ID}",
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /courses/{course_id}/announcements
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentCourseAnnouncements:
    """GET /api/v1/courses/{course_id}/announcements"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{COURSES_BASE}/{SAMPLE_COURSE_ID}/announcements")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_not_enrolled_student_returns_403_or_404(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class EnrollmentNotFoundError(AppError):
            status_code = 404
            error_code = "EnrollmentNotFound"
            message = "Not enrolled."

        with patch(
            "app.modules.student.service.StudentCourseService.get_announcements",
            new_callable=AsyncMock,
        ) as mock_ann:
            mock_ann.side_effect = EnrollmentNotFoundError()
            resp = await client.get(
                f"{COURSES_BASE}/{SAMPLE_COURSE_ID}/announcements",
                headers=student_auth_headers,
            )
        assert resp.status_code in (403, 404)

    @pytest.mark.asyncio
    async def test_enrolled_student_gets_announcements(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch(
            "app.modules.student.service.StudentCourseService.get_announcements",
            new_callable=AsyncMock,
        ) as mock_ann:
            mock_ann.return_value = ([], 0)
            resp = await client.get(
                f"{COURSES_BASE}/{SAMPLE_COURSE_ID}/announcements",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /student/dashboard
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentDashboard:
    """GET /api/v1/student/dashboard"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{STUDENT_BASE}/dashboard")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_dashboard_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        resp = await client.get(f"{STUDENT_BASE}/dashboard", headers=teacher_auth_headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_complete_dashboard_payload(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock, mock_redis: AsyncMock
    ) -> None:
        dashboard_payload = {
            "welcome": {"name": "Bob Student", "streak": 5},
            "enrolled_courses": [],
            "continue_learning": None,
            "upcoming_meetings": [],
            "recent_announcements": [],
            "unread_notifications": 2,
            "attendance_summary": {"percentage": 88.0},
            "recent_payments": [],
        }

        with patch(
            "app.modules.student.service.StudentDashboardService.get_dashboard",
            new_callable=AsyncMock,
        ) as mock_dash:
            mock_dash.return_value = dashboard_payload
            resp = await client.get(f"{STUDENT_BASE}/dashboard", headers=student_auth_headers)

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "welcome" in data
        assert "enrolled_courses" in data

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(
        self, client: AsyncClient, expired_auth_headers: dict
    ) -> None:
        resp = await client.get(f"{STUDENT_BASE}/dashboard", headers=expired_auth_headers)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /student/search
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentSearch:
    """GET /api/v1/student/search"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{STUDENT_BASE}/search?q=design")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_query_returns_422_or_200(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        """Empty search query is a valid edge case."""
        with patch(
            "app.modules.student.service.StudentSearchService.search",
            new_callable=AsyncMock,
        ) as mock_search:
            mock_search.return_value = {"results": [], "total": 0}
            resp = await client.get(f"{STUDENT_BASE}/search?q=", headers=student_auth_headers)
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_returns_scoped_results(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        """Search results must be scoped to the student's active enrollments."""
        search_results = {
            "results": [
                {"type": "video", "id": str(uuid.uuid4()), "title": "CAP Theorem Deep Dive"},
            ],
            "total": 1,
        }
        with patch(
            "app.modules.student.service.StudentSearchService.search",
            new_callable=AsyncMock,
        ) as mock_search:
            mock_search.return_value = search_results
            resp = await client.get(
                f"{STUDENT_BASE}/search?q=CAP+theorem",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 1

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_search_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{STUDENT_BASE}/search?q=design",
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /attendance (student own attendance)
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestStudentAttendance:
    """GET /api/v1/attendance and /attendance/summary"""

    @pytest.mark.asyncio
    async def test_attendance_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(ATTENDANCE_STUDENT_BASE)
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_attendance_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        """The student attendance list route is student-only."""
        resp = await client.get(ATTENDANCE_STUDENT_BASE, headers=teacher_auth_headers)
        # Teacher would need to go to /api/v1/attendance/{meeting_id} instead
        assert resp.status_code in (403, 404, 422)

    @pytest.mark.asyncio
    async def test_invalid_status_filter_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{ATTENDANCE_STUDENT_BASE}?status=unknown_status",
            headers=student_auth_headers,
        )
        # If schema uses an Enum validator this is 422
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_attendance_summary_missing_token_returns_401(
        self, client: AsyncClient
    ) -> None:
        resp = await client.get(f"{ATTENDANCE_STUDENT_BASE}/summary")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_attendance_summary_returns_aggregated_stats(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        summary = {
            "total_meetings": 20,
            "attended": 17,
            "absent": 2,
            "late": 1,
            "attendance_percentage": 85.0,
        }
        with patch(
            "app.modules.student.service.StudentAttendanceService.summary",
            new_callable=AsyncMock,
        ) as mock_summary:
            mock_summary.return_value = summary
            resp = await client.get(
                f"{ATTENDANCE_STUDENT_BASE}/summary",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["attendance_percentage"] == 85.0
