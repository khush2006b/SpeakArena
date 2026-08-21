"""Base model mixins shared by all SQLAlchemy ORM models.

Provides UUIDv7 primary keys, audit timestamps, and soft-delete
capability as composable mixins. All models inherit the mixins
they need rather than a single monolithic base class.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import TIMESTAMP, text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

# TIMESTAMPTZ alias for clarity — maps to TIMESTAMP(timezone=True) on all backends.
# PostgreSQL renders this as TIMESTAMPTZ DDL.
TIMESTAMPTZ = TIMESTAMP(timezone=True)


def _utcnow() -> datetime:
    """Return the current UTC datetime (timezone-aware).

    Used as the Python-side onupdate callable for updated_at columns.
    Ensures the application always stores timezone-aware datetimes.

    Returns:
        datetime: Current UTC time with tzinfo set.
    """
    return datetime.now(timezone.utc)


class UUIDPrimaryKeyMixin:
    """Provides a UUIDv7 primary key column.

    The default is generated server-side by the pg_uuidv7 PostgreSQL
    extension (CREATE EXTENSION IF NOT EXISTS pg_uuidv7), ensuring
    monotonically increasing IDs for optimal B-tree insert performance.
    UUIDv7 encodes a millisecond timestamp in the high 48 bits,
    eliminating the page splits that plague UUIDv4-keyed tables.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    """Provides created_at and updated_at audit timestamp columns.

    created_at: Set server-side on INSERT. Never modified after that.
    updated_at: Set server-side on INSERT. The application layer
                calls _utcnow() via onupdate before each flush.
                A PostgreSQL trigger is added in the migration for
                server-side enforcement on direct SQL updates.
    """

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ,
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ,
        nullable=False,
        server_default=func.now(),
        onupdate=_utcnow,
    )


class SoftDeleteMixin:
    """Provides soft-delete capability via a deleted_at timestamp.

    Conventions:
    - deleted_at IS NULL     -> record is active.
    - deleted_at IS NOT NULL -> record is soft-deleted.

    All application queries must append WHERE deleted_at IS NULL.
    Partial indexes on deleted_at IS NULL keep active-record queries fast.
    Physical deletion is only performed by GDPR erasure jobs which
    anonymize PII instead of dropping rows.
    """

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ,
        nullable=True,
        default=None,
    )

    @property
    def is_deleted(self) -> bool:
        """Return True if this record has been soft-deleted.

        Returns:
            bool: True when deleted_at is set.
        """
        return self.deleted_at is not None
