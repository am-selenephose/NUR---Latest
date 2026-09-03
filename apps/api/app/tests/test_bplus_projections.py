import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import OmegaClaim
from app.tests.conftest import register_user


def H(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def _owner_id(super_engine, email: str):
    async with super_engine.connect() as conn:
        return (await conn.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": email}
        )).scalar_one()


async def _canonical_claim(client: AsyncClient, text_value: str) -> dict:
    response = await client.post(
        "/api/v1/omega/claims", headers=H(client),
        json={
            "claim_text": text_value,
            "claim_type": "PREFERENCE",
            "truth_status": "INFERRED",
            "provenance_label": "MODEL_GENERATED",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_belief_and_user_model_project_same_canonical_claim(
    client, app_engine, super_engine
):
    from app.omega.projections import project_belief, project_user_model_claim

    _, email, _ = await register_user(client)
    created = await _canonical_claim(client, "I may prefer visual progress.")
    owner_id = await _owner_id(super_engine, email)
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db, db.begin():
        await db.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(owner_id)},
        )
        claim = (await db.execute(
            select(OmegaClaim).where(OmegaClaim.id == created["id"])
        )).scalar_one()
        belief = project_belief(claim)
        user_claim = project_user_model_claim(claim)

    assert str(belief.id) == created["id"]
    assert str(user_claim.id) == created["id"]
    assert belief.claim_text == user_claim.claim_text == created["claim_text"]
    assert belief.version == user_claim.version == created["current_version"]


async def test_semantic_claim_is_compatibility_projection(
    client, app_engine, super_engine
):
    from app.omega.projections import sync_semantic_claim_projection

    _, email, _ = await register_user(client)
    created = await _canonical_claim(client, "Visual progress may help me focus.")
    owner_id = await _owner_id(super_engine, email)
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db, db.begin():
        await db.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(owner_id)},
        )
        claim = (await db.execute(
            select(OmegaClaim).where(OmegaClaim.id == created["id"])
        )).scalar_one()
        compat = await sync_semantic_claim_projection(
            db, owner_user_id=owner_id, claim=claim
        )
        compat_id = compat.id

    async with super_engine.connect() as conn:
        linked = (await conn.execute(text(
            "SELECT canonical_omega_claim_id FROM semantic_claims WHERE id = :id"
        ), {"id": compat_id})).scalar_one()
    assert str(linked) == created["id"]


async def test_high_sensitivity_model_inference_cannot_be_user_model_projection(
    client, app_engine, super_engine
):
    from app.omega.projections import project_user_model_claim

    _, email, _ = await register_user(client)
    created = await _canonical_claim(client, "A medical preference might exist.")
    owner_id = await _owner_id(super_engine, email)
    maker = async_sessionmaker(app_engine, expire_on_commit=False)
    async with maker() as db, db.begin():
        await db.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(owner_id)},
        )
        claim = (await db.execute(
            select(OmegaClaim).where(OmegaClaim.id == created["id"])
        )).scalar_one()
        with pytest.raises(ValueError):
            project_user_model_claim(claim, domain="medical")


async def test_flagged_outcome_write_is_omega_first(
    client, super_engine, monkeypatch
):
    from app.core.config import get_settings

    monkeypatch.setenv("NUR_BPLUS_CANONICAL_CLAIMS", "true")
    get_settings.cache_clear()
    try:
        await register_user(client)
        hyp = (await client.post(
            "/api/v1/hypotheses", headers=H(client),
            json={
                "question": "Does a focus block work?",
                "hypothesis_text": "A focus block improves completion.",
                "prediction": {"completed": 1},
            },
        )).json()
        exp = (await client.post(
            "/api/v1/experiments", headers=H(client),
            json={
                "title": "Focus block",
                "intervention": "Run one focus block",
                "hypothesis_id": hyp["id"],
                "success_criteria": {"completed": ">=1"},
            },
        )).json()
        outcome = await client.post(
            f"/api/v1/experiments/{exp['id']}/outcomes",
            headers=H(client),
            json={
                "observed_result": "Completed the block.",
                "structured_measurements": {"completed": 1},
                "supports": True,
                "rationale": "Observed completion supports the direction.",
            },
        )
        assert outcome.status_code == 201, outcome.text

        async with super_engine.connect() as conn:
            row = (await conn.execute(text("""
                SELECT s.canonical_omega_claim_id, o.epistemic_status,
                       o.authority_status, o.support_count, o.current_version
                FROM semantic_claims s
                JOIN omega_claims o ON o.id = s.canonical_omega_claim_id
                WHERE s.subject_ref = :subject_ref
            """), {"subject_ref": f"hypothesis:{hyp['id']}"})).mappings().one()
        assert row["canonical_omega_claim_id"] is not None
        assert row["epistemic_status"] == "INFERRED"
        assert row["authority_status"] == "SYSTEM_MEASURED"
        assert row["support_count"] == 1
        assert row["current_version"] >= 2
    finally:
        get_settings.cache_clear()

async def test_orbit_context_link_has_canonical_omega_projection_column(super_engine):
    async with super_engine.connect() as conn:
        columns = {
            row[0]
            for row in (await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'orbit_context_links'"
            ))).all()
        }
        constraints = {
            row[0]
            for row in (await conn.execute(text(
                "SELECT conname FROM pg_constraint "
                "WHERE conrelid = 'orbit_context_links'::regclass"
            ))).all()
        }
    assert 'canonical_omega_claim_id' in columns
    assert 'fk_orbit_context_links_canonical_omega_owner' in constraints
