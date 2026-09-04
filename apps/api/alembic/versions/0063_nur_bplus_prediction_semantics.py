"""NUR B+ canonical prediction semantics and legacy bridge links.

Revision ID: 0063_nur_bplus_prediction_v2
Revises: 0062_bplus_orbit_ctx_link
"""

from alembic import op

revision = "0063_nur_bplus_prediction_v2"
down_revision = "0062_bplus_orbit_ctx_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE predictions ADD COLUMN metric varchar(120)")
    op.execute("ALTER TABLE predictions ADD COLUMN falsification_condition text")
    op.execute(
        "ALTER TABLE predictions ADD COLUMN resolution_rule jsonb "
        "NOT NULL DEFAULT '{}'::jsonb"
    )
    op.execute(
        "ALTER TABLE predictions ADD COLUMN resolved_outcome_id uuid "
        "REFERENCES outcomes(id) ON DELETE SET NULL"
    )
    op.execute("ALTER TABLE predictions ADD COLUMN prediction_error numeric(12,6)")
    op.execute("ALTER TABLE predictions ADD COLUMN omega_claim_id uuid")
    op.execute("ALTER TABLE predictions ADD COLUMN legacy_omega_prediction_id uuid")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_omega_predictions_id_owner "
        "ON omega_predictions(id, owner_user_id)"
    )
    op.execute(
        "ALTER TABLE predictions ADD CONSTRAINT fk_predictions_omega_claim_owner "
        "FOREIGN KEY (omega_claim_id, owner_user_id) "
        "REFERENCES omega_claims(id, owner_user_id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE predictions ADD CONSTRAINT fk_predictions_legacy_omega_owner "
        "FOREIGN KEY (legacy_omega_prediction_id, owner_user_id) "
        "REFERENCES omega_predictions(id, owner_user_id) ON DELETE RESTRICT"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_predictions_owner_legacy_omega "
        "ON predictions(owner_user_id, legacy_omega_prediction_id) "
        "WHERE legacy_omega_prediction_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX ix_predictions_owner_omega_claim "
        "ON predictions(owner_user_id, omega_claim_id) "
        "WHERE omega_claim_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_predictions_owner_omega_claim")
    op.execute("DROP INDEX IF EXISTS uq_predictions_owner_legacy_omega")
    op.execute(
        "ALTER TABLE predictions DROP CONSTRAINT IF EXISTS "
        "fk_predictions_legacy_omega_owner"
    )
    op.execute(
        "ALTER TABLE predictions DROP CONSTRAINT IF EXISTS "
        "fk_predictions_omega_claim_owner"
    )
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS legacy_omega_prediction_id")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS omega_claim_id")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS prediction_error")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS resolved_outcome_id")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS resolution_rule")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS falsification_condition")
    op.execute("ALTER TABLE predictions DROP COLUMN IF EXISTS metric")
    op.execute("DROP INDEX IF EXISTS uq_omega_predictions_id_owner")
