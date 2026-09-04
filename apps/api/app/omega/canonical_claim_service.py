from __future__ import annotations

import datetime as dt
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mind.why_changed import (
    ChangeClass,
    EntityType,
    WhyChangedRecord,
    WhyChangedService,
)
from app.models import OmegaClaim, OmegaClaimVersion
from app.omega.contracts import (
    AuthorityStatus,
    CanonicalClaimSnapshot,
    authority_from_provenance,
    epistemic_from_truth_status,
)
from app.omega.evidence_graph import link_evidence
from app.omega.safety_law import allowed_truth_status_for_provenance, redact_secrets
from app.omega.schemas import OmegaClaimIn

_MUTABLE_FIELDS = {
    "claim_text",
    "claim_type",
    "subject_ref",
    "predicate",
    "object_value",
    "scope",
    "valid_from",
    "valid_until",
    "truth_status",
    "epistemic_status",
    "authority_status",
    "confidence",
    "uncertainty_kind",
    "falsification_condition",
    "support_count",
    "contradiction_count",
    "last_supported_at",
    "last_contradicted_at",
}


def snapshot_claim(claim: OmegaClaim) -> CanonicalClaimSnapshot:
    return CanonicalClaimSnapshot(
        claim_id=claim.id,
        version=claim.current_version,
        claim_text=claim.claim_text,
        claim_type=claim.claim_type,        orbit_id=claim.orbit_id,
        scope=claim.scope,
        subject_ref=claim.subject_ref,
        predicate=claim.predicate,
        object_value=claim.object_value or {},
        valid_from=claim.valid_from,
        valid_until=claim.valid_until,
        epistemic_status=claim.epistemic_status,
        authority_status=claim.authority_status,
        confidence=float(claim.confidence or 0.0),
        uncertainty_kind=claim.uncertainty_kind,
        falsification_condition=claim.falsification_condition,
        support_count=claim.support_count,
        contradiction_count=claim.contradiction_count,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
    )


def _evidence_digest(refs: list[str]) -> str | None:
    if not refs:
        return None
    payload = json.dumps(sorted(refs), separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _actor_for_authority(authority: AuthorityStatus) -> str:
    if authority in {
        AuthorityStatus.OWNER_STATED,
        AuthorityStatus.OWNER_CONFIRMED,        AuthorityStatus.OWNER_CORRECTED,
    }:
        return "owner"
    if authority == AuthorityStatus.RESEARCH_DERIVED:
        return "research"
    return "system"


async def _persist_version(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim: OmegaClaim,
    why: WhyChangedRecord,
    change_class: ChangeClass,
    actor: str,
    evidence_refs: list[str],
) -> OmegaClaimVersion:
    version = OmegaClaimVersion(
        owner_user_id=owner_user_id,
        claim_id=claim.id,
        version=claim.current_version,
        snapshot=snapshot_claim(claim).model_dump(mode="json"),
        why_changed_id=why.id,
        change_class=change_class.value,
        actor=actor,
        evidence_digest=_evidence_digest(evidence_refs),
    )
    db.add(version)
    await db.flush()
    return version

async def create_canonical_claim(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    payload: OmegaClaimIn,
    authority_override: AuthorityStatus | None = None,
    actor_override: str | None = None,
    trigger: str | None = None,
) -> OmegaClaim:
    text_value, secret_found = redact_secrets(payload.claim_text, max_len=1600)
    truth_status = allowed_truth_status_for_provenance(
        payload.provenance_label, payload.truth_status
    )
    if secret_found:
        truth_status = "HYPOTHESIS"
    authority = authority_override or authority_from_provenance(payload.provenance_label)
    actor = actor_override or _actor_for_authority(authority)
    claim = OmegaClaim(
        owner_user_id=owner_user_id,
        orbit_id=payload.orbit_id,
        claim_text=text_value,
        claim_type=payload.claim_type,
        truth_status=truth_status,
        subject_ref=payload.subject_ref,
        predicate=payload.predicate,
        object_value=payload.object_value,        scope=payload.scope,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        epistemic_status=epistemic_from_truth_status(truth_status).value,
        authority_status=authority.value,
        uncertainty_kind=payload.uncertainty_kind,
        falsification_condition=payload.falsification_condition,
        current_version=1,
        confidence=payload.confidence,
    )
    db.add(claim)
    await db.flush()

    evidence_refs: list[str] = []
    if payload.evidence_id:
        await link_evidence(
            db,
            owner_user_id=owner_user_id,
            claim_id=claim.id,
            evidence_kind=payload.evidence_kind,
            evidence_id=payload.evidence_id,
            relation="SUPPORTS",
            note=f"created from {payload.provenance_label}",
        )
        evidence_refs.append(f"{payload.evidence_kind}:{payload.evidence_id}")

    why = await WhyChangedService.record_change(
        db,
        owner_user_id=owner_user_id,
        entity_type=EntityType.OMEGA_CLAIM,        entity_id=str(claim.id),
        change_class=ChangeClass.CREATED,
        trigger=trigger or f"Canonical claim created from {payload.provenance_label}.",
        previous_version=None,
        new_version="1",
        supporting_evidence=evidence_refs,
        actor=actor,
        affected_future_behavior="This claim is now available to scoped NUR cognition.",
    )
    await _persist_version(
        db,
        owner_user_id=owner_user_id,
        claim=claim,
        why=why,
        change_class=ChangeClass.CREATED,
        actor=actor,
        evidence_refs=evidence_refs,
    )
    return claim


async def _owned_claim_for_update(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim_id: uuid.UUID,
) -> OmegaClaim:
    row = (
        await db.execute(
            select(OmegaClaim)
            .where(OmegaClaim.id == claim_id, OmegaClaim.owner_user_id == owner_user_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if row is None:
        raise PermissionError("Claim not found.")
    return row


async def mutate_canonical_claim(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim_id: uuid.UUID,
    patch: dict[str, Any],
    change_class: ChangeClass,
    trigger: str,
    actor: str,
    supporting_evidence: list[str] | None = None,
    counter_evidence: list[str] | None = None,
    owner_correction: bool = False,
    affected_future_behavior: str = "",
) -> tuple[OmegaClaim, WhyChangedRecord | None]:
    unknown = set(patch) - _MUTABLE_FIELDS
    if unknown:
        raise ValueError(f"Unsupported canonical claim fields: {sorted(unknown)}")

    claim = await _owned_claim_for_update(
        db, owner_user_id=owner_user_id, claim_id=claim_id
    )
    previous_version = claim.current_version
    changed = False
    for field, value in patch.items():
        normalized = value.value if hasattr(value, "value") else value
        if getattr(claim, field) != normalized:
            setattr(claim, field, normalized)
            changed = True
    if not changed:
        return claim, None

    claim.current_version = previous_version + 1
    claim.updated_at = dt.datetime.now(dt.timezone.utc)
    evidence_refs = [*(supporting_evidence or []), *(counter_evidence or [])]
    why = await WhyChangedService.record_change(
        db,
        owner_user_id=owner_user_id,
        entity_type=EntityType.OMEGA_CLAIM,
        entity_id=str(claim.id),
        change_class=change_class,
        trigger=trigger,
        previous_version=str(previous_version),
        new_version=str(claim.current_version),
        supporting_evidence=supporting_evidence or [],
        counter_evidence=counter_evidence or [],
        owner_correction=owner_correction,
        actor=actor,
        affected_future_behavior=affected_future_behavior,
        rollback_target=f"omega_claim:{claim.id}:v{previous_version}",
    )
    await _persist_version(
        db,
        owner_user_id=owner_user_id,
        claim=claim,
        why=why,
        change_class=change_class,
        actor=actor,
        evidence_refs=evidence_refs,
    )
    await db.flush()
    return claim, why


async def version_canonical_claim_after_evidence_change(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim_id: uuid.UUID,
    change_class: ChangeClass,
    trigger: str,
    supporting_evidence: list[str] | None = None,
    counter_evidence: list[str] | None = None,
    affected_future_behavior: str = "",
) -> tuple[OmegaClaim, WhyChangedRecord]:
    """Version a claim after an evidence edge already changed its canonical state.

    Evidence linkage updates counters/status in the same transaction. This helper
    makes that mutation part of the canonical version ledger instead of leaving a
    silent in-place change with no WhyChanged lineage.
    """
    claim = await _owned_claim_for_update(
        db, owner_user_id=owner_user_id, claim_id=claim_id
    )
    previous_version = claim.current_version
    claim.epistemic_status = epistemic_from_truth_status(claim.truth_status).value
    claim.current_version = previous_version + 1
    claim.updated_at = dt.datetime.now(dt.timezone.utc)
    evidence_refs = [*(supporting_evidence or []), *(counter_evidence or [])]
    why = await WhyChangedService.record_change(
        db,
        owner_user_id=owner_user_id,
        entity_type=EntityType.OMEGA_CLAIM,
        entity_id=str(claim.id),
        change_class=change_class,
        trigger=trigger,
        previous_version=str(previous_version),
        new_version=str(claim.current_version),
        supporting_evidence=supporting_evidence or [],
        counter_evidence=counter_evidence or [],
        actor="system",
        affected_future_behavior=affected_future_behavior,
        rollback_target=f"omega_claim:{claim.id}:v{previous_version}",
    )
    await _persist_version(
        db,
        owner_user_id=owner_user_id,
        claim=claim,
        why=why,
        change_class=change_class,
        actor="system",
        evidence_refs=evidence_refs,
    )
    await db.flush()
    return claim, why


async def confirm_claim_authority(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim_id: uuid.UUID,
) -> tuple[OmegaClaim, WhyChangedRecord | None]:
    return await mutate_canonical_claim(
        db,
        owner_user_id=owner_user_id,
        claim_id=claim_id,
        patch={"authority_status": AuthorityStatus.OWNER_CONFIRMED},
        change_class=ChangeClass.PROMOTED,
        trigger="Owner explicitly confirmed this canonical proposition.",
        actor="owner",
        affected_future_behavior=(
            "Future scoped cognition may treat owner confirmation as authority, "
            "without converting inference into observation."
        ),
    )
