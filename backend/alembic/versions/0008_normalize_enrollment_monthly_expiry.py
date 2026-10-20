"""Normalize course enrollments to 1-month (30-day) expiry.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Normalize any enrollments with legacy 1-year or NULL expiry to 30 days from enrolled_at
    statements = [
        """
        UPDATE course_enrollments
        SET expires_at = enrolled_at + INTERVAL '30 days'
        WHERE expires_at IS NULL OR expires_at > enrolled_at + INTERVAL '31 days';
        """,
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0008] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
