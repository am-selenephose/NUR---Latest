from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mind.why_changed import ChangeClass, EntityType, WhyChangedService
from app.models import OmegaPrediction, Outcome, Prediction
from app.omega.evidence_graph import link_evidence

RESOLUTIONS = {"CONFIRMED", "PARTIALLY_CONFIRMED", "CONTRADICTED"}


def _validate_confidence(value: Decimal) -> Decimal:
    confidence = Decimal(value)
    if not Decimal(0) < confidence < Decimal(1):
        raise ValueError("confidence must be strictly between 0 and 1")
    return confidence.quantize(Decimal("0.001"))


def _validate_observable(expected_observation: dict) -> None:
    if not expected_observation or not expected_observation.get("metric"):
        raise ValueError("expected_observation must define an observable metric")
    if "operator" not in expected_observation or "value" not in expected_observation:
        raise ValueError("expected_observation must define operator and value")


def _normalized_rule(expected_observation: dict, resolution_rule: dict | None) -> dict:
    rule = dict(resolution_rule or {})
    for key in ("metric", "operator", "value"):
        rule.setdefault(key, expected_observation.get(key))
    return rule


def _numeric_delta(row: Prediction, outcome: Outcome | None) -> Decimal | None:
    if outcome is None:
        return None
    rule = row.resolution_rule or {}
    expected = row.expected_observation or {}
    metric = row.metric or rule.get("metric") or expected.get("metric")
    target = rule.get("value", expected.get("value"))
    observed = (outcome.structured_measurements or {}).get(metric) if metric else None
    if isinstance(observed, bool) or isinstance(target, bool):
        return None
    if not isinstance(observed, (int, float, Decimal)) or not isinstance(
        target, (int, float, Decimal)
    ):
        return None
    return (Decimal(str(observed)) - Decimal(str(target))).quantize(Decimal("0.000001"))


async def register_prediction(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    statement: str,
    expected_observation: dict,
    confidence: Decimal,
    horizon_days: int | None,
    orbit_id: uuid.UUID | None = None,
    source_event_id: uuid.UUID | None = None,
    metric: str | None = None,
    assumptions: list[str] | None = None,
    falsification_condition: str | None = None,
    resolution_rule: dict | None = None,
    omega_claim_id: uuid.UUID | None = None,
    legacy_omega_prediction_id: uuid.UUID | None = None,
) -> Prediction:
    if not statement.strip():
        raise ValueError("statement is required")
    _validate_observable(expected_observation)
    if horizon_days is not None and horizon_days <= 0:
        raise ValueError("horizon_days must be positive")
    normalized_confidence = _validate_confidence(confidence)
    row = Prediction(
        owner_user_id=owner_user_id,
        orbit_id=orbit_id,
        source_event_id=source_event_id,
        statement=statement.strip(),
        expected_observation=expected_observation,
        metric=metric or str(expected_observation["metric"]),
        assumptions=assumptions or [],
        confidence=normalized_confidence,
        horizon_days=horizon_days,
        review_by=(
            dt.datetime.now(dt.UTC) + dt.timedelta(days=horizon_days)
            if horizon_days is not None
            else None
        ),
        falsification_condition=falsification_condition,
        resolution_rule=_normalized_rule(expected_observation, resolution_rule),
        omega_claim_id=omega_claim_id,
        legacy_omega_prediction_id=legacy_omega_prediction_id,
        status="OPEN",
    )
    db.add(row)
    await db.flush()
    return row


async def resolve_prediction(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    prediction_id: uuid.UUID,
    evaluator_result: str,
    outcome_id: uuid.UUID | None = None,
    learning: str | None = None,
) -> Prediction:
    if evaluator_result not in RESOLUTIONS:
        raise ValueError("unsupported prediction evaluator result")
    row = (await db.execute(select(Prediction).where(
        Prediction.id == prediction_id,
        Prediction.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if row is None:
        raise PermissionError("Prediction not found.")
    if row.resolution is not None:
        raise ValueError(f"Prediction already resolved as {row.resolution}.")

    outcome = None
    if outcome_id is not None:
        outcome = (await db.execute(select(Outcome).where(
            Outcome.id == outcome_id,
            Outcome.owner_user_id == owner_user_id,
        ))).scalar_one_or_none()
        if outcome is None:
            raise PermissionError("Outcome not found.")

    now = dt.datetime.now(dt.UTC)
    row.resolution = evaluator_result
    row.learning = learning
    row.resolved_at = now
    row.status = "RESOLVED"
    row.resolved_outcome_id = outcome.id if outcome else None
    row.prediction_error = _numeric_delta(row, outcome)

    evidence_ref = [f"outcome:{outcome.id}"] if outcome else []
    await WhyChangedService.record_change(
        db,
        owner_user_id=owner_user_id,
        entity_type=EntityType.PREDICTION,
        entity_id=str(row.id),
        change_class=(
            ChangeClass.CONTRADICTED
            if evaluator_result == "CONTRADICTED"
            else ChangeClass.UPDATED
        ),
        trigger=(
            f"Observed outcome {outcome.id} resolved the prediction."
            if outcome
            else "Explicit evaluator resolved the prediction."
        ),
        previous_version="OPEN",
        new_version=evaluator_result,
        supporting_evidence=(evidence_ref if evaluator_result != "CONTRADICTED" else []),
        counter_evidence=(evidence_ref if evaluator_result == "CONTRADICTED" else []),
        actor="system",
        affected_future_behavior="Resolved prediction is eligible for calibration.",
    )
    if outcome is not None and row.omega_claim_id is not None:
        relation = {
            "CONFIRMED": "SUPPORTS",
            "PARTIALLY_CONFIRMED": "QUALIFIES",
            "CONTRADICTED": "CONTRADICTS",
        }[evaluator_result]
        strength = Decimal("0.5") if evaluator_result == "PARTIALLY_CONFIRMED" else Decimal(1)
        await link_evidence(
            db,
            owner_user_id=owner_user_id,
            claim_id=row.omega_claim_id,
            evidence_kind="OUTCOME",
            evidence_id=outcome.id,
            relation=relation,
            strength=float(strength),
            note=f"Prediction {row.id} resolved as {evaluator_result}.",
        )
    await db.flush()
    return row


def _legacy_resolution(status: str) -> str | None:
    return {
        "CONFIRMED": "CONFIRMED",
        "DISCONFIRMED": "CONTRADICTED",
        "PARTIAL": "PARTIALLY_CONFIRMED",
    }.get(status)


async def bridge_legacy_prediction(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    legacy: OmegaPrediction,
) -> tuple[Prediction, bool]:
    existing = (await db.execute(select(Prediction).where(
        Prediction.owner_user_id == owner_user_id,
        Prediction.legacy_omega_prediction_id == legacy.id,
    ))).scalar_one_or_none()
    if existing is not None:
        return existing, False
    metric = legacy.metric or "text_observation"
    confidence = Decimal(str(legacy.confidence))
    normalized_confidence = (
        confidence.quantize(Decimal("0.001"))
        if Decimal(0) < confidence < Decimal(1)
        else None
    )
    resolution = _legacy_resolution(legacy.status)
    rule: dict[str, Any] = {
        "metric": metric,
        "operator": "contains",
        "value": legacy.expected_observation,
        "legacy_time_window": legacy.time_window,
        "legacy_plan_step_id": str(legacy.plan_step_id) if legacy.plan_step_id else None,
        "legacy_model_run_id": str(legacy.model_run_id) if legacy.model_run_id else None,
        "legacy_confidence": float(legacy.confidence),
    }
    row = Prediction(
        owner_user_id=owner_user_id,
        orbit_id=legacy.orbit_id,
        statement=legacy.prediction_text,
        expected_observation={
            "metric": metric,
            "operator": "contains",
            "value": legacy.expected_observation,
        },
        metric=metric,
        resolution_rule=rule,
        confidence=normalized_confidence,
        omega_claim_id=legacy.claim_id,
        legacy_omega_prediction_id=legacy.id,
        status=("RESOLVED" if resolution else legacy.status),
        resolution=resolution,
        resolved_outcome_id=legacy.outcome_id,
        prediction_error=(
            Decimal(str(legacy.prediction_error)).quantize(Decimal("0.000001"))
            if legacy.prediction_error is not None
            else None
        ),
        resolved_at=legacy.resolved_at,
        created_at=legacy.created_at,
    )
    db.add(row)
    await db.flush()
    return row, True


async def bridge_legacy_predictions(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
) -> int:
    legacy_rows = (await db.execute(select(OmegaPrediction).where(
        OmegaPrediction.owner_user_id == owner_user_id
    ))).scalars().all()
    created = 0
    for legacy in legacy_rows:
        _, was_created = await bridge_legacy_prediction(
            db, owner_user_id=owner_user_id, legacy=legacy
        )
        created += int(was_created)
    return created


def legacy_prediction_to_omega_view(row: OmegaPrediction) -> dict[str, Any]:
    return {
        "id": row.id,
        "orbit_id": row.orbit_id,
        "prediction_text": row.prediction_text,
        "expected_observation": row.expected_observation,
        "metric": row.metric,
        "time_window": row.time_window,
        "confidence": float(row.confidence),
        "status": row.status,
        "outcome_id": row.outcome_id,
        "prediction_error": row.prediction_error,
        "created_at": row.created_at,
        "resolved_at": row.resolved_at,
    }


def prediction_to_omega_view(row: Prediction) -> dict[str, Any]:
    expected = row.expected_observation or {}
    rule = row.resolution_rule or {}
    resolution_status = {
        "CONFIRMED": "CONFIRMED",
        "PARTIALLY_CONFIRMED": "PARTIAL",
        "CONTRADICTED": "DISCONFIRMED",
    }.get(row.resolution)
    confidence: float | None
    if row.confidence is not None:
        confidence = float(row.confidence)
    else:
        raw = rule.get("legacy_confidence")
        confidence = float(raw) if raw is not None else None
    return {
        "id": row.id,
        "orbit_id": row.orbit_id,
        "prediction_text": row.statement,
        "expected_observation": str(expected.get("value", expected)),
        "metric": row.metric,
        "time_window": rule.get("legacy_time_window") or (
            f"{row.horizon_days} days" if row.horizon_days is not None else None
        ),
        "confidence": confidence,
        "status": resolution_status or row.status,
        "outcome_id": row.resolved_outcome_id,
        "prediction_error": (
            float(row.prediction_error) if row.prediction_error is not None else None
        ),
        "created_at": row.created_at,
        "resolved_at": row.resolved_at,
    }
