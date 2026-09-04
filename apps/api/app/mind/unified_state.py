"""One transient owner-scoped cognitive state assembled per Mind turn.

This is not a new durable brain or a second source of truth. It is a frozen
projection of already-canonical/scoped sources after ScopeEnvelope resolution and
before worker/provider dispatch. The Brain receives curated projections from this
state rather than independently hydrated parallel lists.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.brain.schemas import (
    ContextManifest,
    IdentitySnapshot,
    ScopeEnvelope,
    SelfCapabilities,
)
from app.core.config import get_settings
from app.mind.capabilities.hydrator import ContextHydrator
from app.mind.identity import load_identity
from app.mind.self_model import get_self_capabilities
from app.mind.working_memory import build_context_manifest
from app.models import OmegaClaim, OmegaClaimVersion, OmegaContradiction, Prediction


class UnifiedCognitiveState(BaseModel):
    """Frozen, non-durable state carrier for exactly one scoped cognitive turn."""

    contract_version: Literal["bplus-cognitive-state-v1"] = "bplus-cognitive-state-v1"
    owner_user_id: uuid.UUID
    scope_envelope: ScopeEnvelope
    active_question: str
    identity: IdentitySnapshot
    self_capabilities: SelfCapabilities
    context_manifest: ContextManifest
    workspace_frame_id: str | None = None

    selected_claim_ids: list[str] = Field(default_factory=list)
    selected_experience_ids: list[str] = Field(default_factory=list)
    canonical_claims: list[dict[str, Any]] = Field(default_factory=list)
    approved_memories: list[dict[str, Any]] = Field(default_factory=list)
    user_projections: list[dict[str, Any]] = Field(default_factory=list)
    world_refs: list[dict[str, Any]] = Field(default_factory=list)
    predictions: list[dict[str, Any]] = Field(default_factory=list)
    contradictions: list[dict[str, Any]] = Field(default_factory=list)
    continuity_receipts: list[dict[str, Any]] = Field(default_factory=list)
    capabilities: list[dict[str, Any]] = Field(default_factory=list)
    evidence_refs: list[dict[str, Any]] = Field(default_factory=list)

    attention_items: dict[str, Any] = Field(default_factory=dict)
    attention_explanations: dict[str, dict[str, Any]] = Field(default_factory=dict)
    semantic_family_counts: dict[str, int] = Field(default_factory=dict)
    active_beliefs: list[str] = Field(default_factory=list)
    active_hypotheses: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    state_digest: str = ""


def _owned_scoped(
    items: list[dict[str, Any]], *, owner_user_id: uuid.UUID, scope: ScopeEnvelope
) -> list[dict[str, Any]]:
    """Defence-in-depth filter for projections already expected to be scoped."""
    out: list[dict[str, Any]] = []
    boundaries = (
        ("orbit_id", scope.orbit_id),
        ("project_id", scope.project_id),
        ("capsule_id", scope.capsule_id),
        ("community_id", scope.community_id),
    )
    for item in items:
        if str(item.get("owner_user_id", "")) != str(owner_user_id):
            continue
        matched = True
        for key, expected in boundaries:
            if expected is not None and str(item.get(key, "")) != str(expected):
                matched = False
                break
        if matched:
            out.append(dict(item))
    return out


def _claim_projection(row: OmegaClaim) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "orbit_id": str(row.orbit_id) if row.orbit_id else None,
        "claim_text": row.claim_text,
        "claim_type": row.claim_type,
        "truth_status": row.truth_status,
        "epistemic_status": row.epistemic_status,
        "authority_status": row.authority_status,
        "confidence": row.confidence,
        "current_version": row.current_version,
    }


def _contradiction_projection(row: OmegaContradiction) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "orbit_id": str(row.orbit_id) if row.orbit_id else None,
        "claim_a_id": str(row.claim_a_id),
        "claim_b_id": str(row.claim_b_id),
        "status": row.status,
        "severity": row.severity,
        "description": row.description,
    }


def _prediction_projection(row: Prediction) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "orbit_id": str(row.orbit_id) if row.orbit_id else None,
        "statement": row.statement,
        "expected_observation": dict(row.expected_observation or {}),
        "metric": row.metric,
        "confidence": float(row.confidence) if row.confidence is not None else None,
        "horizon_days": row.horizon_days,
        "status": row.status,
        "resolution": row.resolution,
    }


async def _recent_continuity_receipts(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    scope: ScopeEnvelope,
    limit: int = 3,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return bounded persisted falsification receipts for the next scoped turn."""
    if any((scope.project_id, scope.capsule_id, scope.community_id)):
        return [], []
    q = select(Prediction).where(
        Prediction.owner_user_id == owner_user_id,
        Prediction.status == "RESOLVED",
        Prediction.resolution.is_not(None),
        Prediction.resolved_outcome_id.is_not(None),
        Prediction.omega_claim_id.is_not(None),
    )
    if scope.orbit_id is not None:
        q = q.where(Prediction.orbit_id == scope.orbit_id)
    rows = (await db.execute(
        q.order_by(Prediction.resolved_at.desc()).limit(max(1, min(limit, 3)))
    )).scalars().all()
    receipts: list[dict[str, Any]] = []
    refs: list[dict[str, Any]] = []
    for prediction in rows:
        claim = (await db.execute(select(OmegaClaim).where(
            OmegaClaim.owner_user_id == owner_user_id,
            OmegaClaim.id == prediction.omega_claim_id,
        ))).scalar_one_or_none()
        if claim is None:
            continue
        version = (await db.execute(select(OmegaClaimVersion).where(
            OmegaClaimVersion.owner_user_id == owner_user_id,
            OmegaClaimVersion.claim_id == claim.id,
            OmegaClaimVersion.version == claim.current_version,
        ))).scalar_one_or_none()
        if version is None:
            continue
        claim_ref = f"OMEGA_CLAIM_VERSION:{version.id}"
        prediction_ref = f"PREDICTION:{prediction.id}"
        outcome_ref = f"OUTCOME:{prediction.resolved_outcome_id}"
        receipts.append({
            "claim_id": str(claim.id),
            "claim_version": claim.current_version,
            "claim_version_id": str(version.id),
            "prediction_id": str(prediction.id),
            "prediction_resolution": prediction.resolution,
            "outcome_id": str(prediction.resolved_outcome_id),
            "source_refs": [claim_ref, prediction_ref, outcome_ref],
        })
        refs.extend([
            {
                "kind": "OMEGA_CLAIM_VERSION",
                "id": str(version.id),
                "excerpt": (
                    f"Canonical claim {claim.id} version {claim.current_version}: "
                    f"epistemic={claim.epistemic_status}, authority={claim.authority_status}."
                ),
                "rank": 1.0,
            },
            {
                "kind": "PREDICTION",
                "id": str(prediction.id),
                "excerpt": f"Persisted prediction resolution: {prediction.resolution}.",
                "rank": 0.99,
            },
            {
                "kind": "OUTCOME",
                "id": str(prediction.resolved_outcome_id),
                "excerpt": f"Observed outcome resolved prediction {prediction.id}.",
                "rank": 0.98,
            },
        ])
    return receipts, refs


def _digest(state: UnifiedCognitiveState) -> str:
    payload = state.model_dump(mode="json", exclude={"state_digest"})
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


async def build_unified_cognitive_state(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    active_question: str,
    scope_envelope: ScopeEnvelope,
    workspace_frame: Any,
    semantic_projection: dict[str, list[dict[str, Any]]] | None = None,
    retrieved_refs: list[dict[str, Any]] | None = None,
    capability_context: dict[str, Any] | None = None,
    world_refs: list[dict[str, Any]] | None = None,
    withheld_items: list[dict[str, Any]] | None = None,
    token_budget: int = 4096,
) -> UnifiedCognitiveState:
    """Assemble one state from canonical/scoped sources for the current turn."""
    if scope_envelope.owner_user_id != owner_user_id:
        raise PermissionError("ScopeEnvelope owner mismatch blocks unified cognitive state.")

    frame_orbit = getattr(workspace_frame, "orbit_id", None)
    if (
        frame_orbit is not None
        and scope_envelope.orbit_id is not None
        and str(frame_orbit) != str(scope_envelope.orbit_id)
    ):
        raise PermissionError("Workspace frame scope disagrees with ScopeEnvelope.")

    claim_ids = list(getattr(workspace_frame, "retrieved_claim_ids", []) or [])
    experience_ids = list(getattr(workspace_frame, "retrieved_experience_ids", []) or [])
    contradiction_ids = list(getattr(workspace_frame, "active_contradiction_ids", []) or [])

    narrow_scope = any(
        (scope_envelope.project_id, scope_envelope.capsule_id, scope_envelope.community_id)
    )
    claims: list[OmegaClaim] = []
    if claim_ids and not narrow_scope:
        claim_q = select(OmegaClaim).where(
            OmegaClaim.owner_user_id == owner_user_id,
            OmegaClaim.id.in_(claim_ids),
        )
        if scope_envelope.orbit_id is not None:
            claim_q = claim_q.where(OmegaClaim.orbit_id == scope_envelope.orbit_id)
        rows = (await db.execute(claim_q)).scalars().all()
        by_id = {row.id: row for row in rows}
        claims = [by_id[item] for item in claim_ids if item in by_id]

    contradictions: list[OmegaContradiction] = []
    if contradiction_ids and not narrow_scope:
        contradiction_q = select(OmegaContradiction).where(
            OmegaContradiction.owner_user_id == owner_user_id,
            OmegaContradiction.id.in_(contradiction_ids),
        )
        if scope_envelope.orbit_id is not None:
            contradiction_q = contradiction_q.where(
                OmegaContradiction.orbit_id == scope_envelope.orbit_id
            )
        rows = (await db.execute(contradiction_q)).scalars().all()
        by_id = {row.id: row for row in rows}
        contradictions = [by_id[item] for item in contradiction_ids if item in by_id]

    predictions: list[Prediction] = []
    # Narrow scopes cannot be proven by Prediction rows today; fail closed rather
    # than silently widening them to Orbit/account scope.
    if not narrow_scope:
        prediction_q = select(Prediction).where(
            Prediction.owner_user_id == owner_user_id,
            Prediction.status == "OPEN",
            Prediction.resolution.is_(None),
        )
        if scope_envelope.orbit_id is not None:
            prediction_q = prediction_q.where(Prediction.orbit_id == scope_envelope.orbit_id)
        predictions = (
            await db.execute(prediction_q.order_by(Prediction.created_at.desc()).limit(6))
        ).scalars().all()

    scope_statement = (
        getattr(workspace_frame, "scope_statement", None)
        or scope_envelope.reason
        or "ScopeEnvelope-enforced owner context"
    )
    continuity_receipts, continuity_refs = await _recent_continuity_receipts(
        db, owner_user_id=owner_user_id, scope=scope_envelope
    )
    manifest, filtered_evidence = build_context_manifest(
        retrieved_refs=[*continuity_refs, *(retrieved_refs or [])],
        withheld_items=withheld_items,
        scope_statement=scope_statement,
        token_budget=token_budget,
    )

    semantic_raw = semantic_projection or {}
    semantic_budget = max(0, int(token_budget) - int(manifest.token_used))
    semantic_hydrated = ContextHydrator.hydrate_semantic_sources(
        scope_envelope,
        approved_memory=semantic_raw.get("approved_memory", []),
        memory_candidates=semantic_raw.get("memory_candidates", []),
        beliefs=semantic_raw.get("beliefs", []),
        user_model_claims=semantic_raw.get("user_model_claims", []),
        research_results=semantic_raw.get("research_results", []),
        semantic_context=semantic_raw.get("semantic_context", []),
        token_budget=semantic_budget,
    )
    semantic = {
        "approved_memory": semantic_hydrated.approved_memory,
        "memory_candidates": semantic_hydrated.memory_candidates,
        "beliefs": semantic_hydrated.beliefs,
        "user_model_claims": semantic_hydrated.user_model_claims,
        "research_results": semantic_hydrated.research_results,
        "semantic_context": semantic_hydrated.semantic_context,
    }
    approved = [
        item
        for item in _owned_scoped(
            semantic.get("approved_memory", []),
            owner_user_id=owner_user_id,
            scope=scope_envelope,
        )
        if str(item.get("status", "APPROVED")).upper() in {"APPROVED", "OWNER_APPROVED"}
    ]
    legacy_beliefs = _owned_scoped(
        semantic.get("beliefs", []), owner_user_id=owner_user_id, scope=scope_envelope
    )
    user_projections = _owned_scoped(
        semantic.get("user_model_claims", []),
        owner_user_id=owner_user_id,
        scope=scope_envelope,
    )

    attention = dict(getattr(workspace_frame, "attention_items", {}) or {})
    canonical_enabled = get_settings().bplus_canonical_claims
    canonical_beliefs = [
        row.claim_text for row in claims if row.truth_status in {"OBSERVED", "INFERRED"}
    ]
    semantic_legacy_beliefs = [
        str(item.get("claim") or item.get("claim_text"))
        for item in legacy_beliefs
        if item.get("claim") or item.get("claim_text")
    ]
    # Exact legacy shadow: before Task 11 the workspace frame's selected claim
    # summaries replaced semantic-list beliefs at packet assembly time. Keeping
    # this branch lets the canonical flag be compared against the old visible
    # projection rather than against a subtly different fallback.
    legacy_beliefs_visible = list(attention.get("claim_summaries", []) or [])
    if not legacy_beliefs_visible:
        legacy_beliefs_visible = semantic_legacy_beliefs
    active_beliefs = (
        canonical_beliefs if canonical_enabled and canonical_beliefs else legacy_beliefs_visible
    )
    active_hypotheses = [row.claim_text for row in claims if row.truth_status == "HYPOTHESIS"][:3]

    state = UnifiedCognitiveState(
        owner_user_id=owner_user_id,
        scope_envelope=scope_envelope,
        active_question=active_question,
        identity=load_identity(),
        self_capabilities=await get_self_capabilities(db, owner_user_id),
        context_manifest=manifest,
        workspace_frame_id=(
            str(workspace_frame.id) if getattr(workspace_frame, "id", None) else None
        ),
        selected_claim_ids=[str(item) for item in claim_ids],
        selected_experience_ids=[str(item) for item in experience_ids],
        canonical_claims=[_claim_projection(row) for row in claims],
        approved_memories=approved,
        user_projections=user_projections,
        world_refs=list(world_refs if world_refs is not None else filtered_evidence),
        predictions=[_prediction_projection(row) for row in predictions],
        contradictions=[_contradiction_projection(row) for row in contradictions],
        continuity_receipts=continuity_receipts,
        capabilities=[dict(capability_context)] if capability_context else [],
        evidence_refs=list(filtered_evidence),
        attention_items=attention,
        attention_explanations=dict(attention.get("score_explanations", {}) or {}),
        semantic_family_counts={key: len(value) for key, value in semantic.items()},
        active_beliefs=active_beliefs,
        active_hypotheses=active_hypotheses,
        risk_flags=list(getattr(workspace_frame, "risk_flags", []) or []),
    )
    return state.model_copy(update={"state_digest": _digest(state)})
