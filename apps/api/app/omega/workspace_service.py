import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.brain.schemas import ScopeEnvelope
from app.mind.scope import ScopeResolutionError
from app.models import (
    OmegaClaim,
    OmegaContradiction,
    OmegaPrediction,
    OmegaWorkspaceFrame,
)
from app.omega.retrieval import retrieve_canonical_context
from app.omega.schemas import OmegaTalkSummary


async def build_workspace_frame(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    task_mode: str,
    active_question: str,
    scope_envelope: ScopeEnvelope,
    orbit_id: uuid.UUID | None = None,
    trigger_event_id: uuid.UUID | None = None,
) -> OmegaWorkspaceFrame:
    if (
        orbit_id is not None
        and scope_envelope.orbit_id is not None
        and orbit_id != scope_envelope.orbit_id
    ):
        raise ScopeResolutionError("Workspace orbit_id disagrees with the resolved ScopeEnvelope.")
    selected = await retrieve_canonical_context(
        db,
        owner_user_id=owner_user_id,
        scope_envelope=scope_envelope,
        query=active_question,
        active_goal=None,
        limit=6,
    )
    claims = selected.claims
    experiences = selected.experiences
    contradictions = selected.contradictions
    risk_flags = ["omega_context_owner_only", "scope_envelope_enforced"]
    if any(c.severity == "CRITICAL" for c in contradictions):
        risk_flags.append("critical_contradiction_blocks_affected_claims")
    frame = OmegaWorkspaceFrame(
        owner_user_id=owner_user_id,
        orbit_id=orbit_id or scope_envelope.orbit_id,
        task_mode=task_mode,
        trigger_event_id=trigger_event_id,
        active_question=active_question[:800],
        attention_items={
            "claim_summaries": [c.claim_text[:180] for c in claims],
            "experience_summaries": [e.summary[:180] for e in experiences],
            "contradiction_summaries": [c.description[:220] for c in contradictions],
            "score_explanations": selected.explanations,
        },
        retrieved_claim_ids=[c.id for c in claims],
        retrieved_experience_ids=[e.id for e in experiences],
        active_hypothesis_ids=[c.id for c in claims if c.truth_status == "HYPOTHESIS"][:3],
        active_contradiction_ids=[c.id for c in contradictions],
        risk_flags=risk_flags,
        scope_statement=((scope_envelope.reason + "; ") if scope_envelope.reason else "") + "ScopeEnvelope-enforced Omega workspace; no chain-of-thought, no raw journal dump, no capsule-recipient data.",
    )
    db.add(frame)
    await db.flush()
    return frame


async def mark_frame_used(db: AsyncSession, frame: OmegaWorkspaceFrame) -> None:
    frame.status = "USED"
    await db.flush()


async def talk_summary(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    workspace_frame_id: uuid.UUID | None,
    scope_envelope: ScopeEnvelope,
) -> OmegaTalkSummary:
    if scope_envelope.owner_user_id != owner_user_id:
        raise ScopeResolutionError("ScopeEnvelope owner mismatch blocks Omega talk summary.")
    if any((scope_envelope.project_id, scope_envelope.capsule_id, scope_envelope.community_id)):
        return OmegaTalkSummary(workspace_frame_id=workspace_frame_id)

    claim_q = select(OmegaClaim).where(
        OmegaClaim.owner_user_id == owner_user_id, OmegaClaim.support_count > 0
    )
    contradiction_q = select(OmegaContradiction).where(
        OmegaContradiction.owner_user_id == owner_user_id, OmegaContradiction.status == "OPEN"
    )
    prediction_q = select(OmegaPrediction).where(
        OmegaPrediction.owner_user_id == owner_user_id, OmegaPrediction.status == "OPEN"
    )
    if scope_envelope.orbit_id is not None:
        claim_q = claim_q.where(OmegaClaim.orbit_id == scope_envelope.orbit_id)
        contradiction_q = contradiction_q.where(OmegaContradiction.orbit_id == scope_envelope.orbit_id)
        prediction_q = prediction_q.where(OmegaPrediction.orbit_id == scope_envelope.orbit_id)

    claims = (await db.execute(
        claim_q.order_by(OmegaClaim.updated_at.desc()).limit(1)
    )).scalars().all()
    contradictions = (await db.execute(
        contradiction_q.order_by(OmegaContradiction.created_at.desc()).limit(1)
    )).scalars().all()
    predictions = (await db.execute(
        prediction_q.order_by(OmegaPrediction.created_at.desc()).limit(1)
    )).scalars().all()
    return OmegaTalkSummary(
        workspace_frame_id=workspace_frame_id,
        what_changed=[f"Claim strengthened: {c.claim_text}" for c in claims],
        open_contradictions=[c.description for c in contradictions],
        unresolved_predictions=[p.prediction_text for p in predictions],
    )
