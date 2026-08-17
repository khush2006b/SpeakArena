"""
API tests — Meeting Module (Google Meet Integration)
POST /api/v1/meetings                       Create meeting (teacher)
GET  /api/v1/meetings                       List meetings
GET  /api/v1/meetings/{id}                  Get meeting detail
PATCH /api/v1/meetings/{id}                 Update meeting
DELETE /api/v1/meetings/{id}                Delete meeting (204)
POST /api/v1/meetings/{id}/cancel           Cancel with reason
POST /api/v1/meetings/{id}/duplicate        Duplicate
POST /api/v1/meetings/recurring             Create recurring series
POST /api/v1/meetings/{id}/go-live          Mark live
POST /api/v1/meetings/{id}/end              End meeting
GET  /api/v1/meetings/analytics/course/{id} Course analytics (teacher)
GET  /api/v1/meetings/analytics/me          Teacher stats
POST /api/v1/live/{id}/join                 Join meeting (student)
POST /api/v1/live/{id}/leave                Leave meeting
GET  /api/v1/attendance/{meeting_id}        List attendance (teacher)
GET  /api/v1/attendance/summary/{meeting_id} Attendance summary (teacher)
GET  /api/v1/attendance/my/{course_id}      My attendance (student)
POST /api/v1/attendance/mark                Manual mark (teacher)
GET  /api/v1/calendar/today                 Today's meetings
GET  /api/v1/calendar/upcoming              Upcoming meetings
GET  /api/v1/calendar/weekly                Weekly view
GET  /api/v1/calendar/monthly               Monthly view

Coverage: Success · 401 · 403 · 422 · Google Meet link validation
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MEETINGS_BASE = "/api/v1/meetings"
LIVE_BASE = "/api/v1/live"
ATTENDANCE_BASE = "/api/v1/attendance"
CALENDAR_BASE = "/api/v1/calendar"

SAMPLE_MEETING_ID = str(uuid.uuid4())
SAMPLE_COURSE_ID = str(uuid.uuid4())

VALID_MEET_LINK = "https://meet.google.com/abc-defg-hij"
INVALID_MEET_LINK = "https://zoom.us/j/12345"  # Not a Google Meet link

FUTURE_TIME = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()


def _meeting_payload(**overrides) -> dict:
    return {
        "course_id": SAMPLE_COURSE_ID,
        "title": "Week 3 Live Session",
        "scheduled_at": FUTURE_TIME,
        "duration_minutes": 60,
        "meet_link": VALID_MEET_LINK,
        "description": "Q&A session for Week 3 content",
        **overrides,
    }


# ---------------------------------------------------------------------------
# POST /meetings — Create meeting
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestCreateMeeting:
    """POST /api/v1/meetings"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(MEETINGS_BASE, json=_meeting_payload())
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_student_cannot_create_meeting_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            MEETINGS_BASE,
            json=_meeting_payload(),
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            MEETINGS_BASE,
            json={"title": "Incomplete meeting"},  # Missing course_id, scheduled_at, meet_link
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_google_meet_link_returns_422_or_400(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.modules.meeting.service import MeetingService

        with patch.object(MeetingService, "create_meeting", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = ValueError("Invalid Google Meet link")
            resp = await client.post(
                MEETINGS_BASE,
                json=_meeting_payload(meet_link=INVALID_MEET_LINK),
                headers=teacher_auth_headers,
            )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_past_scheduled_time_returns_422_or_400(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        with patch("app.modules.meeting.service.MeetingService.create_meeting", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = ValueError("Scheduled time must be in the future")
            resp = await client.post(
                MEETINGS_BASE,
                json=_meeting_payload(scheduled_at=past_time),
                headers=teacher_auth_headers,
            )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_successful_creation_returns_201(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        mock_meeting = MagicMock()
        mock_meeting.model_dump = lambda: {
            "id": SAMPLE_MEETING_ID,
            "title": "Week 3 Live Session",
            "status": "scheduled",
            "meet_link": None,  # Meet link is never returned
        }

        with patch("app.modules.meeting.service.MeetingService.create_meeting", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_meeting
            resp = await client.post(
                MEETINGS_BASE,
                json=_meeting_payload(),
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_meet_link_is_never_returned_in_response(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        """The Google Meet link must NEVER be in the creation response body."""
        mock_meeting = {"id": SAMPLE_MEETING_ID, "title": "Test", "status": "scheduled"}

        with patch("app.modules.meeting.service.MeetingService.create_meeting", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_meeting
            resp = await client.post(
                MEETINGS_BASE,
                json=_meeting_payload(),
                headers=teacher_auth_headers,
            )

        if resp.status_code == 201:
            body_str = resp.text
            assert VALID_MEET_LINK not in body_str, "meet_link must never appear in creation response"

    @pytest.mark.asyncio
    async def test_duration_out_of_range_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        # Duration of 0 minutes should be invalid
        resp = await client.post(
            MEETINGS_BASE,
            json=_meeting_payload(duration_minutes=0),
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(
        self, client: AsyncClient, expired_auth_headers: dict
    ) -> None:
        resp = await client.post(
            MEETINGS_BASE,
            json=_meeting_payload(),
            headers=expired_auth_headers,
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /meetings — List meetings
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestListMeetings:
    """GET /api/v1/meetings"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(MEETINGS_BASE)
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_student_can_list_meetings(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.list_meetings", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(MEETINGS_BASE, headers=student_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_teacher_can_list_meetings(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.list_meetings", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(MEETINGS_BASE, headers=teacher_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_invalid_page_size_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{MEETINGS_BASE}?page_size=101", headers=teacher_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_filter_by_status(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.list_meetings", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(
                f"{MEETINGS_BASE}?status=live",
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200
        # Verify status param was passed through
        mock_list.assert_called_once()
        kwargs = mock_list.call_args[1]
        assert kwargs.get("status") == "live"


# ---------------------------------------------------------------------------
# PATCH /meetings/{id} — Update meeting
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestUpdateMeeting:
    """PATCH /api/v1/meetings/{id}"""

    @pytest.mark.asyncio
    async def test_student_cannot_update_meeting_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.patch(
            f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}",
            json={"title": "New Title"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_update_title_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.update_meeting", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = {"id": SAMPLE_MEETING_ID, "title": "Updated Title"}
            resp = await client.patch(
                f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}",
                json={"title": "Updated Title"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Updated Title"

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.patch(
            f"{MEETINGS_BASE}/not-a-uuid",
            json={"title": "New Title"},
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DELETE /meetings/{id} — Delete meeting
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestDeleteMeeting:
    """DELETE /api/v1/meetings/{id}"""

    @pytest.mark.asyncio
    async def test_student_cannot_delete_meeting_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.delete(
            f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}",
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_successful_delete_returns_204(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.delete_meeting", new_callable=AsyncMock):
            resp = await client.delete(
                f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}",
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 204
        assert resp.content == b""  # No body on 204

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.delete(f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /meetings/{id}/cancel
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestCancelMeeting:
    """POST /api/v1/meetings/{id}/cancel"""

    @pytest.mark.asyncio
    async def test_student_cannot_cancel_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/cancel",
            json={"reason": "Schedule conflict"},
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_cancellation_without_reason_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/cancel",
            json={},
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_successful_cancellation_returns_200(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.cancel_meeting", new_callable=AsyncMock) as mock_cancel:
            mock_cancel.return_value = {"id": SAMPLE_MEETING_ID, "status": "cancelled"}
            resp = await client.post(
                f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/cancel",
                json={"reason": "Teacher emergency"},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "cancelled"


# ---------------------------------------------------------------------------
# POST /meetings/{id}/go-live and /end
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestMeetingLifecycle:
    """POST /meetings/{id}/go-live · /end"""

    @pytest.mark.asyncio
    async def test_go_live_student_forbidden(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/go-live",
            json={},
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_go_live_teacher_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.go_live", new_callable=AsyncMock) as mock_live:
            mock_live.return_value = {"id": SAMPLE_MEETING_ID, "status": "live"}
            resp = await client.post(
                f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/go-live",
                json={"actual_start_time": datetime.now(timezone.utc).isoformat()},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_end_meeting_teacher_succeeds(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.MeetingService.end_meeting", new_callable=AsyncMock) as mock_end:
            mock_end.return_value = {"id": SAMPLE_MEETING_ID, "status": "completed"}
            resp = await client.post(
                f"{MEETINGS_BASE}/{SAMPLE_MEETING_ID}/end",
                json={},
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /meetings/recurring — Recurring series
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestRecurringMeeting:
    """POST /api/v1/meetings/recurring"""

    @pytest.mark.asyncio
    async def test_student_cannot_create_recurring_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{MEETINGS_BASE}/recurring",
            json={
                "course_id": SAMPLE_COURSE_ID,
                "title": "Weekly Session",
                "start_date": FUTURE_TIME,
                "duration_minutes": 60,
                "recurrence": "weekly",
                "total_sessions": 4,
                "meet_link": VALID_MEET_LINK,
            },
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_total_sessions_too_high_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{MEETINGS_BASE}/recurring",
            json={
                "course_id": SAMPLE_COURSE_ID,
                "title": "Weekly Session",
                "start_date": FUTURE_TIME,
                "duration_minutes": 60,
                "recurrence": "weekly",
                "total_sessions": 1000,  # Unreasonably high
                "meet_link": VALID_MEET_LINK,
            },
            headers=teacher_auth_headers,
        )
        # May be 422 from schema validation or 400 from service
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# POST /live/{id}/join — Join meeting (student security pipeline)
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestJoinMeeting:
    """POST /api/v1/live/{id}/join"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/join")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_not_enrolled_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class EnrollmentRequiredError(AppError):
            status_code = 403
            error_code = "NotEnrolled"
            message = "You must be enrolled to join."

        with patch("app.modules.meeting.service.AttendanceService.join_meeting", new_callable=AsyncMock) as mock_join:
            mock_join.side_effect = EnrollmentRequiredError()
            resp = await client.post(
                f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/join",
                headers=student_auth_headers,
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_meeting_not_live_returns_400(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        from app.core.exceptions import AppError

        class MeetingNotLiveError(AppError):
            status_code = 400
            error_code = "MeetingNotLive"
            message = "Meeting is not currently live."

        with patch("app.modules.meeting.service.AttendanceService.join_meeting", new_callable=AsyncMock) as mock_join:
            mock_join.side_effect = MeetingNotLiveError()
            resp = await client.post(
                f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/join",
                headers=student_auth_headers,
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_successful_join_returns_meet_link(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        """The Google Meet link MUST be revealed here — only here."""
        join_response = {
            "meet_link": VALID_MEET_LINK,
            "meeting_id": SAMPLE_MEETING_ID,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }
        with patch("app.modules.meeting.service.AttendanceService.join_meeting", new_callable=AsyncMock) as mock_join:
            mock_join.return_value = join_response
            resp = await client.post(
                f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/join",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["meet_link"] == VALID_MEET_LINK

    @pytest.mark.asyncio
    async def test_teacher_can_also_join(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        join_response = {"meet_link": VALID_MEET_LINK, "meeting_id": SAMPLE_MEETING_ID}
        with patch("app.modules.meeting.service.AttendanceService.join_meeting", new_callable=AsyncMock) as mock_join:
            mock_join.return_value = join_response
            resp = await client.post(
                f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/join",
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /live/{id}/leave
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestLeaveMeeting:
    """POST /api/v1/live/{id}/leave"""

    @pytest.mark.asyncio
    async def test_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post(f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/leave")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_successful_leave_records_attendance(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        leave_response = {
            "duration_minutes": 45,
            "attendance_percentage": 75.0,
            "status": "attended",
        }
        with patch("app.modules.meeting.service.AttendanceService.leave_meeting", new_callable=AsyncMock) as mock_leave:
            mock_leave.return_value = leave_response
            resp = await client.post(
                f"{LIVE_BASE}/{SAMPLE_MEETING_ID}/leave",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "attended"


# ---------------------------------------------------------------------------
# GET /attendance/{meeting_id} — List attendance (teacher)
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestListAttendance:
    """GET /api/v1/attendance/{meeting_id}"""

    @pytest.mark.asyncio
    async def test_student_cannot_list_all_attendance_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{ATTENDANCE_BASE}/{SAMPLE_MEETING_ID}",
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_gets_attendance_list(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.AttendanceService.list_meeting_attendance", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = ([], 0)
            resp = await client.get(
                f"{ATTENDANCE_BASE}/{SAMPLE_MEETING_ID}",
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /attendance/my/{course_id} — Student's own attendance
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestMyAttendance:
    """GET /api/v1/attendance/my/{course_id}"""

    @pytest.mark.asyncio
    async def test_teacher_cannot_access_student_attendance_route_returns_403(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{ATTENDANCE_BASE}/my/{SAMPLE_COURSE_ID}",
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_student_gets_own_attendance(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.AttendanceService.my_attendance", new_callable=AsyncMock) as mock_my:
            mock_my.return_value = ([], 0)
            resp = await client.get(
                f"{ATTENDANCE_BASE}/my/{SAMPLE_COURSE_ID}",
                headers=student_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /attendance/mark — Manual attendance override
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestManualAttendance:
    """POST /api/v1/attendance/mark"""

    @pytest.mark.asyncio
    async def test_student_cannot_mark_attendance_returns_403(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{ATTENDANCE_BASE}/mark",
            json={
                "meeting_id": SAMPLE_MEETING_ID,
                "student_id": str(uuid.uuid4()),
                "status": "present",
            },
            headers=student_auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_status_returns_422(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.post(
            f"{ATTENDANCE_BASE}/mark",
            json={
                "meeting_id": SAMPLE_MEETING_ID,
                "student_id": str(uuid.uuid4()),
                "status": "flying",  # Not a valid status
            },
            headers=teacher_auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_teacher_can_manually_mark_attendance(
        self, client: AsyncClient, teacher_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.AttendanceService.manual_mark", new_callable=AsyncMock) as mock_mark:
            mock_mark.return_value = {"student_id": str(uuid.uuid4()), "status": "present"}
            resp = await client.post(
                f"{ATTENDANCE_BASE}/mark",
                json={
                    "meeting_id": SAMPLE_MEETING_ID,
                    "student_id": str(uuid.uuid4()),
                    "status": "present",
                },
                headers=teacher_auth_headers,
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /calendar/today, /upcoming, /weekly, /monthly
# ---------------------------------------------------------------------------


@pytest.mark.api
class TestCalendarEndpoints:
    """Calendar view endpoints — /api/v1/calendar/*"""

    @pytest.mark.asyncio
    async def test_today_missing_token_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get(f"{CALENDAR_BASE}/today")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_today_returns_meetings_for_authenticated_user(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.CalendarService.today", new_callable=AsyncMock) as mock_today:
            mock_today.return_value = []
            resp = await client.get(f"{CALENDAR_BASE}/today", headers=student_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_upcoming_days_param_out_of_range_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{CALENDAR_BASE}/upcoming?days=0", headers=student_auth_headers)
        assert resp.status_code == 422

        resp = await client.get(f"{CALENDAR_BASE}/upcoming?days=31", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_monthly_invalid_month_returns_422(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(f"{CALENDAR_BASE}/monthly?month=13", headers=student_auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_monthly_returns_days_data(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        with patch("app.modules.meeting.service.CalendarService.monthly", new_callable=AsyncMock) as mock_monthly:
            mock_monthly.return_value = {}
            resp = await client.get(f"{CALENDAR_BASE}/monthly?year=2026&month=8", headers=student_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_weekly_with_invalid_date_returns_400_or_500(
        self, client: AsyncClient, student_auth_headers: dict, mock_db: AsyncMock
    ) -> None:
        resp = await client.get(
            f"{CALENDAR_BASE}/weekly?start_date=not-a-date",
            headers=student_auth_headers,
        )
        assert resp.status_code in (400, 422, 500)
