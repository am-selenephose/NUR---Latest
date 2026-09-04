from __future__ import annotations

from sqlalchemy import text

from app.tests.conftest import register_user


def H(client) -> dict:
    return {"X-CSRF-Token": client.cookies.get("nur_csrf")}


async def _seed_events(super_engine, *, owner_id: str, count: int) -> None:
    async with super_engine.begin() as conn:
        await conn.execute(
            text(
                """
                INSERT INTO cognitive_events(
                    id, owner_user_id, event_kind, content_text,
                    structured_payload, scope, salience, novelty,
                    confidence, created_at
                )
                SELECT md5(:uid || ':' || n::text)::uuid, CAST(:uid AS uuid),
                       'SYSTEM_EVENT', 'B+ consolidation source ' || n,
                       '{}'::jsonb, 'PRIVATE_ORBIT', 0, 0, 0.5,
                       now() + n * interval '1 microsecond'
                FROM generate_series(1, :count) AS n
                """
            ),
            {"uid": owner_id, "count": count},
        )


async def test_1005_events_eventually_all_receive_terminal_receipts(
    client, app_engine, super_engine
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    async with super_engine.connect() as conn:
        table_name = (
            await conn.execute(
                text("SELECT to_regclass('public.omega_ingestion_receipts')")
            )
        ).scalar_one()
        rls = (
            await conn.execute(
                text(
                    "SELECT relrowsecurity, relforcerowsecurity "
                    "FROM pg_class WHERE oid='omega_ingestion_receipts'::regclass"
                )
            )
        ).one()
    assert table_name == "omega_ingestion_receipts"
    assert rls == (True, True)

    await _seed_events(super_engine, owner_id=owner_id, count=1005)
    for _ in range(12):
        response = await client.post(
            "/api/v1/omega/consolidate",
            headers=H(client),
            json={"run_kind": "MANUAL"},
        )
        assert response.status_code == 200, response.text

    async with app_engine.connect() as conn:
        await conn.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": owner_id},
        )
        unseen = (
            await conn.execute(
                text(
                    """
                    SELECT count(*) FROM cognitive_events e
                    LEFT JOIN omega_ingestion_receipts r
                      ON r.owner_user_id=e.owner_user_id
                     AND r.source_kind='COGNITIVE_EVENT'
                     AND r.source_id=e.id
                    WHERE e.owner_user_id=:uid AND r.id IS NULL
                    """
                ),
                {"uid": owner_id},
            )
        ).scalar_one()
        receipt_counts = dict(
            (await conn.execute(
                text("SELECT status, count(*) FROM omega_ingestion_receipts WHERE owner_user_id=:uid GROUP BY status"),
                {"uid": owner_id},
            )).all()
        )
    assert unseen == 0
    terminal = sum(receipt_counts.get(status, 0) for status in ("PROCESSED", "IGNORED", "QUARANTINED"))
    assert terminal == 1005

    async with app_engine.connect() as conn:
        await conn.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": owner_id})
        before = {
            "receipts": (await conn.execute(text("SELECT count(*) FROM omega_ingestion_receipts WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
            "experiences": (await conn.execute(text("SELECT count(*) FROM omega_experiences WHERE owner_user_id=:uid AND source_kind='COGNITIVE_EVENT'"), {"uid": owner_id})).scalar_one(),
            "claims": (await conn.execute(text("SELECT count(*) FROM omega_claims WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
            "evidence_edges": (await conn.execute(text("SELECT count(*) FROM omega_evidence_edges WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
        }
    extra = await client.post(
        "/api/v1/omega/consolidate",
        headers=H(client),
        json={"run_kind": "MANUAL"},
    )
    assert extra.status_code == 200
    async with app_engine.connect() as conn:
        await conn.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": owner_id})
        after = {
            "receipts": (await conn.execute(text("SELECT count(*) FROM omega_ingestion_receipts WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
            "experiences": (await conn.execute(text("SELECT count(*) FROM omega_experiences WHERE owner_user_id=:uid AND source_kind='COGNITIVE_EVENT'"), {"uid": owner_id})).scalar_one(),
            "claims": (await conn.execute(text("SELECT count(*) FROM omega_claims WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
            "evidence_edges": (await conn.execute(text("SELECT count(*) FROM omega_evidence_edges WHERE owner_user_id=:uid"), {"uid": owner_id})).scalar_one(),
        }
    assert after == before


async def test_deterministic_ingest_failure_quarantines_after_three_attempts(
    client, app_engine, super_engine, monkeypatch
):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    await _seed_events(super_engine, owner_id=owner_id, count=1)

    async def fail_ingest(*args, **kwargs):
        raise ValueError("deterministic fixture failure")

    monkeypatch.setattr(
        "app.omega.consolidation_service.ingest_from_cognitive_event", fail_ingest
    )
    for _ in range(3):
        response = await client.post(
            "/api/v1/omega/consolidate",
            headers=H(client),
            json={"run_kind": "MANUAL"},
        )
        assert response.status_code == 200, response.text

    async with app_engine.connect() as conn:
        await conn.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": owner_id})
        row = (await conn.execute(text("SELECT status, attempt_count, error_code, error_summary FROM omega_ingestion_receipts WHERE owner_user_id=:uid"), {"uid": owner_id})).mappings().one()
    assert row["status"] == "QUARANTINED"
    assert row["attempt_count"] == 3
    assert row["error_code"] == "ValueError"
    assert "fixture failure" not in (row["error_summary"] or "")
