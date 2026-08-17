"""API-layer tests for the assignment module endpoints.

All tests use the mocked ASGI client (no real DB / Redis).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import FakeTeacher, FakeUser


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def teacher() -> FakeTeacher:
    return FakeTeacher()


@pytest.fixture
def student() -> FakeUser:
    return FakeUser()


@pytest.fixture
async def teacher_client(
    mock_db: AsyncMock,
    mock_redis: AsyncMock,
    teacher: FakeTeacher,
) -> AsyncClient:
    """ASGI client authenticated as a teacher."""
    from app.main import app
    from app.database import get_db_session
    from app.core.redis.client import get_redis
    from app.modules.auth.dependencies import get_current_teacher

    async def _db():
        yield mock_db

    async def _redis():
        yield mock_redis

    app.dependency_overrides[get_db_session] = _db
    app.dependency_overrides[get_redis] = _redis
    app.dependency_overrides[get_current_teacher] = lambda: teacher

    async with AsyncClient(
        transport=__import__("httpx").ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def student_client(
    mock_db: AsyncMock,
    mock_redis: AsyncMock,
    student: FakeUser,
) -> AsyncClient:
    """ASGI client authenticated as a student."""
    from app.main import app
    from app.database import get_db_session
    from app.core.redis.client import get_redis
    from app.modules.auth.dependencies import get_current_student

    async def _db():
        yield mock_db

    async def _redis():
        yield mock_redis

    app.dependency_overrides[get_db_session] = _db
    app.dependency_overrides[get_redis] = _redis
    app.dependency_overrides[get_current_student] = lambda: student

    async with AsyncClient(
        transport=__import__("httpx").ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ===========================================================================
# POST /assignments — Create
# ===========================================================================


@pytest.mark.api
class TestCreateAssignment:
    """Tests for the assignment creation endpoint."""

    @pytest.mark.asyncio
    async def test_create_returns_201(
        self, teacher_client: AsyncClient, teacher: FakeTeacher
    ) -> None:
        """Valid create request must return 201 with assignment data."""
        course_id = uuid.uuid4()
        assignment_id = uuid.uuid4()
        fake_data = {
            "id": str(assignment_id),
            "course_id": str(course_id),
            "title": "Homework 1",
            "description": None,
            "due_at": None,
            "max_score": 100,
            "is_published": False,
            "allow_late_submission": True,
            "submission_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch(
            "app.modules.assignment.service.AssignmentService.create",
            new_callable=AsyncMock,
            return_value=fake_data,
        ):
            resp = await teacher_client.post(
                "/api/v1/assignments",
                json={
                    "course_id": str(course_id),
                    "title": "Homework 1",
                    "max_score": 100,
                },
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["data"]["is_published"] is False

    @pytest.mark.asyncio
    async def test_create_missing_title_returns_422(
        self, teacher_client: AsyncClient
    ) -> None:
        """Request without title must return 422."""
        resp = await teacher_client.post(
            "/api/v1/assignments",
            json={"course_id": str(uuid.uuid4()), "max_score": 100},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_student_cannot_create_assignment(
        self, student_client: AsyncClient
    ) -> None:
        """Students must not be able to create assignments (403)."""
        resp = await student_client.post(
            "/api/v1/assignments",
            json={
                "course_id": str(uuid.uuid4()),
                "title": "Sneaky Assignment",
                "max_score": 100,
            },
        )
        # Student hits get_current_teacher dependency, which returns 403.
        assert resp.status_code in {401, 403}


# ===========================================================================
# POST /assignments/{assignment_id}/publish
# ===========================================================================


@pytest.mark.api
class TestPublishAssignment:
    """Tests for the assignment publish endpoint."""

    @pytest.mark.asyncio
    async def test_publish_returns_200(
        self, teacher_client: AsyncClient
    ) -> None:
        """Publishing must return 200 with is_published=True."""
        assignment_id = uuid.uuid4()
        fake_result = {
            "id": str(assignment_id),
            "title": "Homework 1",
            "is_published": True,
            "submission_count": 0,
        }

        with patch(
            "app.modules.assignment.service.AssignmentService.publish",
            new_callable=AsyncMock,
            return_value=fake_result,
        ):
            resp = await teacher_client.post(
                f"/api/v1/assignments/{assignment_id}/publish"
            )

        assert resp.status_code == 200
        assert resp.json()["data"]["is_published"] is True


# ===========================================================================
# POST /assignments/{assignment_id}/submit/text
# ===========================================================================


@pytest.mark.api
class TestTextSubmission:
    """Tests for the text submission endpoint."""

    @pytest.mark.asyncio
    async def test_submit_text_returns_201(
        self, student_client: AsyncClient
    ) -> None:
        """Valid text submission must return 201."""
        assignment_id = uuid.uuid4()
        fake_sub = {
            "id": str(uuid.uuid4()),
            "assignment_id": str(assignment_id),
            "student_id": str(uuid.uuid4()),
            "text_response": "My answer here",
            "is_late": False,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch(
            "app.modules.assignment.service.SubmissionService.submit_text",
            new_callable=AsyncMock,
            return_value=fake_sub,
        ):
            resp = await student_client.post(
                f"/api/v1/assignments/{assignment_id}/submit/text",
                json={"text_response": "My answer here"},
            )

        assert resp.status_code == 201
        assert resp.json()["data"]["is_late"] is False

    @pytest.mark.asyncio
    async def test_submit_empty_text_returns_422(
        self, student_client: AsyncClient
    ) -> None:
        """Empty text_response must return 422."""
        resp = await student_client.post(
            f"/api/v1/assignments/{uuid.uuid4()}/submit/text",
            json={"text_response": ""},
        )
        assert resp.status_code == 422


# ===========================================================================
# POST /assignments/submissions/{id}/grade
# ===========================================================================


@pytest.mark.api
class TestGradeSubmission:
    """Tests for the grade submission endpoint."""

    @pytest.mark.asyncio
    async def test_grade_returns_200(
        self, teacher_client: AsyncClient
    ) -> None:
        """Grading a submission must return 200 with score."""
        sub_id = uuid.uuid4()
        graded = {
            "id": str(sub_id),
            "score": 85,
            "feedback": "Well done!",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch(
            "app.modules.assignment.service.SubmissionService.grade",
            new_callable=AsyncMock,
            return_value=graded,
        ):
            resp = await teacher_client.post(
                f"/api/v1/assignments/submissions/{sub_id}/grade",
                json={"score": 85, "feedback": "Well done!"},
            )

        assert resp.status_code == 200
        assert resp.json()["data"]["score"] == 85
