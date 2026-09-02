"""Outcome provenance and hypothesis revision.

Legacy semantic claims remain available as compatibility projections. With
NUR_BPLUS_CANONICAL_CLAIMS enabled, Omega owns the durable proposition first.
"""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.mind.why_changed import ChangeClass
from app.models import ClaimEvidence, Hypothesis, OmegaClaim, Outcome, SemanticClaim
from app.omega.canonical_claim_service import (
    create_canonical_claim,
    mutate_canonical_claim,
)
from app.omega.projections import sync_semantic_claim_projection
from app.omega.schemas import OmegaClaimIn


def prediction_error(prediction: dict, measurements: dict) -> dict:
    """Return numeric deltas where both prediction and observation are numeric."""
    diff: dict = {"compared": {}, "uncompared": []}
    for key, pred in (prediction or {}).items():
        got = (measurements or {}).get(key)
        if isinstance(pred, (int, float)) and isinstance(got, (int, float)):
            diff["compared"][key] = {
                "predicted": pred, "observed": got, "delta": got - pred,
            }
        else:
            diff["uncompared"].append(key)
    return diff


async def _legacy_semantic_claim(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    hypothesis: Hypothesis, outcome: Outcome, supports: bool, rationale: str,
) -> SemanticClaim:
    claim = (await db.execute(select(SemanticClaim).where(
        SemanticClaim.owner_user_id == owner_user_id,
        SemanticClaim.subject_ref == f"hypothesis:{hypothesis.id}",
    ))).scalar_one_or_none()
    if claim is None:
        claim = SemanticClaim(
            owner_user_id=owner_user_id,
            claim_text=hypothesis.hypothesis_text,
            subject_ref=f"hypothesis:{hypothesis.id}",
            predicate="supported_by_outcomes",
            confidence=hypothesis.confidence,
        )
        db.add(claim)
        await db.flush()
    if supports:
        claim.evidence_count += 1
    else:
        claim.counterevidence_count += 1
    claim.confidence = hypothesis.confidence
    claim.status = (
        "SUPPORTED" if claim.evidence_count >= 2 and claim.counterevidence_count == 0
        else "DISPUTED" if claim.counterevidence_count > claim.evidence_count
        else "MIXED" if claim.counterevidence_count and claim.evidence_count
        else "EMERGING"
    )
    claim.last_evaluated_at = dt.datetime.now(dt.timezone.utc)
    db.add(ClaimEvidence(
        owner_user_id=owner_user_id,
        claim_id=claim.id,
        outcome_id=outcome.id,
        supports=supports,
        weight=1.0,
        rationale=rationale,
    ))
    return claim


async def _bplus_semantic_projection(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    hypothesis: Hypothesis, outcome: Outcome, supports: bool, rationale: str,
) -> SemanticClaim:
    subject_ref = f"hypothesis:{hypothesis.id}"
    compat = (await db.execute(select(SemanticClaim).where(
        SemanticClaim.owner_user_id == owner_user_id,
        SemanticClaim.subject_ref == subject_ref,
    ))).scalar_one_or_none()
    canonical = None
    if compat and compat.canonical_omega_claim_id:
        canonical = (await db.execute(select(OmegaClaim).where(
            OmegaClaim.id == compat.canonical_omega_claim_id,
            OmegaClaim.owner_user_id == owner_user_id,
        ))).scalar_one_or_none()
    if canonical is None:
        canonical = await create_canonical_claim(
            db,
            owner_user_id=owner_user_id,
            payload=OmegaClaimIn(
                claim_text=hypothesis.hypothesis_text,
                claim_type="HYPOTHESIS",
                truth_status="INFERRED",
                provenance_label="SYSTEM_MEASURED",
                orbit_id=hypothesis.orbit_id,
                confidence=float(hypothesis.confidence or 0.5),
                subject_ref=subject_ref,
                predicate="supported_by_outcomes",
                object_value={"hypothesis_id": str(hypothesis.id)},
            ),
            trigger=f"Outcome {outcome.id} established a canonical hypothesis projection.",
        )

    now = dt.datetime.now(dt.timezone.utc)
    patch = {
        "confidence": float(hypothesis.confidence or 0.5),
        "last_supported_at" if supports else "last_contradicted_at": now,
        "support_count" if supports else "contradiction_count": (
            canonical.support_count + 1 if supports
            else canonical.contradiction_count + 1
        ),
    }
    next_support = patch.get("support_count", canonical.support_count)
    next_counter = patch.get("contradiction_count", canonical.contradiction_count)
    patch["epistemic_status"] = (
        "CONTESTED" if next_counter > next_support else "INFERRED"
    )
    canonical, _ = await mutate_canonical_claim(
        db,
        owner_user_id=owner_user_id,
        claim_id=canonical.id,
        patch=patch,
        change_class=(ChangeClass.UPDATED if supports else ChangeClass.CONTRADICTED),
        trigger=(
            f"Observed outcome {outcome.id} supported this hypothesis."
            if supports else
            f"Observed outcome {outcome.id} challenged this hypothesis."
        ),
        actor="system",
        supporting_evidence=[f"OUTCOME:{outcome.id}"] if supports else [],
        counter_evidence=[] if supports else [f"OUTCOME:{outcome.id}"],
        affected_future_behavior="Future cognition reads the revised canonical claim.",
    )
    compat = await sync_semantic_claim_projection(
        db, owner_user_id=owner_user_id, claim=canonical
    )
    db.add(ClaimEvidence(
        owner_user_id=owner_user_id,
        claim_id=compat.id,
        outcome_id=outcome.id,
        supports=supports,
        weight=1.0,
        rationale=rationale,
    ))
    return compat


async def revise_hypothesis_from_outcome(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    hypothesis: Hypothesis, outcome: Outcome, supports: bool, rationale: str,
) -> SemanticClaim:
    step = 0.1 if supports else -0.15
    hypothesis.confidence = max(
        0.0, min(1.0, (hypothesis.confidence or 0.5) + step)
    )
    if hypothesis.status in ("PROPOSED", "TESTING"):
        hypothesis.status = "TESTING"

    if get_settings().bplus_canonical_claims:
        return await _bplus_semantic_projection(
            db,
            owner_user_id=owner_user_id,
            hypothesis=hypothesis,
            outcome=outcome,
            supports=supports,
            rationale=rationale,
        )
    return await _legacy_semantic_claim(
        db,
        owner_user_id=owner_user_id,
        hypothesis=hypothesis,
        outcome=outcome,
        supports=supports,
        rationale=rationale,
    )
