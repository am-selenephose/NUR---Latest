from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mind.beliefs import Belief, BeliefKind, BeliefStatus
from app.mind.user_model import ClaimClass, UserModelClaim, UserModelService
from app.models import (
    Insight,
    OmegaClaim,
    OrbitRelationalInsight,
    PersonalMemory,
    SemanticClaim,
)
from app.omega.contracts import AuthorityStatus, EpistemicStatus


def _belief_kind(status: str) -> BeliefKind:
    if status == EpistemicStatus.OBSERVED.value:
        return BeliefKind.OBSERVATION
    if status == EpistemicStatus.HYPOTHESIS.value:
        return BeliefKind.HYPOTHESIS
    return BeliefKind.INFERENCE


def _belief_status(claim: OmegaClaim) -> BeliefStatus:
    status = claim.epistemic_status
    if status == EpistemicStatus.CONTESTED.value:
        return BeliefStatus.CONTESTED
    if status == EpistemicStatus.CONTRADICTED.value:
        return BeliefStatus.CONTRADICTED
    if status in {EpistemicStatus.SUPERSEDED.value, EpistemicStatus.RETIRED.value}:
        return BeliefStatus.RETRACTED
    if status == EpistemicStatus.OBSERVED.value or claim.support_count > 0:
        return BeliefStatus.SUPPORTED
    return BeliefStatus.CANDIDATE


def _source_authority(authority: str) -> str:
    mapping = {
        AuthorityStatus.OWNER_STATED.value: "owner",
        AuthorityStatus.OWNER_CONFIRMED.value: "owner",
        AuthorityStatus.OWNER_CORRECTED.value: "owner",
        AuthorityStatus.SYSTEM_MEASURED.value: "outcome",
        AuthorityStatus.RESEARCH_DERIVED.value: "research",
        AuthorityStatus.MODEL_PROPOSED.value: "model",
        AuthorityStatus.LEGACY_UNRESOLVED.value: "legacy_unresolved",
    }
    return mapping.get(authority, "legacy_unresolved")


def project_belief(claim: OmegaClaim, *, domain: str = "general") -> Belief:
    return Belief(
        id=claim.id,
        owner_user_id=claim.owner_user_id,
        kind=_belief_kind(claim.epistemic_status),
        status=_belief_status(claim),
        claim_text=claim.claim_text,
        domain=domain,
        source_authority=_source_authority(claim.authority_status),
        confidence=float(claim.confidence or 0.0),
        uncertainty_kind=claim.uncertainty_kind,
        falsification_condition=claim.falsification_condition,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
        version=claim.current_version,
    )


def _user_claim_class(claim: OmegaClaim) -> ClaimClass:
    if claim.epistemic_status == EpistemicStatus.CONTRADICTED.value:
        return ClaimClass.CONTRADICTED
    if claim.epistemic_status in {
        EpistemicStatus.SUPERSEDED.value,
        EpistemicStatus.RETIRED.value,
    }:
        return ClaimClass.RETRACTED
    mapping = {
        AuthorityStatus.OWNER_STATED.value: ClaimClass.OWNER_STATED,
        AuthorityStatus.OWNER_CONFIRMED.value: ClaimClass.OWNER_CONFIRMED,
        AuthorityStatus.OWNER_CORRECTED.value: ClaimClass.OWNER_CORRECTED,
        AuthorityStatus.SYSTEM_MEASURED.value: ClaimClass.OBSERVED_PATTERN,
        AuthorityStatus.RESEARCH_DERIVED.value: ClaimClass.RESEARCH_DERIVED,
    }
    return mapping.get(claim.authority_status, ClaimClass.NUR_INFERRED)


def project_user_model_claim(
    claim: OmegaClaim, *, domain: str = "general"
) -> UserModelClaim:
    projected = UserModelService.create_claim(
        owner_user_id=claim.owner_user_id,
        claim_text=claim.claim_text,
        claim_class=_user_claim_class(claim),
        domain=domain,
        source_refs=[f"omega_claim:{claim.id}:v{claim.current_version}"],
        confidence=float(claim.confidence or 0.0),
    )
    return projected.model_copy(update={"id": claim.id, "version": claim.current_version})


def _semantic_status(claim: OmegaClaim) -> str:
    if claim.epistemic_status in {
        EpistemicStatus.SUPERSEDED.value,
        EpistemicStatus.RETIRED.value,
    }:
        return "ARCHIVED"
    if claim.epistemic_status in {
        EpistemicStatus.CONTESTED.value,
        EpistemicStatus.CONTRADICTED.value,
    }:
        return "DISPUTED"
    if claim.support_count >= 2 and claim.contradiction_count == 0:
        return "SUPPORTED"
    if claim.support_count and claim.contradiction_count:
        return "MIXED"
    return "EMERGING"


async def sync_semantic_claim_projection(
    db: AsyncSession, *, owner_user_id: uuid.UUID, claim: OmegaClaim
) -> SemanticClaim:
    if claim.owner_user_id != owner_user_id:
        raise PermissionError("Canonical claim owner mismatch.")
    row = (await db.execute(select(SemanticClaim).where(
        SemanticClaim.owner_user_id == owner_user_id,
        SemanticClaim.canonical_omega_claim_id == claim.id,
    ))).scalar_one_or_none()
    if row is None:
        row = SemanticClaim(owner_user_id=owner_user_id, claim_text=claim.claim_text)
        db.add(row)
    row.canonical_omega_claim_id = claim.id
    row.claim_text = claim.claim_text
    row.subject_ref = claim.subject_ref
    row.predicate = claim.predicate
    row.object_value = claim.object_value or {}
    row.confidence = float(claim.confidence or 0.0)
    row.status = _semantic_status(claim)
    row.evidence_count = claim.support_count
    row.counterevidence_count = claim.contradiction_count
    row.last_evaluated_at = claim.updated_at
    await db.flush()
    return row


async def _owned_claim(
    db: AsyncSession, *, owner_user_id: uuid.UUID, claim_id: uuid.UUID
) -> OmegaClaim:
    claim = (await db.execute(select(OmegaClaim).where(
        OmegaClaim.id == claim_id,
        OmegaClaim.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if claim is None:
        raise PermissionError("Canonical Omega claim not found.")
    return claim


async def link_memory_projection(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    memory_id: uuid.UUID, claim_id: uuid.UUID,
) -> PersonalMemory:
    await _owned_claim(db, owner_user_id=owner_user_id, claim_id=claim_id)
    row = (await db.execute(select(PersonalMemory).where(
        PersonalMemory.id == memory_id,
        PersonalMemory.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if row is None:
        raise PermissionError("Memory projection not found.")
    row.canonical_omega_claim_id = claim_id
    await db.flush()
    return row


async def link_insight_projection(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    insight_id: uuid.UUID, claim_id: uuid.UUID,
) -> Insight:
    await _owned_claim(db, owner_user_id=owner_user_id, claim_id=claim_id)
    row = (await db.execute(select(Insight).where(
        Insight.id == insight_id,
        Insight.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if row is None:
        raise PermissionError("Insight projection not found.")
    row.canonical_omega_claim_id = claim_id
    await db.flush()
    return row


async def link_relational_projection(
    db: AsyncSession, *, owner_user_id: uuid.UUID,
    relational_insight_id: uuid.UUID, claim_id: uuid.UUID,
) -> OrbitRelationalInsight:
    await _owned_claim(db, owner_user_id=owner_user_id, claim_id=claim_id)
    row = (await db.execute(select(OrbitRelationalInsight).where(
        OrbitRelationalInsight.id == relational_insight_id,
        OrbitRelationalInsight.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if row is None:
        raise PermissionError("Relational projection not found.")
    row.canonical_omega_claim_id = claim_id
    await db.flush()
    return row
