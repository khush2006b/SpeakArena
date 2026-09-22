"""Add USD pricing columns to courses table.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    statements = [
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS usd_price NUMERIC(10, 2) DEFAULT NULL;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_usd_price NUMERIC(10, 2) DEFAULT NULL;",
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0007] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
