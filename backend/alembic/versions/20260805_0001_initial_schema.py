"""Initial database schema for SpeakArena.

Revision ID: 0001
Revises: None
Create Date: 2026-08-05 00:01:00 UTC

Creates all 25 production tables, all indexes, foreign key constraints,
cascading rules, the pg_uuidv7 extension, and the update_updated_at_column
PostgreSQL trigger function for server-side updated_at enforcement.

Table creation order follows foreign key dependency graph:
    1.  pg_uuidv7 extension
    2.  update_updated_at_column trigger function
    3.  categories              (self-referential; no other FK deps)
    4.  users                   (core identity; referenced by all modules)
    5.  teacher_profiles        (FK: users)
    6.  student_profiles        (FK: users)
    7.  refresh_tokens          (FK: users, self)
    8.  user_sessions           (FK: users, refresh_tokens)
    9.  password_reset_tokens   (FK: users)
    10. email_verification_tokens (FK: users)
    11. courses                 (FK: users)
    12. course_categories       (FK: courses, categories)
    13. payments                (FK: users, courses)
    14. payment_history         (FK: payments)
    15. course_enrollments      (FK: users, courses, payments)
    16. content_progress        (FK: users, course_enrollments)
    17. videos                  (FK: courses)
    18. pdfs                    (FK: courses)
    19. assignments             (FK: courses)
    20. assignment_submissions  (FK: assignments, users, course_enrollments)
    21. meetings                (FK: courses, users)
    22. session_attendance      (FK: meetings, users)
    23. attendance_events       (FK: session_attendance, users)
    24. chat_rooms              (FK: courses)
    25. messages                (FK: chat_rooms, users)
    26. message_reactions       (FK: messages, users)
    27. notifications           (FK: users)
    28. notification_preferences (FK: users)
    29. audit_logs              (FK: users)

All downgrade() steps drop in reverse order with CASCADE.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ===========================================================================
# Helper: trigger DDL strings
# ===========================================================================

_CREATE_UPDATED_AT_FUNCTION = """
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_DROP_UPDATED_AT_FUNCTION = """
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
"""


def _add_updated_at_trigger(table: str) -> None:
    """Add the update_updated_at_column trigger to a table.

    Called after each table that carries an updated_at column is created.
    The trigger fires BEFORE UPDATE and sets updated_at = NOW() server-side,
    providing a second layer of enforcement beyond the ORM's onupdate hook.

    Args:
        table: Database table name to attach the trigger to.
    """
    op.execute(
        f"""
        CREATE TRIGGER trg_{table}_updated_at
        BEFORE UPDATE ON {table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        """
    )


def _drop_updated_at_trigger(table: str) -> None:
    """Drop the update_updated_at_column trigger from a table.

    Args:
        table: Database table name.
    """
    op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")


# ===========================================================================
# upgrade()
# ===========================================================================


def upgrade() -> None:
    """Apply the complete initial schema to the database.

    Steps:
        1. Enable pg_uuidv7 extension.
        2. Create the updated_at trigger function.
        3. Create all tables in FK-dependency order.
        4. Create all composite and functional indexes.
        5. Attach updated_at triggers to tables that carry the column.
    """

    # ── 1. Extensions ────────────────────────────────────────────────────────
    # pg_uuidv7 C extension not available in postgres:alpine; use pure-SQL impl.
    op.execute("""
        CREATE OR REPLACE FUNCTION uuid_generate_v7()
        RETURNS uuid
        LANGUAGE sql
        VOLATILE PARALLEL SAFE
        AS $$
          SELECT encode(
            set_bit(
              set_bit(
                overlay(
                  uuid_send(gen_random_uuid())
                  placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                  FROM 1 FOR 6
                ),
                52, 1
              ),
              53, 1
            ),
            'hex'
          )::uuid
        $$
    """)
    # btree_gist is required for potential exclusion constraints in future.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # ── 2. Trigger function ───────────────────────────────────────────────────
    op.execute(_CREATE_UPDATED_AT_FUNCTION)

    # ── 3. categories ─────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column(
            "sort_order", sa.SmallInteger, nullable=False, server_default="0"
        ),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"], unique=True)
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])
    op.create_index(
        "ix_categories_active",
        "categories",
        ["is_active"],
        postgresql_where=sa.text("is_active = true"),
    )
    _add_updated_at_trigger("categories")

    # ── 4. users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "role", sa.String(20), nullable=False, server_default="student"
        ),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("avatar_r2_key", sa.String(512), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "is_email_verified",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "failed_login_count",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column("locked_until", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    # Unique index on LOWER(email) for case-insensitive lookup.
    op.execute(
        "CREATE UNIQUE INDEX ix_users_email_lower ON users (LOWER(email)) "
        "WHERE deleted_at IS NULL;"
    )
    # Active user lookup by role (used by admin dashboards).
    op.create_index(
        "ix_users_role_active",
        "users",
        ["role"],
        postgresql_where=sa.text("deleted_at IS NULL AND is_active = true"),
    )
    # Partial index: active, undeleted users only.
    op.create_index(
        "ix_users_active",
        "users",
        ["is_active"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    _add_updated_at_trigger("users")

    # ── 5. teacher_profiles ───────────────────────────────────────────────────
    op.create_table(
        "teacher_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("headline", sa.String(200), nullable=True),
        sa.Column("website_url", sa.String(512), nullable=True),
        sa.Column(
            "social_links",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "total_students", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "total_courses", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "total_revenue",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_teacher_profiles_user_id", "teacher_profiles", ["user_id"], unique=True
    )
    _add_updated_at_trigger("teacher_profiles")

    # ── 6. student_profiles ───────────────────────────────────────────────────
    op.create_table(
        "student_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("date_of_birth", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("college", sa.String(200), nullable=True),
        sa.Column("graduation_year", sa.SmallInteger, nullable=True),
        sa.Column(
            "preferred_language",
            sa.String(10),
            nullable=False,
            server_default="en",
        ),
        sa.Column(
            "total_courses_enrolled",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "total_courses_completed",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_student_profiles_user_id", "student_profiles", ["user_id"], unique=True
    )
    _add_updated_at_trigger("student_profiles")

    # ── 7. refresh_tokens ─────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("device_fingerprint", sa.String(512), nullable=True),
        sa.Column("ip_address", postgresql.INET, nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column(
            "issued_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "replaced_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"]
    )
    op.create_index(
        "ix_refresh_tokens_token_hash",
        "refresh_tokens",
        ["token_hash"],
        unique=True,
    )
    # Partial index: active tokens only (not revoked, not expired).
    op.create_index(
        "ix_refresh_tokens_active",
        "refresh_tokens",
        ["user_id", "expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )

    # ── 8. user_sessions ──────────────────────────────────────────────────────
    op.create_table(
        "user_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "refresh_token_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("refresh_tokens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ip_address", postgresql.INET, nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("device_type", sa.String(50), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "last_seen_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index(
        "ix_user_sessions_active",
        "user_sessions",
        ["user_id"],
        postgresql_where=sa.text("is_active = true"),
    )

    # ── 9. password_reset_tokens ──────────────────────────────────────────────
    op.create_table(
        "password_reset_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_password_reset_tokens_user_id",
        "password_reset_tokens",
        ["user_id"],
    )
    # Partial index: unused, non-expired tokens — the only ones ever queried.
    op.create_index(
        "ix_password_reset_tokens_valid",
        "password_reset_tokens",
        ["token_hash"],
        postgresql_where=sa.text("used_at IS NULL"),
    )

    # ── 10. email_verification_tokens ─────────────────────────────────────────
    op.create_table(
        "email_verification_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("new_email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_email_verification_tokens_user_id",
        "email_verification_tokens",
        ["user_id"],
    )
    op.create_index(
        "ix_email_verification_tokens_valid",
        "email_verification_tokens",
        ["token_hash"],
        postgresql_where=sa.text("used_at IS NULL"),
    )

    # ── 11. courses ───────────────────────────────────────────────────────────
    op.create_table(
        "courses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(350), nullable=False, unique=True),
        sa.Column("tagline", sa.String(200), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="draft"
        ),
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
        ),
        sa.Column(
            "level",
            sa.String(20),
            nullable=False,
            server_default="beginner",
        ),
        sa.Column(
            "price", sa.Numeric(10, 2), nullable=False, server_default="0.00"
        ),
        sa.Column(
            "currency", sa.String(3), nullable=False, server_default="INR"
        ),
        sa.Column("thumbnail_r2_key", sa.String(512), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column(
            "requirements",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "what_you_learn",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "total_students", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "total_videos", sa.SmallInteger, nullable=False, server_default="0"
        ),
        sa.Column(
            "total_pdfs", sa.SmallInteger, nullable=False, server_default="0"
        ),
        sa.Column(
            "total_duration_seconds",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "published_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_courses_slug", "courses", ["slug"], unique=True)
    op.create_index("ix_courses_teacher_id", "courses", ["teacher_id"])
    op.create_index(
        "ix_courses_status_visibility",
        "courses",
        ["status", "visibility"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_courses_published",
        "courses",
        ["published_at"],
        postgresql_where=sa.text("status = 'published' AND deleted_at IS NULL"),
    )
    _add_updated_at_trigger("courses")

    # ── 12. course_categories ─────────────────────────────────────────────────
    op.create_table(
        "course_categories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "is_primary", sa.Boolean, nullable=False, server_default="false"
        ),
    )
    op.create_index(
        "ix_course_categories_course_id", "course_categories", ["course_id"]
    )
    op.create_index(
        "ix_course_categories_category_id",
        "course_categories",
        ["category_id"],
    )
    # Enforce one-primary-per-course.
    op.create_index(
        "uq_course_categories_primary",
        "course_categories",
        ["course_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )
    # Prevent duplicate course+category pairs.
    op.create_index(
        "uq_course_categories_pair",
        "course_categories",
        ["course_id", "category_id"],
        unique=True,
    )

    # ── 13. payments ──────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("razorpay_order_id", sa.String(100), nullable=False, unique=True),
        sa.Column("razorpay_payment_id", sa.String(100), nullable=True),
        sa.Column("razorpay_signature", sa.String(256), nullable=True),
        sa.Column(
            "amount", sa.Numeric(10, 2), nullable=False
        ),
        sa.Column(
            "currency", sa.String(3), nullable=False, server_default="INR"
        ),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="created"
        ),
        sa.Column(
            "refund_status",
            sa.String(20),
            nullable=False,
            server_default="none",
        ),
        sa.Column("refund_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("refunded_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "captured_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_payments_student_id", "payments", ["student_id"])
    op.create_index("ix_payments_course_id", "payments", ["course_id"])
    op.create_index(
        "ix_payments_status",
        "payments",
        ["status"],
    )
    op.create_index(
        "ix_payments_razorpay_order_id",
        "payments",
        ["razorpay_order_id"],
        unique=True,
    )
    _add_updated_at_trigger("payments")

    # ── 14. payment_history ───────────────────────────────────────────────────
    op.create_table(
        "payment_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_payment_history_payment_id", "payment_history", ["payment_id"]
    )

    # ── 15. course_enrollments ────────────────────────────────────────────────
    op.create_table(
        "course_enrollments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="active"
        ),
        sa.Column("enrolled_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "progress_percent",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_course_enrollments_student_id",
        "course_enrollments",
        ["student_id"],
    )
    op.create_index(
        "ix_course_enrollments_course_id",
        "course_enrollments",
        ["course_id"],
    )
    # Prevent duplicate enrollment.
    op.create_index(
        "uq_course_enrollments_student_course",
        "course_enrollments",
        ["student_id", "course_id"],
        unique=True,
    )
    _add_updated_at_trigger("course_enrollments")

    # ── 16. content_progress ─────────────────────────────────────────────────
    op.create_table(
        "content_progress",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "enrollment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("course_enrollments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content_type", sa.String(20), nullable=False),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "watch_seconds", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "is_completed",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_position_seconds", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_content_progress_enrollment_id",
        "content_progress",
        ["enrollment_id"],
    )
    op.create_index(
        "ix_content_progress_student_id",
        "content_progress",
        ["student_id"],
    )
    op.create_index(
        "uq_content_progress_entry",
        "content_progress",
        ["enrollment_id", "content_type", "content_id"],
        unique=True,
    )
    _add_updated_at_trigger("content_progress")

    # ── 17. videos ────────────────────────────────────────────────────────────
    op.create_table(
        "videos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("r2_key", sa.String(512), nullable=True),
        sa.Column("thumbnail_r2_key", sa.String(512), nullable=True),
        sa.Column(
            "processing_status",
            sa.String(20),
            nullable=False,
            server_default="uploading",
        ),
        sa.Column(
            "upload_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("sort_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
        ),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_videos_course_id", "videos", ["course_id"])
    op.create_index(
        "ix_videos_active",
        "videos",
        ["course_id", "sort_order"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    _add_updated_at_trigger("videos")

    # ── 18. pdfs ──────────────────────────────────────────────────────────────
    op.create_table(
        "pdfs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("r2_key", sa.String(512), nullable=True),
        sa.Column(
            "upload_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "visibility",
            sa.String(20),
            nullable=False,
            server_default="private",
        ),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("sort_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_pdfs_course_id", "pdfs", ["course_id"])
    _add_updated_at_trigger("pdfs")

    # ── 19. assignments ───────────────────────────────────────────────────────
    op.create_table(
        "assignments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("max_score", sa.SmallInteger, nullable=False, server_default="100"),
        sa.Column("due_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "is_published",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_assignments_course_id", "assignments", ["course_id"])
    _add_updated_at_trigger("assignments")

    # ── 20. assignment_submissions ────────────────────────────────────────────
    op.create_table(
        "assignment_submissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "assignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "enrollment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("course_enrollments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("submission_text", sa.Text, nullable=True),
        sa.Column("attachment_r2_key", sa.String(512), nullable=True),
        sa.Column("score", sa.SmallInteger, nullable=True),
        sa.Column("feedback", sa.Text, nullable=True),
        sa.Column("graded_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "submitted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_assignment_submissions_assignment_id",
        "assignment_submissions",
        ["assignment_id"],
    )
    op.create_index(
        "ix_assignment_submissions_student_id",
        "assignment_submissions",
        ["student_id"],
    )
    op.create_index(
        "uq_assignment_submissions_student",
        "assignment_submissions",
        ["assignment_id", "student_id"],
        unique=True,
    )
    _add_updated_at_trigger("assignment_submissions")

    # ── 21. meetings ──────────────────────────────────────────────────────────
    op.create_table(
        "meetings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.SmallInteger, nullable=False, server_default="60"),
        sa.Column("meeting_url", sa.String(512), nullable=True),
        sa.Column("recording_r2_key", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_meetings_course_id", "meetings", ["course_id"])
    op.create_index(
        "ix_meetings_scheduled_at",
        "meetings",
        ["scheduled_at"],
        postgresql_where=sa.text("status != 'cancelled'"),
    )
    _add_updated_at_trigger("meetings")

    # ── 22. session_attendance ────────────────────────────────────────────────
    op.create_table(
        "session_attendance",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="absent",
        ),
        sa.Column("joined_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("left_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_session_attendance_meeting_id",
        "session_attendance",
        ["meeting_id"],
    )
    op.create_index(
        "uq_session_attendance_student",
        "session_attendance",
        ["meeting_id", "student_id"],
        unique=True,
    )
    _add_updated_at_trigger("session_attendance")

    # ── 23. attendance_events ─────────────────────────────────────────────────
    op.create_table(
        "attendance_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "session_attendance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("session_attendance.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_attendance_events_session_attendance_id",
        "attendance_events",
        ["session_attendance_id"],
    )

    # ── 24. chat_rooms ────────────────────────────────────────────────────────
    op.create_table(
        "chat_rooms",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_chat_rooms_course_id", "chat_rooms", ["course_id"], unique=True
    )
    _add_updated_at_trigger("chat_rooms")

    # ── 25. messages ──────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "chat_room_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_rooms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "content_type",
            sa.String(20),
            nullable=False,
            server_default="text",
        ),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("attachment_r2_key", sa.String(512), nullable=True),
        sa.Column(
            "is_pinned", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_messages_chat_room_id", "messages", ["chat_room_id"]
    )
    op.create_index(
        "ix_messages_sender_id", "messages", ["sender_id"]
    )
    op.create_index(
        "ix_messages_active",
        "messages",
        ["chat_room_id", "created_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    _add_updated_at_trigger("messages")

    # ── 26. message_reactions ─────────────────────────────────────────────────
    op.create_table(
        "message_reactions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("emoji", sa.String(10), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_message_reactions_message_id",
        "message_reactions",
        ["message_id"],
    )
    # One reaction per user per emoji per message.
    op.create_index(
        "uq_message_reactions_user_emoji",
        "message_reactions",
        ["message_id", "user_id", "emoji"],
        unique=True,
    )

    # ── 27. notifications ─────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column(
            "data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "is_read", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_notifications_recipient_id",
        "notifications",
        ["recipient_id"],
    )
    op.create_index(
        "ix_notifications_unread",
        "notifications",
        ["recipient_id", "created_at"],
        postgresql_where=sa.text("is_read = false"),
    )

    # ── 28. notification_preferences ─────────────────────────────────────────
    op.create_table(
        "notification_preferences",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column(
            "channel",
            sa.String(20),
            nullable=False,
            server_default="in_app",
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_notification_preferences_user_id",
        "notification_preferences",
        ["user_id"],
    )
    op.create_index(
        "uq_notification_preferences_type_channel",
        "notification_preferences",
        ["user_id", "notification_type", "channel"],
        unique=True,
    )
    _add_updated_at_trigger("notification_preferences")

    # ── 29. audit_logs ────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v7()"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("ip_address", postgresql.INET, nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column(
            "old_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "new_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index(
        "ix_audit_logs_action", "audit_logs", ["action"]
    )
    op.create_index(
        "ix_audit_logs_resource",
        "audit_logs",
        ["resource_type", "resource_id"],
    )
    op.create_index(
        "ix_audit_logs_severity",
        "audit_logs",
        ["severity", "created_at"],
        postgresql_where=sa.text("severity IN ('warning', 'critical')"),
    )
    # Audit logs are append-only; no updated_at trigger.


# ===========================================================================
# downgrade()
# ===========================================================================


def downgrade() -> None:
    """Drop the complete schema in reverse FK-dependency order.

    All tables are dropped with CASCADE to handle any FK references
    that may have been added outside this migration. The extension
    and trigger function are removed last.
    """
    # Reverse of upgrade() creation order.
    op.drop_table("audit_logs")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("message_reactions")
    op.drop_table("messages")
    op.drop_table("chat_rooms")
    op.drop_table("attendance_events")
    op.drop_table("session_attendance")
    op.drop_table("meetings")
    op.drop_table("assignment_submissions")
    op.drop_table("assignments")
    op.drop_table("pdfs")
    op.drop_table("videos")
    op.drop_table("content_progress")
    op.drop_table("course_enrollments")
    op.drop_table("payment_history")
    op.drop_table("payments")
    op.drop_table("course_categories")
    op.drop_table("courses")
    op.drop_table("email_verification_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("user_sessions")
    op.drop_table("refresh_tokens")
    op.drop_table("student_profiles")
    op.drop_table("teacher_profiles")
    op.drop_table("users")
    op.drop_table("categories")

    # Clean up functions and extensions.
    op.execute(_DROP_UPDATED_AT_FUNCTION)
    op.execute("DROP EXTENSION IF EXISTS btree_gist;")
    op.execute("DROP EXTENSION IF EXISTS pg_uuidv7;")
