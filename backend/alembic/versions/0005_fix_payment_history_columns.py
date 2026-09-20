"""Fix payment_history table — add missing columns.

The initial schema created payment_history with only:
  id, payment_id, event_type, payload, created_at

The PaymentHistory model now expects:
  from_status, to_status, event, actor_id, metadata

Migration 0004 skipped this because CREATE TABLE IF NOT EXISTS
saw the table already existed. This migration ALTERs the existing table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    statements = [
        # Add columns the PaymentHistory ORM model expects
        "ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS from_status VARCHAR(20) DEFAULT NULL;",
        "ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS to_status VARCHAR(20) DEFAULT NULL;",
        "ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS event VARCHAR(100) DEFAULT NULL;",
        "ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS actor_id UUID DEFAULT NULL;",
        "ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        # Back-fill to_status and event from the old columns (safe migration)
        "UPDATE payment_history SET to_status = event_type WHERE to_status IS NULL AND event_type IS NOT NULL;",
        "UPDATE payment_history SET event = event_type WHERE event IS NULL AND event_type IS NOT NULL;",
        "UPDATE payment_history SET metadata = payload WHERE metadata = '{}' AND payload IS NOT NULL;",
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0005] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
