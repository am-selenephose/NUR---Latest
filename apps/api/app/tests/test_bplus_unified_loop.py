from __future__ import annotations

import inspect
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.brain.schemas import ScopeEnvelope
from app.db.rls import set_user_context
from app.tests.conftest import register_user


def H(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


def _semantic(owner: uuid.UUID, orbit: uuid.UUID, text: str) -> dict[str, list[dict]]:
    base = {"id": "projection-1", "owner_user_id": str(owner), "orbit_id": str(orbit)}
    return {
        "approved_memory": [{**base, "id": "memory-1", "status": "APPROVED", "content": "Keep the V197 visual contract exact."}],
        "memory_candidates": [],
        "beliefs": [{**base, "claim": text, "status": "ACTIVE", "confidence": 0.8}],
        "user_model_claims": [{**base, "claim": text, "status": "ACTIVE", "confidence": 0.8}],
        "research_results": [],
        "semantic_context": [{**base, "kind": "semantic_claim"}],
    }


async def _claim(client, orbit_id: str, text: str) -> dict:
    response = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": text,
            "claim_type": "PREFERENCE",
            "truth_status": "INFERRED",
            "provenance_label": "MODEL_GENERATED",
            "orbit_id": orbit_id,
            "confidence": 0.8,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_unified_state_is_scope_bound_and_carries_canonical_turn_context(
    client, super_engine
):
    from app.mind.unified_state import build_unified_cognitive_state

    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    orbit = uuid.UUID((await client.get("/api/v1/orbits")).json()[0]["id"])
    text = "Visual progress may help me focus."
    claim = await _claim(client, str(orbit), text)
    scope = ScopeEnvelope(
        owner_user_id=owner,
        orbit_id=orbit,
        sharing_boundary="ORBIT",
        reason="Task11 owner-orbit scope",
    )
    frame = SimpleNamespace(
        id=uuid.uuid4(),
        retrieved_claim_ids=[uuid.UUID(claim["id"])],
        retrieved_experience_ids=[],
        active_contradiction_ids=[],
        risk_flags=["scope_envelope_enforced"],
        scope_statement="Task11 owner-orbit scope",
        attention_items={
            "claim_summaries": [text],
            "score_explanations": {claim["id"]: {"query_relevance": 1.0}},
        },
    )
    retrieval = [{"kind": "DECISION", "id": "decision-1", "excerpt": "V197 is frozen.", "rank": 0.9}]

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner)
        state = await build_unified_cognitive_state(
            db,
            owner_user_id=owner,
            active_question="How do I preserve V197?",
            scope_envelope=scope,
            workspace_frame=frame,
            semantic_projection=_semantic(owner, orbit, text),
            retrieved_refs=retrieval,
            capability_context={"capability_id": "contextual.answer", "version": "1"},
        )

    assert state.owner_user_id == owner
    assert state.scope_envelope.scope_id == scope.scope_id
    assert state.canonical_claims[0]["id"] == claim["id"]
    assert state.approved_memories[0]["id"] == "memory-1"
    assert state.user_projections[0]["claim"] == text
    assert state.evidence_refs[0]["id"] == "decision-1"
    assert state.capabilities == [{"capability_id": "contextual.answer", "version": "1"}]
    assert state.attention_explanations[claim["id"]]["query_relevance"] == 1.0
    assert state.state_digest.startswith("sha256:")

    wrong_scope = scope.model_copy(update={"owner_user_id": uuid.uuid4()})
    async with AsyncSession(super_engine) as db:
        with pytest.raises(PermissionError):
            await build_unified_cognitive_state(
                db,
                owner_user_id=owner,
                active_question="blocked",
                scope_envelope=wrong_scope,
                workspace_frame=frame,
                semantic_projection=_semantic(owner, orbit, text),
                retrieved_refs=[],
            )


@pytest.mark.asyncio
async def test_packet_projects_from_unified_state_and_loop_builds_it_before_dispatch(
    client, super_engine
):
    from app.mind.cognitive_loop import run_mind_cognitive_loop
    from app.mind.context import build_cognitive_task_packet
    from app.mind.unified_state import build_unified_cognitive_state

    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    orbit = uuid.UUID((await client.get("/api/v1/orbits")).json()[0]["id"])
    text = "Canonical packet belief."
    claim = await _claim(client, str(orbit), text)
    scope = ScopeEnvelope(owner_user_id=owner, orbit_id=orbit, sharing_boundary="ORBIT")
    frame = SimpleNamespace(
        id=uuid.uuid4(), retrieved_claim_ids=[uuid.UUID(claim["id"])],
        retrieved_experience_ids=[], active_contradiction_ids=[], risk_flags=[],
        scope_statement="owner orbit", attention_items={"claim_summaries": [text], "score_explanations": {}},
    )
    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner)
        state = await build_unified_cognitive_state(
            db, owner_user_id=owner, active_question="question", scope_envelope=scope,
            workspace_frame=frame, semantic_projection=_semantic(owner, orbit, text),
            retrieved_refs=[{"kind": "MEMORY", "id": "m1", "excerpt": "evidence", "rank": 1.0}],
        )
        packet = await build_cognitive_task_packet(
            db,
            owner_user_id=owner,
            user_input="question",
            task_class="talk",
            orbit_id=orbit,
            unified_state=state,
        )

    assert packet.identity.version == state.identity.version
    assert packet.self_capabilities == state.self_capabilities
    assert packet.active_beliefs == state.active_beliefs
    assert packet.evidence_refs == state.evidence_refs
    assert packet.cognitive_state_version == state.contract_version
    assert packet.cognitive_state_digest == state.state_digest

    source = inspect.getsource(run_mind_cognitive_loop)
    resolve_at = source.index("await resolve_scope(")
    state_at = source.index("await build_unified_cognitive_state(")
    worker_at = source.index("WorkerDispatcher.dispatch(")
    brain_at = source.index("await run_brain_step(")
    assert resolve_at < state_at < min(worker_at, brain_at)
    packet_call = source[source.index("await build_cognitive_task_packet("):source.index("# 7. Initialize ModelRun")]
    assert "unified_state=unified_state" in packet_call
    assert "semantic_inputs=semantic_inputs" not in packet_call
    assert "workspace_frame=frame" not in packet_call


@pytest.mark.asyncio
async def test_canonical_claim_flag_shadow_parity_uses_same_visible_belief(
    client, super_engine, monkeypatch
):
    from app.core.config import get_settings
    from app.mind.unified_state import build_unified_cognitive_state

    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    orbit = uuid.UUID((await client.get("/api/v1/orbits")).json()[0]["id"])
    text = "One proposition, not two truths."
    claim = await _claim(client, str(orbit), text)
    scope = ScopeEnvelope(owner_user_id=owner, orbit_id=orbit, sharing_boundary="ORBIT")
    frame = SimpleNamespace(
        id=uuid.uuid4(), retrieved_claim_ids=[uuid.UUID(claim["id"])],
        retrieved_experience_ids=[], active_contradiction_ids=[], risk_flags=[],
        scope_statement="owner orbit", attention_items={"claim_summaries": [text], "score_explanations": {}},
    )
    semantic = _semantic(owner, orbit, "Stale legacy projection that must not override frame selection.")

    async with AsyncSession(super_engine) as db:
        await set_user_context(db, owner)
        monkeypatch.setenv("NUR_BPLUS_CANONICAL_CLAIMS", "false")
        get_settings.cache_clear()
        legacy = await build_unified_cognitive_state(
            db, owner_user_id=owner, active_question="q", scope_envelope=scope,
            workspace_frame=frame, semantic_projection=semantic, retrieved_refs=[],
        )
        monkeypatch.setenv("NUR_BPLUS_CANONICAL_CLAIMS", "true")
        get_settings.cache_clear()
        canonical = await build_unified_cognitive_state(
            db, owner_user_id=owner, active_question="q", scope_envelope=scope,
            workspace_frame=frame, semantic_projection=semantic, retrieved_refs=[],
        )
    get_settings.cache_clear()

    assert legacy.active_beliefs == [text]
    assert canonical.active_beliefs == legacy.active_beliefs
    assert canonical.canonical_claims[0]["id"] == claim["id"]
