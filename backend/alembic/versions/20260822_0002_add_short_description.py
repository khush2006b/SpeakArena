"""Add all missing courses columns to match current SQLAlchemy model.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-22

The initial schema (0001) was created before the Course model was updated.
This migration adds all columns that exist in the model but are absent from
the DB: short_description, promo_video_r2_key, original_price, total_lectures,
total_enrollments, max_students, total_reviews, average_rating,
is_certificate_enabled, metadata.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("short_description", sa.String(500), nullable=True))
    op.add_column("courses", sa.Column("promo_video_r2_key", sa.String(512), nullable=True))
    op.add_column("courses", sa.Column("original_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("courses", sa.Column("total_lectures", sa.SmallInteger(), nullable=False, server_default="0"))
    op.add_column("courses", sa.Column("total_enrollments", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("courses", sa.Column("max_students", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("courses", sa.Column("total_reviews", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("courses", sa.Column("average_rating", sa.Numeric(3, 2), nullable=True))
    op.add_column("courses", sa.Column("is_certificate_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column(
        "courses",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "metadata")
    op.drop_column("courses", "is_certificate_enabled")
    op.drop_column("courses", "average_rating")
    op.drop_column("courses", "total_reviews")
    op.drop_column("courses", "max_students")
    op.drop_column("courses", "total_enrollments")
    op.drop_column("courses", "total_lectures")
    op.drop_column("courses", "original_price")
    op.drop_column("courses", "promo_video_r2_key")
    op.drop_column("courses", "short_description")
