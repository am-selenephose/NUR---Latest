"""Repair OrbitContextLink canonical Omega projection schema parity.

Revision ID: 0062_bplus_orbit_ctx_link
Revises: 0061_nur_bplus_ingest_receipts
"""

from alembic import op

revision = "0062_bplus_orbit_ctx_link"
down_revision = "0061_nur_bplus_ingest_receipts"
branch_labels = None
depends_on = None

TABLE = "orbit_context_links"


def upgrade() -> None:
    op.execute(f"ALTER TABLE {TABLE} ADD COLUMN canonical_omega_claim_id uuid")
    op.execute(
        f"ALTER TABLE {TABLE} ADD CONSTRAINT fk_{TABLE}_canonical_omega_owner "
        "FOREIGN KEY (canonical_omega_claim_id, owner_user_id) "
        "REFERENCES omega_claims(id, owner_user_id) ON DELETE RESTRICT"
    )
    op.execute(
        f"CREATE INDEX ix_{TABLE}_owner_canonical_omega "
        f"ON {TABLE}(owner_user_id, canonical_omega_claim_id) "
        "WHERE canonical_omega_claim_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS ix_{TABLE}_owner_canonical_omega")
    op.execute(
        f"ALTER TABLE {TABLE} DROP CONSTRAINT IF EXISTS "
        f"fk_{TABLE}_canonical_omega_owner"
    )
    op.execute(
        f"ALTER TABLE {TABLE} DROP COLUMN IF EXISTS canonical_omega_claim_id"
    )
