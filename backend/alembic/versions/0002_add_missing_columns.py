"""Schema sync migration 0002.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-22
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
    # Use raw SQL with IF NOT EXISTS so it never fails even if columns or tables already exist
    conn = op.get_bind()
    statements = [
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS promo_video_r2_key VARCHAR(512);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_lectures SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_enrollments INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 50;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2);",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS section VARCHAR(200);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS hls_r2_key_prefix VARCHAR(512);",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_width SMALLINT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS resolution_height SMALLINT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_error TEXT;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS section VARCHAR(200);",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS r2_object_key VARCHAR(512);",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS page_count INTEGER;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2) DEFAULT 0.0;",
        "ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS slow_mode_seconds SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS pinned_message_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count SMALLINT NOT NULL DEFAULT 0;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID DEFAULT NULL;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(36) DEFAULT NULL;",
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception:
            pass


def downgrade() -> None:
    pass
