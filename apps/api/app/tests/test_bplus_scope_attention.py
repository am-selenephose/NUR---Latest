from __future__ import annotations

import datetime as dt
import importlib.util
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.brain.schemas import ScopeEnvelope
from app.mind.capabilities.hydrator import ContextHydrator
from app.omega.workspace_service import build_workspace_frame
from app.tests.conftest import register_user

SET_USER = "SELECT set_config('app.current_user_id', :uid, true)"


def H(client) -> dict:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def _orbit(client, title: str) -> str:
    row = await client.post(
        "/api/v1/orbits",
        headers=H(client),
        json={"title": title, "kind": "PROJECT", "description": title},
    )
    assert row.status_code == 201, row.text
    return row.json()["id"]
async def test_workspace_frame_never_reads_other_orbit_claim(client, app_engine):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_a = await _orbit(client, "Orbit A")
    orbit_b = await _orbit(client, "Orbit B")
    await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "A-only marker bplus-a-771",
            "claim_type": "FACT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
            "orbit_id": orbit_a,
        },
    )
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        frame = await build_workspace_frame(
            db,
            owner_user_id=uuid.UUID(owner_id),
            task_mode="talk",
            active_question="What matters here?",
            scope_envelope=ScopeEnvelope(owner_user_id=uuid.UUID(owner_id), orbit_id=uuid.UUID(orbit_b), sharing_boundary="ORBIT"),
            orbit_id=uuid.UUID(orbit_b),
        )
    assert "bplus-a-771" not in str(frame.attention_items)
async def test_relevant_old_claim_outranks_recent_noise(client, app_engine, super_engine):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_id = await _orbit(client, "Relevance Orbit")
    relevant = (await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "Postgres RLS is the trust boundary for this system.",
            "claim_type": "FACT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
            "orbit_id": orbit_id,
        },
    )).json()
    for i in range(6):
        await client.post(
            "/api/v1/omega/claims",
            headers=H(client),
            json={"claim_text": f"Irrelevant recent weather note {i}", "claim_type": "FACT", "truth_status": "OBSERVED", "provenance_label": "OWNER_WRITTEN", "orbit_id": orbit_id},
        )
    async with super_engine.begin() as conn:
        await conn.execute(text("UPDATE omega_claims SET updated_at=:old WHERE id=:id"), {"old": dt.datetime.now(dt.UTC) - dt.timedelta(days=30), "id": relevant["id"]})
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        frame = await build_workspace_frame(
            db,
            owner_user_id=uuid.UUID(owner_id),
            task_mode="talk",
            active_question="Which database trust boundary matters?",
            scope_envelope=ScopeEnvelope(owner_user_id=uuid.UUID(owner_id), orbit_id=uuid.UUID(orbit_id), sharing_boundary="ORBIT"),
            orbit_id=uuid.UUID(orbit_id),
        )
    assert relevant["id"] in {str(value) for value in frame.retrieved_claim_ids}
    assert "Postgres RLS" in str(frame.attention_items)


def test_semantic_hydration_filters_every_family_by_orbit():
    owner = uuid.uuid4()
    orbit_a = uuid.uuid4()
    orbit_b = uuid.uuid4()
    scope = ScopeEnvelope(owner_user_id=owner, orbit_id=orbit_b, sharing_boundary="ORBIT")
    result = ContextHydrator.hydrate_semantic_sources(
        scope,
        approved_memory=[{"id": "m-a", "owner_user_id": str(owner), "orbit_id": str(orbit_a), "status": "APPROVED"}, {"id": "m-b", "owner_user_id": str(owner), "orbit_id": str(orbit_b), "status": "APPROVED"}],
        memory_candidates=[],
        beliefs=[{"id": "b-a", "owner_user_id": str(owner), "orbit_id": str(orbit_a)}, {"id": "b-b", "owner_user_id": str(owner), "orbit_id": str(orbit_b)}],
        user_model_claims=[], research_results=[], semantic_context=[], token_budget=10_000,
    )
    assert [row["id"] for row in result.approved_memory] == ["m-b"]
    assert [row["id"] for row in result.beliefs] == ["b-b"]


def test_canonical_retrieval_module_exists():
    assert importlib.util.find_spec("app.omega.retrieval") is not None
