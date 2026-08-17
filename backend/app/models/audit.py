"""AuditLog model — immutable, append-only event record.

This table is the compliance and security audit trail for the platform.
The database application role does NOT have UPDATE or DELETE privileges
on this table. All writes are INSERT-only.

Partitioned by created_at RANGE (monthly) at Tier 2+ for fast archival
and instant partition DROP for retention management.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDPrimaryKeyMixin
from app.models.enums import AuditSeverity

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(UUIDPrimaryKeyMixin, Base):
    """Immutable audit event record.

    Captures every significant platform action: who (actor_id + role),
    what (action in dot-notation), which entity, before/after state,
    network context (IP, user_agent), and the API request_id for
    distributed log correlation.

    Severity levels:
    - info    : Routine actions (login, view course, send message).
    - warning : Suspicious actions (repeated failed logins, bulk deletes).
    - critical: Security events (role escalation, payment manipulation).
    """

    __tablename__ = "audit_logs"

    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
        comment="NULL for system and webhook-initiated actions.",
    )
    actor_role: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None,
        comment="Denormalized at log time. Role may change on users table later.",
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Dot-notation: user.login | course.published | payment.captured",
    )
    entity_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default=None
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, default=None
    )
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True, default=None)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    request_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, default=None,
        comment="Correlates with API request logs via X-Request-ID header.",
    )
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=AuditSeverity.INFO,
        server_default="info",
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    actor: Mapped[Optional[User]] = relationship(
        "User", back_populates="audit_logs", foreign_keys=[actor_id]
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<AuditLog action={self.action!r} severity={self.severity}>"
