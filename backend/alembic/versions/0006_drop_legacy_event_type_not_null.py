"""Drop NOT NULL on legacy payment_history columns.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    statements = [
        "ALTER TABLE payment_history ALTER COLUMN event_type DROP NOT NULL;",
        "ALTER TABLE payment_history ALTER COLUMN event_type SET DEFAULT NULL;",
        "ALTER TABLE payment_history ALTER COLUMN payload DROP NOT NULL;",
        "ALTER TABLE payment_history ALTER COLUMN payload SET DEFAULT '{}';",
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0006] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
