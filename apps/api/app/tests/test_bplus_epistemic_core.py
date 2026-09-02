from httpx import AsyncClient
from sqlalchemy import text

from app.tests.conftest import register_user


def H(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def test_bplus_claim_schema_separates_epistemic_and_authority(client, super_engine):
    await register_user(client)
    response = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "Night work may currently produce more deep-work completions.",
            "claim_type": "PATTERN",
            "truth_status": "INFERRED",
            "provenance_label": "MODEL_GENERATED",
        },
    )
    assert response.status_code == 201, response.text
    claim = response.json()
    assert claim["epistemic_status"] == "INFERRED"
    assert claim["authority_status"] == "MODEL_PROPOSED"
    assert claim["current_version"] == 1
    async with super_engine.connect() as conn:
        rls = (
            await conn.execute(
                text(
                    """
                    SELECT relrowsecurity, relforcerowsecurity
                    FROM pg_class
                    WHERE relname = 'omega_claim_versions'
                    """
                )
            )
        ).one()
    assert rls.relrowsecurity is True
    assert rls.relforcerowsecurity is True


async def test_bplus_claim_schema_exposes_structured_proposition_defaults(client):
    await register_user(client)
    response = await client.post(
        "/api/v1/omega/claims",
        headers=H(client),
        json={
            "claim_text": "A scoped claim can begin without a normalized predicate.",
            "claim_type": "FACT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
        },
    )
    assert response.status_code == 201, response.text
    claim = response.json()
    assert claim["subject_ref"] is None
    assert claim["predicate"] is None
    assert claim["object_value"] == {}