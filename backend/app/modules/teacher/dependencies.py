"""FastAPI dependency factories specific to the Teacher Module.

These dependencies are thin wrappers over the auth dependencies,
providing clear naming and a single import point for teacher routes.

All teacher endpoints use ``get_current_teacher`` to enforce:
    1. Valid JWT (via ``get_current_user``).
    2. Teacher role (via ``PermissionService.require_teacher``).
    3. Active account.

Students who attempt to access these endpoints receive HTTP 403 Forbidden.

Usage::

    @router.get(\"/courses\")
    async def list_courses(
        teacher: User = Depends(get_current_teacher),
        db: AsyncSession = Depends(get_db_session),
        redis: Redis = Depends(get_redis),
    ) -> JSONResponse:
        ...
"""

from __future__ import annotations

# Re-export the shared dependency so teacher routes have a single import point.
# This keeps the import path consistent:
#   from app.modules.teacher.dependencies import get_current_teacher
# rather than importing from modules.auth.dependencies in every teacher router.

from app.modules.auth.dependencies import (  # noqa: F401
    get_current_teacher,
    get_client_ip,
    get_user_agent,
)
