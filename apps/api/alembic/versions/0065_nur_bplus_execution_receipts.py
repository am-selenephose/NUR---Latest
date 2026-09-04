"""Add broker execution receipt fields to Agency tool-call ledger.

Revision ID: 0065_bplus_execution_receipts
Revises: 0064_bplus_policy_replay
"""

from alembic import op

revision = "0065_bplus_execution_receipts"
down_revision = "0064_bplus_policy_replay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE agent_tool_calls "
        "ADD COLUMN capability_key varchar(80), "
        "ADD COLUMN adapter_key varchar(120), "
        "ADD COLUMN adapter_version varchar(80), "
        "ADD COLUMN result_digest varchar(71), "
        "ADD COLUMN external_effects jsonb NOT NULL DEFAULT '[]'::jsonb, "
        "ADD COLUMN artifact_refs jsonb NOT NULL DEFAULT '[]'::jsonb, "
        "ADD COLUMN verification_verdict varchar(24), "
        "ADD COLUMN rollback_ref varchar(240)"
    )
    op.execute(
        "ALTER TABLE agent_tool_calls ADD CONSTRAINT "
        "ck_agent_tool_call_verification_verdict CHECK ("
        "verification_verdict IS NULL OR verification_verdict IN ("
        "'PASS','REVISE','FAIL','WARN','VERIFIER_ERROR'))"
    )
    op.execute(
        "CREATE INDEX ix_agent_tool_calls_owner_capability "
        "ON agent_tool_calls(owner_user_id, capability_key) "
        "WHERE capability_key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_agent_tool_calls_owner_capability")
    op.execute(
        "ALTER TABLE agent_tool_calls DROP CONSTRAINT IF EXISTS "
        "ck_agent_tool_call_verification_verdict"
    )
    for column in (
        "rollback_ref",
        "verification_verdict",
        "artifact_refs",
        "external_effects",
        "result_digest",
        "adapter_version",
        "adapter_key",
        "capability_key",
    ):
        op.execute(f"ALTER TABLE agent_tool_calls DROP COLUMN IF EXISTS {column}")
