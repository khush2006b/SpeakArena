"""Notification and NotificationPreference models.

Notification          : Per-user event notification persisted for history.
NotificationPreference: Per-user per-type delivery channel settings.

Real-time delivery uses Redis Pub/Sub on notifications:{user_id}.
This table provides the notification history page and unread badge count.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
TIMESTAMPTZ = TIMESTAMP(timezone=True)  # noqa: N816
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import NotificationChannel, NotificationType

if TYPE_CHECKING:
    from app.models.user import User


class Notification(UUIDPrimaryKeyMixin, Base):
    """In-app notification record.

    Written by the notification service on platform events. Published
    to Redis Pub/Sub channel notifications:{recipient_id} immediately
    after database insert for real-time WebSocket delivery.
    The database record powers the notification history page and the
    unread badge count (queried via the partial index on is_read=false).
    """

    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="The user who triggered the event. NULL for system events.",
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None,
        comment="Deep link navigated to when the user clicks the notification.",
    )
    entity_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default=None
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, default=None
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=NotificationChannel.IN_APP,
        server_default="in_app",
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    is_email_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    email_sent_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ, nullable=True, default=None
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ, nullable=False, server_default="NOW()"
    )

    # --- Relationships ---
    recipient: Mapped[User] = relationship(
        "User", back_populates="notifications", foreign_keys=[recipient_id]
    )
    actor: Mapped[Optional[User]] = relationship(
        "User", foreign_keys=[actor_id]
    )

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"<Notification id={self.id} type={self.type} read={self.is_read}>"


class NotificationPreference(UUIDPrimaryKeyMixin, Base):
    """Per-user notification delivery preference.

    Controls whether a specific notification type is delivered
    via in_app, email, or push channels for this user.
    Defaults are created lazily on first preference update.

    Attributes:
        user_id:          The user this preference belongs to.
        notification_type: The event type (e.g. 'assignment_graded').
        channel:          Delivery channel (in_app | email | push).
        is_enabled:       Whether delivery via this channel is enabled.
    """

    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Matches NotificationType enum values."
    )
    channel: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NotificationChannel.IN_APP
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # --- Relationships ---
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return (
            f"<NotificationPreference user={self.user_id}"
            f" type={self.notification_type} channel={self.channel}"
            f" enabled={self.is_enabled}>"
        )
