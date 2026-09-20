"""Add missing payment columns and enrollment expiry.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    statements = [
        # --- payments: missing columns ---
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_code VARCHAR(100) DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_id VARCHAR(100) DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) NOT NULL DEFAULT 'none';",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_r2_key VARCHAR(512) DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS ip_address INET DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(256) DEFAULT NULL;",
        # --- payment_history table ---
        """
        CREATE TABLE IF NOT EXISTS payment_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
            from_status VARCHAR(20),
            to_status VARCHAR(20) NOT NULL,
            event VARCHAR(100) NOT NULL,
            actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_payment_history_payment_id ON payment_history(payment_id);",
        # --- course_enrollments: expiry for monthly subscription ---
        "ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;",
        "ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS payment_id UUID DEFAULT NULL;",
        # --- safe unique index on nullable razorpay_payment_id ---
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_rzp_payment_id ON payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;",
    ]
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
        except Exception as e:
            print(f"[Migration 0004] Warning (non-fatal): {e}")


def downgrade() -> None:
    pass
