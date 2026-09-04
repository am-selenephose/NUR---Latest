from __future__ import annotations

import json
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.agentic import handlers
from app.agentic.observability import new_trace
from app.agentic.runtime import run_step
from app.models.agentic import AgentPolicy, AgentStep, AgentWorkflow
from app.tests.conftest import register_user

SET_USER = "SELECT set_config('app.current_user_id', :uid, false)"
RECEIPT_COLUMNS = {
    "capability_key",
    "adapter_key",
    "adapter_version",
    "result_digest",
    "external_effects",
    "artifact_refs",
    "verification_verdict",
    "rollback_ref",
}


async def test_execution_receipt_schema_fields_exist_and_rls_stays_forced(super_engine):
    async with super_engine.connect() as conn:
        columns = {
            row[0]
            for row in (
                await conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema='public' AND table_name='agent_tool_calls'"
                    )
                )
            ).all()
        }
        forced = (
            await conn.execute(
                text(
                    "SELECT relforcerowsecurity FROM pg_class "
                    "WHERE oid='public.agent_tool_calls'::regclass"
                )
            )
        ).scalar_one()
    assert RECEIPT_COLUMNS <= columns
    assert forced is True


async def test_authorized_read_only_call_writes_complete_broker_receipt(client, app_engine):
    handlers.bind_read_only_handlers()
    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner)})
        db.add(
            AgentPolicy(
                owner_user_id=owner,
                initiative_level="INTERNAL",
                max_risk_class="R2_DURABLE_PRIVATE",
                permitted_tools=["get_timeline"],
                auto_run_tools=["get_timeline"],
            )
        )
        workflow = AgentWorkflow(
            owner_user_id=owner,
            kind="BPLUS_RECEIPT",
            title="receipt",
            objective="prove broker receipt",
            state="RUNNING",
        )
        db.add(workflow)
        await db.flush()
        step = AgentStep(
            owner_user_id=owner,
            workflow_id=workflow.id,
            ordinal=1,
            key="read",
            state="QUEUED",
            role="operator",
            tool_key="get_timeline",
            tool_version="1",
            risk_class="R0_READ_ONLY",
            input_refs={"limit": 3},
            depends_on=[],
        )
        db.add(step)
        await db.flush()
        step_id = step.id
        await db.commit()

        outcome = await run_step(
            db,
            owner_user_id=owner,
            step_id=step_id,
            trace=new_trace(),
            worker="bplus-receipt",
        )
        await db.commit()
        assert outcome["step_state"] == "SUCCEEDED", outcome
        receipt = (
            await db.execute(
                text(
                    "SELECT capability_key, adapter_key, adapter_version, result_digest, "
                    "external_effects, artifact_refs, verification_verdict, rollback_ref "
                    "FROM agent_tool_calls WHERE step_id=:step AND outcome='SUCCEEDED'"
                ),
                {"step": step_id},
            )
        ).mappings().one()

    assert receipt["capability_key"] == "app.read"
    assert receipt["adapter_key"] == "nur.first_party"
    assert receipt["adapter_version"] == "1"
    assert receipt["result_digest"].startswith("sha256:")
    assert receipt["external_effects"] == []
    assert receipt["artifact_refs"] == []
    assert receipt["verification_verdict"] == "PASS"
    assert receipt["rollback_ref"] is None


def test_receipt_input_digest_is_over_redacted_arguments():
    from app.agentic.runtime import _redacted_argument_digest

    first = _redacted_argument_digest("get_timeline", "1", {"token": "secret-a", "limit": 3})
    second = _redacted_argument_digest("get_timeline", "1", {"token": "secret-b", "limit": 3})
    assert first == second
    assert first.startswith("sha256:")


def test_receipt_metadata_redacts_secrets_and_uses_declared_artifact_contract():
    from app.agentic.runtime import _receipt_result_metadata

    metadata = _receipt_result_metadata(
        "save_private_artifact",
        {
            "created": True,
            "artifact_id": "artifact-123",
            "token": "secret-result-value",
            "nested": {"api_key": "secret-api-key"},
        },
    )
    rendered = json.dumps(metadata, sort_keys=True)
    assert "secret-result-value" not in rendered
    assert "secret-api-key" not in rendered
    assert metadata["result_digest"].startswith("sha256:")
    assert metadata["artifact_refs"] == ["artifact-123"]


def test_write_tool_receipt_metadata_declares_effect_without_inventing_rollback():
    from app.agentic.runtime import _receipt_result_metadata

    metadata = _receipt_result_metadata(
        "create_draft_plan",
        {"created": True, "plan_id": "plan-1", "provenance_label": "MODEL_GENERATED"},
    )
    assert metadata["external_effects"] == ["Draft Plan"]
    assert metadata["artifact_refs"] == []
    assert metadata["rollback_ref"] is None
