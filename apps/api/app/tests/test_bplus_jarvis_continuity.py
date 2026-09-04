from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.brain.schemas import ScopeEnvelope
from app.models import OmegaClaim, OmegaClaimVersion, Outcome, Prediction
from app.tests.conftest import register_user


def H(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def _seed_strategy_a(client, app_engine):
    from app.omega.prediction_v2 import register_prediction

    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    orbit = uuid.UUID((await client.get("/api/v1/orbits")).json()[0]["id"])
    created = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "Strategy A is the preferred migration-throughput strategy.",
            "claim_type": "DECISION",
            "truth_status": "INFERRED",
            "provenance_label": "MODEL_GENERATED",
            "orbit_id": str(orbit),
            "subject_ref": "strategy:migration-throughput",
            "predicate": "preferred_strategy",
            "object_value": {"value": "Strategy A"},
            "falsification_condition": "completion_minutes > 60",
            "confidence": 0.75,
        },
    )
    assert created.status_code == 201, created.text
    claim = created.json()
    confirmed = await client.post(
        f"/api/v1/omega/claims/{claim['id']}/confirm", headers=H(client)
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["current_version"] == 2

    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        prediction = await register_prediction(
            db,
            owner_user_id=owner,
            orbit_id=orbit,
            statement="Strategy A will keep migration completion at or below 60 minutes.",
            expected_observation={
                "metric": "completion_minutes",
                "operator": "<=",
                "value": 60,
            },
            metric="completion_minutes",
            confidence=Decimal("0.750"),
            horizon_days=7,
            falsification_condition="completion_minutes > 60",
            omega_claim_id=uuid.UUID(claim["id"]),
        )
        prediction_id = prediction.id
        await db.commit()
    return owner, orbit, uuid.UUID(claim["id"]), prediction_id


async def test_contradicting_outcome_versions_claim_and_survives_as_continuity_receipt(
    client, app_engine
):
    from app.mind.unified_state import build_unified_cognitive_state
    from app.omega.workspace_service import build_workspace_frame

    owner, orbit, claim_id, prediction_id = await _seed_strategy_a(client, app_engine)
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        outcome = Outcome(
            owner_user_id=owner,
            observed_result="Strategy A migration took 92 minutes.",
            structured_measurements={"completion_minutes": 92},
        )
        db.add(outcome)
        await db.commit()
        outcome_id = outcome.id

    run = await client.post(
        "/api/v1/omega/consolidate",
        headers=H(client),
        json={"orbit_id": str(orbit), "run_kind": "MANUAL"},
    )
    assert run.status_code == 200, run.text
    assert run.json()["predictions_resolved"] == 1

    scope = ScopeEnvelope(
        owner_user_id=owner,
        orbit_id=orbit,
        sharing_boundary="ORBIT",
        reason="Task13 same-task continuity proof",
    )
    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        frame = await build_workspace_frame(
            db,
            owner_user_id=owner,
            task_mode="talk",
            active_question="Which migration-throughput strategy should I use?",
            scope_envelope=scope,
            orbit_id=orbit,
        )
        state = await build_unified_cognitive_state(
            db,
            owner_user_id=owner,
            active_question="Which migration-throughput strategy should I use?",
            scope_envelope=scope,
            workspace_frame=frame,
            semantic_projection={},
            retrieved_refs=[],
        )
        claim = await db.get(OmegaClaim, claim_id)
        prediction = await db.get(Prediction, prediction_id)
        versions = (await db.execute(
            select(OmegaClaimVersion)
            .where(OmegaClaimVersion.owner_user_id == owner, OmegaClaimVersion.claim_id == claim_id)
            .order_by(OmegaClaimVersion.version)
        )).scalars().all()

    assert prediction.resolution == "CONTRADICTED"
    assert prediction.resolved_outcome_id == outcome_id
    assert claim.truth_status == "CONTRADICTED"
    assert claim.epistemic_status == "CONTRADICTED"
    assert claim.authority_status == "OWNER_CONFIRMED"
    assert claim.current_version == 3
    assert [row.version for row in versions] == [1, 2, 3]

    receipts = state.continuity_receipts
    assert len(receipts) == 1
    receipt = receipts[0]
    assert receipt["claim_id"] == str(claim_id)
    assert receipt["claim_version"] == 3
    assert receipt["claim_version_id"] == str(versions[-1].id)
    assert receipt["prediction_id"] == str(prediction_id)
    assert receipt["prediction_resolution"] == "CONTRADICTED"
    assert receipt["outcome_id"] == str(outcome_id)

    available = {f"{row['kind']}:{row['id']}" for row in state.evidence_refs}
    assert f"OMEGA_CLAIM_VERSION:{versions[-1].id}" in available
    assert f"PREDICTION:{prediction_id}" in available
    assert f"OUTCOME:{outcome_id}" in available


async def test_later_same_task_turn_changes_recommendation_and_cites_persisted_receipts(
    client, app_engine, monkeypatch
):
    from types import SimpleNamespace

    from app.brain.schemas import BrainProfileKey, CognitiveResult
    from app.brain.tracing import BrainTrace
    from app.mind.cognitive_loop import run_mind_cognitive_loop
    from app.models import ModelRunSource

    owner, orbit, claim_id, prediction_id = await _seed_strategy_a(client, app_engine)
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)

    async def continuity_brain(packet, event_sink=None):
        receipts = packet.omega_context.get("continuity_receipts", [])
        if receipts:
            receipt = receipts[0]
            response = "Strategy B — Strategy A was contradicted by the persisted outcome."
            refs = list(receipt["source_refs"])
        else:
            assert any("Strategy A" in belief for belief in packet.active_beliefs)
            assert any(
                "Strategy A" in row["statement"]
                for row in packet.omega_context.get("predictions", [])
            )
            response = "Strategy A — current canonical state still supports this path."
            refs = []
        return (
            CognitiveResult(
                task_id=packet.task_id,
                profile_used=BrainProfileKey.BALANCED,
                direct_response=response,
                source_refs=refs,
                decision_summary="Task13 recommendation derived only from persisted packet state.",
            ),
            BrainTrace(
                task_id=packet.task_id,
                profile_key="balanced",
                route_reason="Task13 deterministic continuity proof",
            ),
        )

    monkeypatch.setattr("app.mind.cognitive_loop.run_brain_step", continuity_brain)
    monkeypatch.setattr(
        "app.cognition.intelligence_kernel.get_ai_provider",
        lambda: SimpleNamespace(name="openai"),
    )

    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        first = await run_mind_cognitive_loop(
            db,
            owner_user_id=owner,
            orbit_id=orbit,
            user_line="Which migration-throughput strategy should I use?",
            requested_capability_id="capability:contextual_answer",
        )
        await db.commit()
    assert first.output.direct_response.startswith("Strategy A")
    assert first.verification.verdict == "PASS"

    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        outcome = Outcome(
            owner_user_id=owner,
            observed_result="Strategy A migration took 92 minutes.",
            structured_measurements={"completion_minutes": 92},
        )
        db.add(outcome)
        await db.commit()
        outcome_id = outcome.id

    consolidated = await client.post(
        "/api/v1/omega/consolidate",
        headers=H(client),
        json={"orbit_id": str(orbit), "run_kind": "MANUAL"},
    )
    assert consolidated.status_code == 200, consolidated.text
    assert consolidated.json()["predictions_resolved"] == 1

    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        second = await run_mind_cognitive_loop(
            db,
            owner_user_id=owner,
            orbit_id=orbit,
            user_line="Which migration-throughput strategy should I use?",
            requested_capability_id="capability:contextual_answer",
        )
        sources = (await db.execute(select(ModelRunSource).where(
            ModelRunSource.owner_user_id == owner,
            ModelRunSource.model_run_id == second.model_run_id,
        ))).scalars().all()
        versions = (await db.execute(select(OmegaClaimVersion).where(
            OmegaClaimVersion.owner_user_id == owner,
            OmegaClaimVersion.claim_id == claim_id,
        ).order_by(OmegaClaimVersion.version))).scalars().all()
        await db.commit()

    assert second.output.direct_response.startswith("Strategy B")
    assert second.verification.verdict == "PASS"
    assert second.verification.checks["missing_source_refs"] == []
    expected_refs = {
        f"OMEGA_CLAIM_VERSION:{versions[-1].id}",
        f"PREDICTION:{prediction_id}",
        f"OUTCOME:{outcome_id}",
    }
    assert set(second.output.source_refs) == expected_refs
    persisted_refs = {
        f"{row.source_kind}:{row.source_id}"
        for row in sources
        if row.source_id is not None
    }
    assert expected_refs <= persisted_refs

    why = await client.get(f"/api/v1/omega/claims/{claim_id}/why-changed")
    assert why.status_code == 200, why.text
    rendered = str(why.json()).lower()
    assert str(outcome_id) in rendered
    assert "chain_of_thought" not in rendered
    assert "hidden_reasoning" not in rendered


async def test_continuity_cannot_forge_authority_leak_scope_or_widen_agency(
    client, app_engine
):
    from app.learning.hardness.replay import (
        case,
        fixed_replay_corpus,
        run_policy_replay,
    )
    from app.mind.unified_state import build_unified_cognitive_state
    from app.models.agentic import AgentPolicy
    from app.omega.workspace_service import build_workspace_frame

    owner, orbit, claim_id, _ = await _seed_strategy_a(client, app_engine)
    other_orbit = next(
        uuid.UUID(row["id"])
        for row in (await client.get("/api/v1/orbits")).json()
        if row["id"] != str(orbit)
    )
    hidden = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "CROSS_SCOPE_SECRET_MARKER must never enter the Ambition packet.",
            "claim_type": "CONSTRAINT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
            "orbit_id": str(other_orbit),
        },
    )
    assert hidden.status_code == 201, hidden.text

    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        db.add(AgentPolicy(
            owner_user_id=owner,
            initiative_level="SUGGEST",
            max_risk_class="R1_PRIVATE_DRAFT",
            permitted_tools=["create_draft_plan"],
            auto_run_tools=[],
        ))
        await db.commit()

    # A different authenticated owner cannot manufacture OWNER_CONFIRMED authority.
    second, _, _ = await register_user(client)
    assert second.status_code == 201
    forged = await client.post(
        f"/api/v1/omega/claims/{claim_id}/confirm", headers=H(client)
    )
    assert forged.status_code == 404

    scope = ScopeEnvelope(
        owner_user_id=owner,
        orbit_id=orbit,
        sharing_boundary="ORBIT",
        reason="Task13 authority/scope/Agency invariant proof",
    )
    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        frame = await build_workspace_frame(
            db,
            owner_user_id=owner,
            task_mode="talk",
            active_question="Which migration-throughput strategy should I use?",
            scope_envelope=scope,
            orbit_id=orbit,
        )
        state = await build_unified_cognitive_state(
            db,
            owner_user_id=owner,
            active_question="Which migration-throughput strategy should I use?",
            scope_envelope=scope,
            workspace_frame=frame,
            semantic_projection={},
            retrieved_refs=[],
        )
        claim = await db.get(OmegaClaim, claim_id)
        policy = (await db.execute(select(AgentPolicy).where(
            AgentPolicy.owner_user_id == owner,
        ))).scalar_one()

    assert claim.authority_status == "OWNER_CONFIRMED"
    assert claim.current_version == 2
    rendered_state = str(state.model_dump(mode="json"))
    assert "CROSS_SCOPE_SECRET_MARKER" not in rendered_state

    replay = await run_policy_replay(
        baseline={"recency": 0.5, "query_relevance": 5.0, "authority_level": 1},
        candidate={"recency": 0.5, "query_relevance": 5.0, "authority_level": 2},
        corpus=fixed_replay_corpus([
            case(
                query="migration throughput strategy",
                expected_source="project:migration-throughput",
                owner_corrected=True,
            )
        ]),
    )
    assert replay.authority_widened is True
    assert replay.critical_gates_passed is False
    assert replay.status == "REJECTED"

    async with maker() as db:
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(owner)})
        policy_after = (await db.execute(select(AgentPolicy).where(
            AgentPolicy.owner_user_id == owner,
        ))).scalar_one()
    assert policy_after.permitted_tools == ["create_draft_plan"]
    assert policy_after.auto_run_tools == []
    assert policy_after.version == policy.version == 1
