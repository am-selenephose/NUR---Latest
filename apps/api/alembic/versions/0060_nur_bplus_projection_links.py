"""NUR B+ projection links to canonical Omega claims.

Revision ID: 0060_nur_bplus_projection_links
Revises: 0059_nur_bplus_epistemic_core
"""

from alembic import op

revision = "0060_nur_bplus_projection_links"
down_revision = "0059_nur_bplus_epistemic_core"
branch_labels = None
depends_on = None

PROJECTION_TABLES = (
    "semantic_claims",
    "memories",
    "insights",
    "orbit_relational_insights",
)


def _add_projection_link(table: str) -> None:
    op.execute(
        f"ALTER TABLE {table} ADD COLUMN canonical_omega_claim_id uuid"
    )
    op.execute(
        f"ALTER TABLE {table} ADD CONSTRAINT fk_{table}_canonical_omega_owner "
        "FOREIGN KEY (canonical_omega_claim_id, owner_user_id) "
        "REFERENCES omega_claims(id, owner_user_id) ON DELETE RESTRICT"
    )
    op.execute(
        f"CREATE INDEX ix_{table}_owner_canonical_omega "
        f"ON {table}(owner_user_id, canonical_omega_claim_id) "
        "WHERE canonical_omega_claim_id IS NOT NULL"
    )


def upgrade() -> None:
    for table in PROJECTION_TABLES:
        _add_projection_link(table)
    op.execute(
        "CREATE UNIQUE INDEX uq_semantic_claims_owner_canonical_omega "
        "ON semantic_claims(owner_user_id, canonical_omega_claim_id) "
        "WHERE canonical_omega_claim_id IS NOT NULL"
    )
    # Deliberately no heuristic backfill. Legacy rows remain unlinked unless
    # an existing source/evidence relation proves a unique canonical identity.


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_semantic_claims_owner_canonical_omega")
    for table in reversed(PROJECTION_TABLES):
        op.execute(f"DROP INDEX IF EXISTS ix_{table}_owner_canonical_omega")
        op.execute(
            f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "
            f"fk_{table}_canonical_omega_owner"
        )
        op.execute(
            f"ALTER TABLE {table} DROP COLUMN IF EXISTS canonical_omega_claim_id"
        )
