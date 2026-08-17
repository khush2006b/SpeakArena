"""FastAPI dependency factories specific to the Student Module.

Thin wrappers over the auth dependencies providing a self-contained
import point so all student routers share a single import path:

    from app.modules.student.dependencies import get_current_student

Usage::

    @router.get(\"/courses\")
    async def list_courses(
        student: User = Depends(get_current_student),
        db: AsyncSession = Depends(get_db_session),
        redis: Redis = Depends(get_redis),
    ) -> JSONResponse:
        ...

Security:
    ``get_current_student`` enforces:
    1. Valid JWT (signature + expiry + not revoked in Redis).
    2. Student role — teachers receive HTTP 403 Forbidden.
    3. is_active == True — blocked accounts receive HTTP 403 Forbidden.
"""

from __future__ import annotations

# Re-export the shared auth dependencies so student routes have a
# self-contained import path without coupling directly to auth internals.
from app.modules.auth.dependencies import (  # noqa: F401
    get_current_student,
    get_client_ip,
    get_user_agent,
)
