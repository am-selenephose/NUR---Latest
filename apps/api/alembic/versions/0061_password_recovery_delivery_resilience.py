"""Add durable password-reset delivery claims and failure receipts.

Revision ID: 0061_pw_delivery_resilience
Revises: 0060_narrow_auth_rls_boundary
"""

from alembic import op

revision = "0061_pw_delivery_resilience"
down_revision = "0060_narrow_auth_rls_boundary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE password_reset_challenges
          ADD COLUMN delivery_claimed_at timestamptz,
          ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0,
          ADD COLUMN delivery_failure_code varchar(80),
          ADD COLUMN bounce_class varchar(24),
          ADD CONSTRAINT ck_password_reset_delivery_attempts
            CHECK (delivery_attempts >= 0 AND delivery_attempts <= 20)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE password_reset_challenges
          DROP CONSTRAINT IF EXISTS ck_password_reset_delivery_attempts,
          DROP COLUMN IF EXISTS bounce_class,
          DROP COLUMN IF EXISTS delivery_failure_code,
          DROP COLUMN IF EXISTS delivery_attempts,
          DROP COLUMN IF EXISTS delivery_claimed_at
        """
    )
