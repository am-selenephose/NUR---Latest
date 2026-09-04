from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Prediction
from app.tests.conftest import register_user

SET_USER = "SELECT set_config('app.current_user_id', :uid, true)"


def test_prediction_model_exposes_bplus_contract():
    required = {
        "metric",
        "falsification_condition",
        "resolution_rule",
        "resolved_outcome_id",
        "prediction_error",
        "omega_claim_id",
        "legacy_omega_prediction_id",
    }
    missing = sorted(name for name in required if not hasattr(Prediction, name))
    assert missing == []


async def test_prediction_requires_observable_contract(client, app_engine):
    from app.omega.prediction_v2 import register_prediction

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    session_maker = async_sessionmaker(
        app_engine, expire_on_commit=False, class_=AsyncSession
    )
    async with session_maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        with pytest.raises(ValueError, match="expected_observation"):
            await register_prediction(
                db,
                owner_user_id=owner_id,
                statement="Strategy A will reduce completion time.",
                expected_observation={},
                confidence=Decimal("0.750"),
                horizon_days=7,
            )
        row = await register_prediction(
            db,
            owner_user_id=owner_id,
            statement="Strategy A will reduce completion time.",
            expected_observation={
                "metric": "completion_minutes",
                "operator": "<=",
                "value": 60,
            },
            metric="completion_minutes",
            confidence=Decimal("0.750"),
            horizon_days=7,
            assumptions=["same task class"],
            falsification_condition="median > 60",
            resolution_rule={"operator": "<=", "value": 60},
        )
        await db.commit()

    assert row.review_by is not None
    assert row.confidence == Decimal("0.750")
    assert row.metric == "completion_minutes"
    assert row.assumptions == ["same task class"]
    assert row.falsification_condition == "median > 60"

async def test_resolution_records_numeric_error_why_changed_and_claim_evidence(
    client, app_engine, super_engine
):
    from app.models import Outcome
    from app.omega.prediction_v2 import register_prediction, resolve_prediction

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    claim = (await client.post(
        "/api/v1/omega/claims",
        headers={"X-CSRF-Token": client.cookies.get("nur_csrf")},
        json={
            "claim_text": "Completion should stay under one hour.",
            "claim_type": "HYPOTHESIS",
            "truth_status": "HYPOTHESIS",
            "provenance_label": "OWNER_WRITTEN",
        },
    )).json()
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        outcome = Outcome(
            owner_user_id=owner_id,
            observed_result="Completed in 55 minutes.",
            structured_measurements={"completion_minutes": 55},
        )
        db.add(outcome)
        await db.flush()
        prediction = await register_prediction(
            db,
            owner_user_id=owner_id,
            statement="Completion will stay at or below 60 minutes.",
            expected_observation={
                "metric": "completion_minutes", "operator": "<=", "value": 60,
            },
            confidence=Decimal("0.750"),
            horizon_days=7,
            omega_claim_id=uuid.UUID(claim["id"]),
        )
        prediction_id = prediction.id
        outcome_id = outcome.id
        resolved = await resolve_prediction(
            db,
            owner_user_id=owner_id,
            prediction_id=prediction_id,
            evaluator_result="CONFIRMED",
            outcome_id=outcome_id,
            learning="Observed completion beat the threshold.",
        )
        await db.commit()

    assert resolved.resolution == "CONFIRMED"
    assert resolved.status == "RESOLVED"
    assert resolved.resolved_outcome_id == outcome_id
    assert resolved.prediction_error == Decimal("-5.000000")
    async with super_engine.connect() as conn:
        why = (await conn.execute(text("""
            SELECT change_class, supporting_evidence, counter_evidence
            FROM why_changed_records
            WHERE owner_user_id=:owner AND entity_type='prediction' AND entity_id=:entity
            ORDER BY occurred_at DESC LIMIT 1
        """), {"owner": owner_id, "entity": str(prediction_id)})).mappings().one()
        edge = (await conn.execute(text("""
            SELECT relation, evidence_kind, evidence_id, strength
            FROM omega_evidence_edges
            WHERE owner_user_id=:owner AND claim_id=:claim AND evidence_id=:outcome
            ORDER BY created_at DESC LIMIT 1
        """), {"owner": owner_id, "claim": claim["id"], "outcome": outcome_id})).mappings().one()
    assert why["change_class"] == "updated"
    assert why["supporting_evidence"] == [f"outcome:{outcome_id}"]
    assert why["counter_evidence"] == []
    assert edge["relation"] == "SUPPORTS"
    assert edge["evidence_kind"] == "OUTCOME"
    assert edge["strength"] == 1.0


async def test_calibration_report_scores_only_binary_resolutions(client, app_engine):
    from app.omega.calibration import calibration_report
    from app.omega.prediction_v2 import register_prediction, resolve_prediction

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        rows = []
        for confidence in (Decimal("0.740"), Decimal("0.760"), Decimal("0.750")):
            rows.append(await register_prediction(
                db,
                owner_user_id=owner_id,
                statement=f"Binary forecast at {confidence}",
                expected_observation={"metric": "success", "operator": "==", "value": True},
                confidence=confidence,
                horizon_days=1,
            ))
        await resolve_prediction(
            db, owner_user_id=owner_id, prediction_id=rows[0].id,
            evaluator_result="CONFIRMED",
        )
        await resolve_prediction(
            db, owner_user_id=owner_id, prediction_id=rows[1].id,
            evaluator_result="CONTRADICTED",
        )
        await resolve_prediction(
            db, owner_user_id=owner_id, prediction_id=rows[2].id,
            evaluator_result="PARTIALLY_CONFIRMED",
        )
        report = await calibration_report(db, owner_user_id=owner_id)
        await db.commit()

    assert len(report) == 1
    bucket = report[0]
    assert bucket.bucket == Decimal("0.7")
    assert bucket.count == 2
    assert bucket.mean_forecast == Decimal("0.750000")
    assert bucket.observed_frequency == Decimal("0.500000")
    assert bucket.absolute_calibration_error == Decimal("0.250000")
    assert bucket.brier_score == Decimal("0.322600")


async def test_omega_prediction_post_writes_canonical_ledger_only(client, super_engine):
    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    response = await client.post(
        "/api/v1/omega/predictions",
        headers={"X-CSRF-Token": client.cookies.get("nur_csrf")},
        json={
            "prediction_text": "The build will report green status.",
            "expected_observation": "green status",
            "metric": "status_text",
            "time_window": "7 days",
            "confidence": 0.72,
        },
    )
    assert response.status_code == 201, response.text
    prediction_id = response.json()["id"]
    async with super_engine.connect() as conn:
        canonical = (await conn.execute(text(
            "SELECT count(*) FROM predictions WHERE owner_user_id=:owner AND id=:id"
        ), {"owner": owner_id, "id": prediction_id})).scalar_one()
        legacy = (await conn.execute(text(
            "SELECT count(*) FROM omega_predictions WHERE owner_user_id=:owner"
        ), {"owner": owner_id})).scalar_one()
    assert canonical == 1
    assert legacy == 0


async def test_legacy_prediction_bridge_is_idempotent(client, app_engine, super_engine):
    from app.models import OmegaPrediction
    from app.omega.prediction_v2 import bridge_legacy_predictions

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        legacy = OmegaPrediction(
            owner_user_id=owner_id,
            prediction_text="Legacy prediction survives migration.",
            expected_observation="legacy marker",
            metric="status_text",
            confidence=0.65,
        )
        db.add(legacy)
        await db.flush()
        legacy_id = legacy.id
        first = await bridge_legacy_predictions(db, owner_user_id=owner_id)
        second = await bridge_legacy_predictions(db, owner_user_id=owner_id)
        await db.commit()
    assert first == 1
    assert second == 0
    async with super_engine.connect() as conn:
        rows = (await conn.execute(text("""
            SELECT id, legacy_omega_prediction_id
            FROM predictions
            WHERE owner_user_id=:owner AND legacy_omega_prediction_id=:legacy
        """), {"owner": owner_id, "legacy": legacy_id})).mappings().all()
    assert len(rows) == 1
    assert rows[0]["legacy_omega_prediction_id"] == legacy_id

async def test_talk_summary_reads_canonical_prediction(client, app_engine):
    from app.brain.schemas import ScopeEnvelope
    from app.omega.workspace_service import talk_summary

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    response = await client.post(
        "/api/v1/omega/predictions",
        headers={"X-CSRF-Token": client.cookies.get("nur_csrf")},
        json={
            "prediction_text": "canonical-summary-marker-bplus-601",
            "expected_observation": "marker observed",
            "metric": "status_text",
            "confidence": 0.61,
        },
    )
    assert response.status_code == 201, response.text
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        summary = await talk_summary(
            db,
            owner_user_id=owner_id,
            workspace_frame_id=None,
            scope_envelope=ScopeEnvelope(owner_user_id=owner_id, sharing_boundary="PRIVATE"),
        )
    assert "canonical-summary-marker-bplus-601" in summary.unresolved_predictions


async def test_unstructured_talk_hypotheses_are_not_promoted_to_prediction_rows(
    client, app_engine
):
    from app.ai.schemas import NURTalkOutput
    from app.cognition.prediction_service import persist_predictions

    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        rows = await persist_predictions(
            db,
            owner_user_id=owner_id,
            orbit_id=None,
            source_event_id=uuid.uuid4(),
            output=NURTalkOutput(
                direct_response="A hypothesis is not yet a measurable prediction.",
                hypotheses=["This will probably work if the context stays stable."],
            ),
        )
        count = (await db.execute(text(
            "SELECT count(*) FROM predictions WHERE owner_user_id=:owner"
        ), {"owner": owner_id})).scalar_one()
    assert rows == []
    assert count == 0

async def test_map_manual_resolution_uses_canonical_why_changed_service(
    client, app_engine, super_engine
):
    registered, _, _ = await register_user(client)
    owner_id = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner_id)})
        row = Prediction(
            owner_user_id=owner_id,
            statement="Manual resolution must still be governed.",
            expected_observation={"metric": "manual", "operator": "==", "value": True},
            confidence=Decimal("0.600"),
            horizon_days=1,
            review_by=None,
        )
        db.add(row)
        await db.commit()
        prediction_id = row.id

    response = await client.post(
        f"/api/v1/map/predictions/{prediction_id}/resolve",
        headers={"X-CSRF-Token": client.cookies.get("nur_csrf")},
        json={"resolution": "CONTRADICTED", "learning": "Observed result diverged."},
    )
    assert response.status_code == 200, response.text
    async with super_engine.connect() as conn:
        why = (await conn.execute(text("""
            SELECT change_class, trigger
            FROM why_changed_records
            WHERE owner_user_id=:owner AND entity_type='prediction' AND entity_id=:entity
            ORDER BY occurred_at DESC LIMIT 1
        """), {"owner": owner_id, "entity": str(prediction_id)})).mappings().one_or_none()
    assert why is not None
    assert why["change_class"] == "contradicted"
