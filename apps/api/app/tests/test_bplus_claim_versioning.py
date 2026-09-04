from httpx import AsyncClient
from sqlalchemy import text

from app.tests.conftest import register_user


def H(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def test_owner_confirmation_changes_authority_not_epistemic(client, super_engine):
    await register_user(client)
    created = (
        await client.post(
            "/api/v1/omega/claims",
            headers=H(client),
            json={
                "claim_text": "Late-night work may be more productive.",
                "claim_type": "PATTERN",
                "truth_status": "INFERRED",
                "provenance_label": "MODEL_GENERATED",
            },
        )
    ).json()
    confirmed_response = await client.post(
        f"/api/v1/omega/claims/{created['id']}/confirm",
        headers=H(client),
    )
    assert confirmed_response.status_code == 200, confirmed_response.text
    confirmed = confirmed_response.json()
    assert confirmed["epistemic_status"] == "INFERRED"
    assert confirmed["authority_status"] == "OWNER_CONFIRMED"
    assert confirmed["current_version"] == 2

    async with super_engine.connect() as conn:
        versions = (
            await conn.execute(
                text(
                    """
                    SELECT version, why_changed_id, change_class, actor, snapshot
                    FROM omega_claim_versions
                    WHERE claim_id = :claim_id
                    ORDER BY version
                    """
                ),
                {"claim_id": created["id"]},
            )
        ).mappings().all()
        changes = (
            await conn.execute(
                text(
                    """
                    SELECT change_class, actor, previous_version, new_version
                    FROM why_changed_records
                    WHERE entity_type = 'omega_claim' AND entity_id = :entity_id
                    ORDER BY occurred_at, id
                    """
                ),
                {"entity_id": created["id"]},
            )
        ).mappings().all()
    assert [row["version"] for row in versions] == [1, 2]
    assert all(row["why_changed_id"] for row in versions)
    assert versions[0]["change_class"] == "created"
    assert versions[1]["change_class"] == "promoted"
    assert versions[1]["actor"] == "owner"
    assert versions[1]["snapshot"]["epistemic_status"] == "INFERRED"
    assert versions[1]["snapshot"]["authority_status"] == "OWNER_CONFIRMED"
    assert [(row["change_class"], row["actor"]) for row in changes] == [
        ("created", "system"),
        ("promoted", "owner"),
    ]
    assert changes[1]["previous_version"] == "1"
    assert changes[1]["new_version"] == "2"


async def test_concurrent_mutations_serialize_versions(client, app_engine, super_engine):
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.mind.why_changed import ChangeClass
    from app.omega.canonical_claim_service import mutate_canonical_claim

    _, email, _ = await register_user(client)
    created = (await client.post(
        "/api/v1/omega/claims", headers=H(client),
        json={
            "claim_text": "Concurrent mutation target.",
            "claim_type": "PATTERN",
            "truth_status": "INFERRED",
            "provenance_label": "MODEL_GENERATED",
        },
    )).json()
    async with super_engine.connect() as conn:
        owner_id = (await conn.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": email}
        )).scalar_one()

    maker = async_sessionmaker(app_engine, expire_on_commit=False)

    async def mutate(field: str, value):
        async with maker() as db, db.begin():
            await db.execute(
                text("SELECT set_config('app.current_user_id', :uid, true)"),
                {"uid": str(owner_id)},
            )
            row, _ = await mutate_canonical_claim(
                db, owner_user_id=owner_id, claim_id=created["id"],
                patch={field: value}, change_class=ChangeClass.UPDATED,
                trigger=f"concurrency-test:{field}", actor="system",
            )
            return row.current_version

    returned = await asyncio.gather(
        mutate("confidence", 0.61),
        mutate("uncertainty_kind", "CONCURRENCY_TEST"),
    )
    assert sorted(returned) == [2, 3]
