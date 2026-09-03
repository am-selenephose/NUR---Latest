from __future__ import annotations

import datetime as dt
import importlib.util
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.brain.schemas import ScopeEnvelope
from app.mind.capabilities.hydrator import ContextHydrator
from app.mind.context import load_semantic_hydration_inputs
from app.mind.scope import ScopeResolutionError
from app.omega.retrieval import retrieve_canonical_context
from app.omega.workspace_service import build_workspace_frame, talk_summary
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
        user_model_claims=[{"id": "u-a", "owner_user_id": str(owner), "orbit_id": str(orbit_a)}, {"id": "u-b", "owner_user_id": str(owner), "orbit_id": str(orbit_b)}],
        research_results=[{"id": "r-a", "owner_user_id": str(owner), "orbit_id": str(orbit_a)}, {"id": "r-b", "owner_user_id": str(owner), "orbit_id": str(orbit_b)}],
        semantic_context=[{"id": "s-a", "owner_user_id": str(owner), "orbit_id": str(orbit_a)}, {"id": "s-b", "owner_user_id": str(owner), "orbit_id": str(orbit_b)}], token_budget=10_000,
    )
    assert [row["id"] for row in result.approved_memory] == ["m-b"]
    assert [row["id"] for row in result.beliefs] == ["b-b"]
    assert [row["id"] for row in result.user_model_claims] == ["u-b"]
    assert [row["id"] for row in result.research_results] == ["r-b"]
    assert [row["id"] for row in result.semantic_context] == ["s-b"]


def test_canonical_retrieval_module_exists():
    assert importlib.util.find_spec("app.omega.retrieval") is not None


async def _omega_claim(client, *, orbit_id: str, text_value: str) -> dict:
    row = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": text_value,
            "claim_type": "FACT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
            "orbit_id": orbit_id,
        },
    )
    assert row.status_code == 201, row.text
    return row.json()


async def test_project_scope_never_falls_back_to_owner_wide_omega(client, app_engine):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_id = await _orbit(client, "Private Orbit outside project")
    await _omega_claim(
        client, orbit_id=orbit_id, text_value="project-leak-marker-bplus-441"
    )

    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        selected = await retrieve_canonical_context(
            db,
            owner_user_id=uuid.UUID(owner_id),
            scope_envelope=ScopeEnvelope(
                owner_user_id=uuid.UUID(owner_id),
                project_id=uuid.uuid4(),
                sharing_boundary="PROJECT",
            ),
            query="project leak marker",
        )
    assert "project-leak-marker-bplus-441" not in {
        row.claim_text for row in selected.claims
    }


async def test_capsule_scope_never_reads_owner_private_omega_without_capsule_source(
    client, app_engine
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_id = await _orbit(client, "Private Orbit outside capsule")
    await _omega_claim(
        client, orbit_id=orbit_id, text_value="capsule-private-marker-bplus-442"
    )

    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        selected = await retrieve_canonical_context(
            db,
            owner_user_id=uuid.UUID(owner_id),
            scope_envelope=ScopeEnvelope(
                owner_user_id=uuid.UUID(owner_id),
                capsule_id=uuid.uuid4(),
                sharing_boundary="CAPSULE",
            ),
            query="capsule private marker",
        )
    assert "capsule-private-marker-bplus-442" not in {
        row.claim_text for row in selected.claims
    }


async def test_community_scope_never_falls_back_to_owner_wide_omega(client, app_engine):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_id = await _orbit(client, "Private Orbit outside community")
    await _omega_claim(
        client, orbit_id=orbit_id, text_value="community-leak-marker-bplus-443"
    )

    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        selected = await retrieve_canonical_context(
            db,
            owner_user_id=uuid.UUID(owner_id),
            scope_envelope=ScopeEnvelope(
                owner_user_id=uuid.UUID(owner_id),
                community_id=uuid.uuid4(),
                sharing_boundary="COMMUNITY",
            ),
            query="community leak marker",
        )
    assert "community-leak-marker-bplus-443" not in {
        row.claim_text for row in selected.claims
    }


async def test_workspace_frame_rejects_orbit_argument_that_disagrees_with_scope(
    client, app_engine
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_a = uuid.UUID(await _orbit(client, "Scope Orbit A"))
    orbit_b = uuid.UUID(await _orbit(client, "Argument Orbit B"))
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        try:
            await build_workspace_frame(
                db,
                owner_user_id=uuid.UUID(owner_id),
                task_mode="talk",
                active_question="Which orbit?",
                scope_envelope=ScopeEnvelope(
                    owner_user_id=uuid.UUID(owner_id),
                    orbit_id=orbit_a,
                    sharing_boundary="ORBIT",
                ),
                orbit_id=orbit_b,
            )
        except ScopeResolutionError:
            pass
        else:
            raise AssertionError(
                "workspace frame accepted an orbit_id that disagreed with ScopeEnvelope"
            )


async def test_talk_summary_is_orbit_scoped_not_owner_wide(
    client, app_engine, super_engine
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_a = await _orbit(client, "Summary Orbit A")
    orbit_b = await _orbit(client, "Summary Orbit B")
    claim_a = await _omega_claim(
        client, orbit_id=orbit_a, text_value="summary-a-secret-bplus-444"
    )
    claim_b = await _omega_claim(
        client, orbit_id=orbit_b, text_value="summary-b-visible-bplus-445"
    )
    async with super_engine.begin() as conn:
        await conn.execute(
            text("UPDATE omega_claims SET support_count=1 WHERE id IN (:a, :b)"),
            {"a": claim_a["id"], "b": claim_b["id"]},
        )

    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        summary = await talk_summary(
            db,
            owner_user_id=uuid.UUID(owner_id),
            workspace_frame_id=None,
            scope_envelope=ScopeEnvelope(
                owner_user_id=uuid.UUID(owner_id),
                orbit_id=uuid.UUID(orbit_b),
                sharing_boundary="ORBIT",
            ),
        )
    rendered = str(summary.model_dump())
    assert "summary-b-visible-bplus-445" in rendered
    assert "summary-a-secret-bplus-444" not in rendered


async def test_semantic_loader_derives_projection_orbit_and_preserves_research_scope(
    client, app_engine, super_engine
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    orbit_a = await _orbit(client, "Semantic Orbit A")
    orbit_b = await _orbit(client, "Semantic Orbit B")
    claim_a = await _omega_claim(
        client, orbit_id=orbit_a, text_value="semantic-a-bplus-446"
    )
    claim_b = await _omega_claim(
        client, orbit_id=orbit_b, text_value="semantic-b-bplus-447"
    )
    semantic_a = uuid.uuid4()
    semantic_b = uuid.uuid4()
    draft_a = uuid.uuid4()
    draft_b = uuid.uuid4()
    note_a = uuid.uuid4()
    note_b = uuid.uuid4()

    async with super_engine.begin() as conn:
        await conn.execute(
            text("""
            INSERT INTO semantic_claims
                (id, owner_user_id, canonical_omega_claim_id, claim_text, status)
            VALUES
                (:sa, :owner, :ca, 'semantic-a-bplus-446', 'EMERGING'),
                (:sb, :owner, :cb, 'semantic-b-bplus-447', 'EMERGING')
        """),
            {
                "sa": semantic_a,
                "sb": semantic_b,
                "owner": owner_id,
                "ca": claim_a["id"],
                "cb": claim_b["id"],
            },
        )
        await conn.execute(
            text("""
            INSERT INTO research_drafts (id, owner_user_id, orbit_id, question, status)
            VALUES
                (:da, :owner, :oa, 'research-a-bplus-448', 'STAGED'),
                (:db, :owner, :ob, 'research-b-bplus-449', 'STAGED')
        """),
            {
                "da": draft_a,
                "db": draft_b,
                "owner": owner_id,
                "oa": orbit_a,
                "ob": orbit_b,
            },
        )
        await conn.execute(
            text("""
            INSERT INTO research_source_notes (id, owner_user_id, orbit_id, title, note)
            VALUES
                (:na, :owner, :oa, 'note-a', 'note-a-bplus-450'),
                (:nb, :owner, :ob, 'note-b', 'note-b-bplus-451')
        """),
            {
                "na": note_a,
                "nb": note_b,
                "owner": owner_id,
                "oa": orbit_a,
                "ob": orbit_b,
            },
        )

    scope = ScopeEnvelope(
        owner_user_id=uuid.UUID(owner_id),
        orbit_id=uuid.UUID(orbit_b),
        sharing_boundary="ORBIT",
    )
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        loaded = await load_semantic_hydration_inputs(
            db,
            owner_user_id=uuid.UUID(owner_id),
            scope_envelope=scope,
        )

    belief_ids = {row["id"] for row in loaded["beliefs"]}
    assert belief_ids == {str(semantic_b)}
    assert {row["orbit_id"] for row in loaded["beliefs"]} == {orbit_b}
    assert {row["orbit_id"] for row in loaded["research_results"]} == {orbit_b}
    assert {row["orbit_id"] for row in loaded["semantic_context"]} == {orbit_b}


async def test_semantic_loader_requires_explicit_scope(client, app_engine):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": owner_id})
        try:
            await load_semantic_hydration_inputs(
                db, owner_user_id=uuid.UUID(owner_id), scope_envelope=None
            )
        except ScopeResolutionError:
            pass
        else:
            raise AssertionError("semantic retrieval accepted a missing ScopeEnvelope")


def test_project_capsule_community_semantic_scopes_exclude_untagged_private_memory():
    owner = uuid.uuid4()
    for field, boundary in (("project_id", "PROJECT"), ("capsule_id", "CAPSULE"), ("community_id", "COMMUNITY")):
        scope_id = uuid.uuid4()
        scope = ScopeEnvelope(owner_user_id=owner, sharing_boundary=boundary, **{field: scope_id})
        result = ContextHydrator.hydrate_semantic_sources(
            scope,
            approved_memory=[
                {"id": "private", "owner_user_id": str(owner), "status": "APPROVED"},
                {"id": "scoped", "owner_user_id": str(owner), "status": "APPROVED", field: str(scope_id)},
            ],
            memory_candidates=[], beliefs=[], user_model_claims=[],
            research_results=[], semantic_context=[], token_budget=10_000,
        )
        assert [row["id"] for row in result.approved_memory] == ["scoped"]
