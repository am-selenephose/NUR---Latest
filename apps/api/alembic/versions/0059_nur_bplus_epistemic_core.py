"""NUR B+ canonical Omega epistemic schema.

Revision ID: 0059_nur_bplus_epistemic_core
Revises: 0058_agentic_insights_engine
"""

from alembic import op

revision = "0059_nur_bplus_epistemic_core"
down_revision = "0058_agentic_insights_engine"
branch_labels = None
depends_on = None

APP_ROLE = "nur_app"
OWNER_UUID = "NULLIF(current_setting('app.current_user_id', true), '')::uuid"
HAS_USER = (
    "current_setting('app.current_user_id', true) IS NOT NULL "
    "AND current_setting('app.current_user_id', true) <> ''"
)


def _owner_policy(table: str, grants: str = "SELECT, INSERT, UPDATE") -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {table}_owner_isolation ON {table} "
        f"USING ({HAS_USER} AND owner_user_id = {OWNER_UUID}) "
        f"WITH CHECK ({HAS_USER} AND owner_user_id = {OWNER_UUID})"
    )
    op.execute(f"GRANT {grants} ON {table} TO {APP_ROLE}")

def upgrade() -> None:
    op.execute("""
        ALTER TABLE omega_claims
            ADD COLUMN subject_ref varchar(240),
            ADD COLUMN predicate varchar(120),
            ADD COLUMN object_value jsonb NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN scope varchar(32) NOT NULL DEFAULT 'PRIVATE_ORBIT',
            ADD COLUMN valid_from timestamptz,
            ADD COLUMN valid_until timestamptz,
            ADD COLUMN epistemic_status varchar(24) NOT NULL DEFAULT 'HYPOTHESIS',
            ADD COLUMN authority_status varchar(32) NOT NULL DEFAULT 'LEGACY_UNRESOLVED',
            ADD COLUMN uncertainty_kind varchar(48),
            ADD COLUMN falsification_condition text,
            ADD COLUMN current_version integer NOT NULL DEFAULT 1,
            ADD CONSTRAINT ck_omega_claim_epistemic_status CHECK (
                epistemic_status IN (
                    'OBSERVED','INFERRED','HYPOTHESIS','CONTESTED',
                    'CONTRADICTED','SUPERSEDED','RETIRED'
                )
            ),
            ADD CONSTRAINT ck_omega_claim_authority_status CHECK (
                authority_status IN (
                    'MODEL_PROPOSED','OWNER_STATED','OWNER_CONFIRMED',
                    'OWNER_CORRECTED','SYSTEM_MEASURED','RESEARCH_DERIVED',
                    'LEGACY_UNRESOLVED'
                )
            ),
            ADD CONSTRAINT ck_omega_claim_current_version CHECK (current_version >= 1)
    """)
    op.execute("""
        UPDATE omega_claims
        SET epistemic_status = CASE truth_status
            WHEN 'OBSERVED' THEN 'OBSERVED'
            WHEN 'INFERRED' THEN 'INFERRED'
            WHEN 'HYPOTHESIS' THEN 'HYPOTHESIS'
            WHEN 'CONTRADICTED' THEN 'CONTRADICTED'
            WHEN 'SUPERSEDED' THEN 'SUPERSEDED'
            WHEN 'RETIRED' THEN 'RETIRED'
            ELSE 'HYPOTHESIS'
        END
    """)
    op.execute("""
        UPDATE omega_claims AS claim
        SET authority_status = CASE
            WHEN EXISTS (
                SELECT 1 FROM omega_evidence_edges edge
                WHERE edge.claim_id = claim.id
                  AND edge.note = 'created from OWNER_WRITTEN'
            ) THEN 'OWNER_STATED'
            WHEN EXISTS (
                SELECT 1 FROM omega_evidence_edges edge
                WHERE edge.claim_id = claim.id
                  AND edge.note = 'created from USER_CORRECTION'
            ) THEN 'OWNER_CORRECTED'
            WHEN EXISTS (
                SELECT 1 FROM omega_evidence_edges edge
                WHERE edge.claim_id = claim.id
                  AND edge.note IN ('created from SYSTEM_MEASURED', 'created from OBSERVED_OUTCOME')
            ) THEN 'SYSTEM_MEASURED'
            ELSE 'LEGACY_UNRESOLVED'
        END
    """)
    op.execute("""
        ALTER TABLE omega_claims
            ADD CONSTRAINT uq_omega_claim_id_owner UNIQUE (id, owner_user_id)
    """)
    op.execute("""
        CREATE TABLE omega_claim_versions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            claim_id uuid NOT NULL,
            version integer NOT NULL CHECK (version >= 1),
            snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
            why_changed_id uuid REFERENCES why_changed_records(id) ON DELETE SET NULL,
            change_class varchar(48) NOT NULL DEFAULT 'CREATED',
            actor varchar(32) NOT NULL DEFAULT 'system',
            evidence_digest varchar(64),
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_omega_claim_version UNIQUE(owner_user_id, claim_id, version),
            CONSTRAINT fk_omega_claim_version_owner
                FOREIGN KEY (claim_id, owner_user_id)
                REFERENCES omega_claims(id, owner_user_id)
                ON DELETE CASCADE
        )
    """)
    op.execute("""
        CREATE INDEX ix_omega_claim_versions_owner_claim
            ON omega_claim_versions(owner_user_id, claim_id, version DESC)
    """)
    _owner_policy("omega_claim_versions", "SELECT, INSERT")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS omega_claim_versions CASCADE")
    op.execute("ALTER TABLE omega_claims DROP CONSTRAINT IF EXISTS uq_omega_claim_id_owner")
    for constraint in (
        "ck_omega_claim_current_version",
        "ck_omega_claim_authority_status",
        "ck_omega_claim_epistemic_status",
    ):
        op.execute(f"ALTER TABLE omega_claims DROP CONSTRAINT IF EXISTS {constraint}")
    for column in (
        "current_version",
        "falsification_condition",
        "uncertainty_kind",
        "authority_status",
        "epistemic_status",
        "valid_until",
        "valid_from",
        "scope",
        "object_value",
        "predicate",
        "subject_ref",
    ):
        op.execute(f"ALTER TABLE omega_claims DROP COLUMN IF EXISTS {column}")