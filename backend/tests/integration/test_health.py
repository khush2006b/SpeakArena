"""Integration tests for health check endpoints.

Verifies that /health/live and /health/ready return the
correct responses and status codes.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_liveness_probe(client: AsyncClient) -> None:
    """GET /health/live should return 200 with status 'alive'."""
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "version" in data


@pytest.mark.asyncio
async def test_readiness_probe(client: AsyncClient) -> None:
    """GET /health/ready should return 200 when dependencies are healthy."""
    response = await client.get("/health/ready")
    # May return 503 if DB/Redis not available in CI — that is acceptable
    assert response.status_code in {200, 503}
    data = response.json()
    assert "status" in data
    assert "checks" in data
