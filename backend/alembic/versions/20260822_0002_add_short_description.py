"""Add short_description to courses table.

Revision ID: 20260822_0002_add_short_description
Revises: 20260805_0001_initial_schema
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20260822_0002_add_short_description"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add short_description column to courses table
    op.add_column(
        "courses",
        sa.Column(
            "short_description",
            sa.String(500),
            nullable=True,
            comment="Displayed on course cards. 1-2 sentence summary.",
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "short_description")
