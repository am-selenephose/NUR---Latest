"""NUR B+ starvation-free Omega ingestion receipts.

Revision ID: 0061_nur_bplus_ingest_receipts
Revises: 0060_nur_bplus_projection_links
"""

from alembic import op

revision = "0061_nur_bplus_ingest_receipts"
down_revision = "0060_nur_bplus_projection_links"
branch_labels = None
depends_on = None

APP_ROLE = "nur_app"
OWNER_UUID = "NULLIF(current_setting('app.current_user_id', true), '')::uuid"
HAS_USER = (
    "current_setting('app.current_user_id', true) IS NOT NULL "
    "AND current_setting('app.current_user_id', true) <> ''"
)


def _owner_policy(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {table}_owner_isolation ON {table} "
        f"USING ({HAS_USER} AND owner_user_id = {OWNER_UUID}) "
        f"WITH CHECK ({HAS_USER} AND owner_user_id = {OWNER_UUID})"
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON {table} TO {APP_ROLE}")


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE omega_ingestion_receipts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            source_kind varchar(48) NOT NULL,
            source_id uuid NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'RETRYABLE',
            experience_id uuid REFERENCES omega_experiences(id) ON DELETE SET NULL,
            attempt_count integer NOT NULL DEFAULT 0,
            error_code varchar(96),
            error_summary varchar(240),
            first_seen_at timestamptz NOT NULL DEFAULT now(),
            last_attempt_at timestamptz,
            completed_at timestamptz,
            CONSTRAINT uq_omega_ingestion_receipt_source UNIQUE (
                owner_user_id, source_kind, source_id
            ),
            CONSTRAINT ck_omega_ingestion_receipt_status CHECK (
                status IN ('PROCESSED','IGNORED','RETRYABLE','QUARANTINED','INVALIDATED')
            ),
            CONSTRAINT ck_omega_ingestion_receipt_attempts CHECK (attempt_count >= 0)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_omega_ingestion_receipts_owner_status "
        "ON omega_ingestion_receipts(owner_user_id, status, first_seen_at)"
    )
    _owner_policy("omega_ingestion_receipts")


def downgrade() -> None:
    op.execute("DROP TABLE omega_ingestion_receipts")
