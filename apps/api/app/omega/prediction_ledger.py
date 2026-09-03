from __future__ import annotations

import re
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OmegaPrediction, Outcome, Prediction
from app.omega.prediction_v2 import (
    bridge_legacy_predictions,
    legacy_prediction_to_omega_view,
    prediction_to_omega_view,
    register_prediction,
    resolve_prediction,
)
from app.omega.safety_law import redact_secrets
from app.omega.schemas import OmegaPredictionIn


def _horizon_days(time_window: str | None) -> int | None:
    if not time_window:
        return None
    match = re.fullmatch(r"\s*(\d+)\s+days?\s*", time_window, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


async def create_prediction(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    payload: OmegaPredictionIn,
) -> dict:
    prediction_text, _ = redact_secrets(payload.prediction_text, max_len=1600)
    expected, _ = redact_secrets(payload.expected_observation, max_len=900)
    metric = payload.metric or "text_observation"
    rule = {
        "metric": metric,
        "operator": "contains",
        "value": expected,
        "legacy_time_window": payload.time_window,
        "legacy_plan_step_id": str(payload.plan_step_id) if payload.plan_step_id else None,
        "legacy_model_run_id": str(payload.model_run_id) if payload.model_run_id else None,
        "source_surface": "omega",
    }
    row = await register_prediction(
        db,
        owner_user_id=owner_user_id,
        statement=prediction_text,
        expected_observation={"metric": metric, "operator": "contains", "value": expected},
        confidence=Decimal(str(payload.confidence)),
        horizon_days=_horizon_days(payload.time_window),
        orbit_id=payload.orbit_id,
        metric=metric,
        resolution_rule=rule,
        omega_claim_id=payload.claim_id,
    )
    return prediction_to_omega_view(row)


def _status_filter(status: str):
    mapping = {
        "CONFIRMED": "CONFIRMED",
        "PARTIAL": "PARTIALLY_CONFIRMED",
        "DISCONFIRMED": "CONTRADICTED",
    }
    if status == "OPEN":
        return Prediction.resolution.is_(None), Prediction.status == "OPEN"
    if status in mapping:
        return Prediction.resolution == mapping[status]
    return Prediction.status == status


async def list_predictions(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    status: str | None = None,
    limit: int = 50,
) -> list[dict]:
    bounded = min(limit, 200)
    canonical_q = select(Prediction).where(Prediction.owner_user_id == owner_user_id)
    if status:
        condition = _status_filter(status)
        if isinstance(condition, tuple):
            canonical_q = canonical_q.where(*condition)
        else:
            canonical_q = canonical_q.where(condition)
    canonical = (await db.execute(
        canonical_q.order_by(Prediction.created_at.desc()).limit(bounded)
    )).scalars().all()

    bridged_ids = {
        row.legacy_omega_prediction_id
        for row in canonical
        if row.legacy_omega_prediction_id is not None
    }
    legacy_q = select(OmegaPrediction).where(OmegaPrediction.owner_user_id == owner_user_id)
    if bridged_ids:
        legacy_q = legacy_q.where(OmegaPrediction.id.not_in(bridged_ids))
    if status:
        legacy_q = legacy_q.where(OmegaPrediction.status == status)
    legacy = (await db.execute(
        legacy_q.order_by(OmegaPrediction.created_at.desc()).limit(bounded)
    )).scalars().all()

    views = [prediction_to_omega_view(row) for row in canonical]
    views.extend(legacy_prediction_to_omega_view(row) for row in legacy)
    views.sort(key=lambda row: row["created_at"], reverse=True)
    return views[:bounded]


def _compare(operator: str, observed, target) -> bool | None:
    try:
        if operator == "<=":
            return observed <= target
        if operator == "<":
            return observed < target
        if operator == ">=":
            return observed >= target
        if operator == ">":
            return observed > target
        if operator == "==":
            return observed == target
        if operator == "!=":
            return observed != target
    except TypeError:
        return None
    return None


def _evaluate_from_outcome(row: Prediction, outcome: Outcome) -> str | None:
    rule = row.resolution_rule or {}
    expected = row.expected_observation or {}
    operator = rule.get("operator") or expected.get("operator")
    target = rule.get("value", expected.get("value"))
    metric = row.metric or rule.get("metric") or expected.get("metric")
    if operator == "contains":
        if not isinstance(target, str):
            return None
        if target.lower() in outcome.observed_result.lower():
            return "CONFIRMED"
        linked_step = rule.get("legacy_plan_step_id")
        if linked_step and outcome.plan_step_id and linked_step == str(outcome.plan_step_id):
            return "CONTRADICTED"
        return None
    if not metric or metric not in (outcome.structured_measurements or {}):
        return None
    verdict = _compare(operator, outcome.structured_measurements[metric], target)
    if verdict is None:
        return None
    return "CONFIRMED" if verdict else "CONTRADICTED"


async def resolve_predictions_from_outcome(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    outcome: Outcome,
) -> int:
    await bridge_legacy_predictions(db, owner_user_id=owner_user_id)
    rows = (await db.execute(select(Prediction).where(
        Prediction.owner_user_id == owner_user_id,
        Prediction.resolution.is_(None),
        Prediction.status == "OPEN",
    ))).scalars().all()
    count = 0
    for row in rows:
        evaluator_result = _evaluate_from_outcome(row, outcome)
        if evaluator_result is None:
            continue
        await resolve_prediction(
            db,
            owner_user_id=owner_user_id,
            prediction_id=row.id,
            evaluator_result=evaluator_result,
            outcome_id=outcome.id,
        )
        count += 1
    await db.flush()
    return count
