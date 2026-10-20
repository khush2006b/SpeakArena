"""Unenroll any students who have crossed the 30-day batch period.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # 1. Decrement course total_enrollments for all expired enrollments
    # 2. Delete all enrollments that have crossed the 30-day time period
    statements = [
        """
        UPDATE courses c
        SET total_enrollments = GREATEST(0, c.total_enrollments - sub.cnt)
        FROM (
            SELECT course_id, COUNT(*) as cnt
            FROM course_enrollments
            WHERE enrolled_at <= NOW() - INTERVAL '30 days'
               OR (expires_at IS NOT NULL AND expires_at <= NOW())
            GROUP BY course_id
        ) sub
        WHERE c.id = sub.course_id;
        """,
        """
        DELETE FROM course_enrollments
        WHERE enrolled_at <= NOW() - INTERVAL '30 days'
           OR (expires_at IS NOT NULL AND expires_at <= NOW());
        """,
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0009] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
