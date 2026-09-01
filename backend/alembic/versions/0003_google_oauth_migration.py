"""Add google_id to users, make hashed_password nullable, wipe all users.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-02

Migrates SpeakArena from email/password auth to Google OAuth only.
Changes:
  - hashed_password becomes nullable (Google users have no password)
  - google_id VARCHAR(255) UNIQUE added to users table
  - All existing user rows deleted (confirmed by product decision)
"""

from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Wipe all existing users first (cascade deletes sessions, tokens, etc.)
    op.execute("DELETE FROM users")

    # 2. Make hashed_password nullable (Google users have no password)
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=True,
    )

    # 3. Add google_id column
    op.add_column(
        "users",
        sa.Column(
            "google_id",
            sa.String(255),
            nullable=True,
            comment="Google OAuth subject (sub) identifier.",
        ),
    )
    op.create_index(
        "ix_users_google_id",
        "users",
        ["google_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
    op.alter_column(
        "users",
        "hashed_password",
        existing_type=sa.String(255),
        nullable=False,
    )
