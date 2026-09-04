import datetime as dt
import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.learning.hardness.candidates import (
    apply_selector_judgment,
    assess_candidate_risks,
    ingest_candidate_from_signal,
)
from app.learning.hardness.schemas import LearningIntervention, LearningSignalKind
from app.learning.hardness.selector import CurriculumSelector
from app.learning.hardness.signals import persist_learning_signal
from app.models import OmegaLearningProposal
from app.omega.safety_law import ensure_proposal_allowed, proposal_risk, redact_secrets
from app.omega.schemas import OmegaLearningProposalIn


async def create_learning_proposal(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    payload: OmegaLearningProposalIn,
) -> OmegaLearningProposal:
    ensure_proposal_allowed(payload.description, payload.proposal_kind)
    description, _ = redact_secrets(payload.description, max_len=1600)
    evidence_summary, _ = redact_secrets(payload.evidence_summary, max_len=1600)
    row = OmegaLearningProposal(
        owner_user_id=owner_user_id,
        proposal_kind=payload.proposal_kind,
        description=description,
        evidence_summary=evidence_summary,
        supporting_evaluation_ids=payload.supporting_evaluation_ids,
        risk_level=proposal_risk(description, payload.proposal_kind),
        status="PROPOSED",
    )
    db.add(row)
    await db.flush()
    await _emit_hardness_candidate(
        db, owner_user_id=owner_user_id, row=row, payload=payload
    )
    return row


async def list_learning_proposals(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    limit: int = 50,
) -> list[OmegaLearningProposal]:
    q = (
        select(OmegaLearningProposal)
        .where(OmegaLearningProposal.owner_user_id == owner_user_id)
        .order_by(OmegaLearningProposal.created_at.desc())
        .limit(min(limit, 200))
    )
    return list((await db.execute(q)).scalars())


async def transition_learning_proposal(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    proposal_id: uuid.UUID,
    action: str,
) -> OmegaLearningProposal:
    row = (await db.execute(select(OmegaLearningProposal).where(
        OmegaLearningProposal.id == proposal_id,
        OmegaLearningProposal.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if not row:
        raise PermissionError("Learning proposal not found.")
    if row.risk_level == "FORBIDDEN":
        raise PermissionError("Forbidden learning proposals cannot be promoted.")
    if action == "approve":
        policy_signal = await _policy_replay_signal(
            db, owner_user_id=owner_user_id, proposal_id=row.id
        )
        if policy_signal is not None:
            result = await _evaluate_policy_proposal(
                db, owner_user_id=owner_user_id, row=row, signal=policy_signal
            )
            if result.eval_result is None:
                raise ValueError("Hardness policy replay evaluation did not produce a verdict.")
            if result.eval_result.verdict == "PASS" and result.eval_result.all_critical_gates_passed:
                row.status = "APPROVED"
                row.approved_by_owner = True
            else:
                row.status = "REJECTED"
                row.approved_by_owner = False
        else:
            row.status = "APPROVED"
            row.approved_by_owner = True
    elif action == "reject":
        row.status = "REJECTED"
        row.approved_by_owner = False
    elif action == "rollback":
        row.status = "ROLLED_BACK"
        row.approved_by_owner = False
    else:
        raise ValueError("Unknown learning proposal action.")
    row.updated_at = dt.datetime.now(dt.UTC)
    await db.flush()
    return row


POLICY_REPLAY_KINDS = {
    "RETRIEVAL_WEIGHT",
    "PROMPT_RULE",
    "PLANNING_HEURISTIC",
    "HYPOTHESIS_POLICY",
}


def _capability_for_kind(proposal_kind: str) -> str:
    return {
        "RETRIEVAL_WEIGHT": "retrieval_policy",
        "PROMPT_RULE": "prompt_policy",
        "PLANNING_HEURISTIC": "planning_policy",
        "HYPOTHESIS_POLICY": "hypothesis_policy",
    }.get(proposal_kind, "general_cognition")


async def _emit_hardness_candidate(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    row: OmegaLearningProposal,
    payload: OmegaLearningProposalIn,
) -> None:
    if row.proposal_kind not in POLICY_REPLAY_KINDS or not payload.candidate_policy:
        return
    baseline_policy = dict(payload.baseline_policy or {"recency": 1.0, "query_relevance": 1.0})
    candidate_policy = dict(payload.candidate_policy)
    signal = await persist_learning_signal(
        db,
        owner_user_id=owner_user_id,
        signal_kind=LearningSignalKind.CAPABILITY_GAP,
        task_class="omega_policy_replay",
        summary=f"Omega policy proposal: {row.proposal_kind}",
        idempotency_key=f"omega_learning_proposal:{row.id}",
        capability_id=_capability_for_kind(row.proposal_kind),
        structured_payload={
            "proposal_id": str(row.id),
            "proposal_kind": row.proposal_kind,
            "intervention": LearningIntervention.POLICY_REPLAY.value,
            "baseline_policy": baseline_policy,
            "candidate_policy": candidate_policy,
        },
    )
    candidate = await ingest_candidate_from_signal(
        db,
        signal=signal,
        failure_signature=row.evidence_summary,
        desired_behavior=json.dumps(candidate_policy, sort_keys=True, separators=(",", ":")),
    )
    assess_candidate_risks(candidate)
    judgment = CurriculumSelector().evaluate_candidate(candidate)
    await apply_selector_judgment(db, candidate_id=candidate.id, judgment=judgment)


async def _policy_replay_signal(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    proposal_id: uuid.UUID,
):
    from app.models.hardness import LearningSignalRecord

    return (await db.execute(select(LearningSignalRecord).where(
        LearningSignalRecord.owner_user_id == owner_user_id,
        LearningSignalRecord.idempotency_key == f"omega_learning_proposal:{proposal_id}",
    ))).scalar_one_or_none()


async def _evaluate_policy_proposal(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    row: OmegaLearningProposal,
    signal,
):
    from app.learning.hardness.pipeline import process_learning_signal

    return await process_learning_signal(
        db,
        signal=signal,
        capability_id=_capability_for_kind(row.proposal_kind),
        task_class="omega_policy_replay",
        intervention=LearningIntervention.POLICY_REPLAY,
    )
