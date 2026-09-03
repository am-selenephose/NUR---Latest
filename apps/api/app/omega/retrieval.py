from __future__ import annotations

import datetime as dt
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.brain.schemas import ScopeEnvelope
from app.mind.attention import AttentionScore
from app.mind.scope import ScopeResolutionError
from app.models import OmegaClaim, OmegaContradiction, OmegaExperience

_STOP = {"the", "a", "an", "is", "are", "what", "which", "here", "this", "that", "for", "of", "to"}


@dataclass(slots=True)
class CanonicalContextSelection:
    claims: list[OmegaClaim] = field(default_factory=list)
    experiences: list[OmegaExperience] = field(default_factory=list)
    contradictions: list[OmegaContradiction] = field(default_factory=list)
    explanations: dict[str, dict[str, Any]] = field(default_factory=dict)


def _tokens(value: str | None) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", (value or "").lower()) if token not in _STOP}


def _lexical_relevance(text_value: str | None, query: str | None) -> float:
    query_tokens = _tokens(query)
    if not query_tokens:
        return 0.0
    text_tokens = _tokens(text_value)
    return min(1.0, len(query_tokens & text_tokens) / max(1, len(query_tokens)))


def _freshness(value: dt.datetime | None) -> float:
    if value is None:
        return 0.0
    if value.tzinfo is None:
        value = value.replace(tzinfo=dt.UTC)
    age_days = max(0.0, (dt.datetime.now(dt.UTC) - value).total_seconds() / 86400.0)
    return 1.0 / (1.0 + age_days / 7.0)


def _authority(value: str | None) -> float:
    return {
        "OWNER_CONFIRMED": 1.0,
        "OWNER_STATED": 0.95,
        "SYSTEM_MEASURED": 0.9,
        "RESEARCH_DERIVED": 0.85,
        "OWNER_CORRECTED": 1.0,
        "MODEL_PROPOSED": 0.5,
        "LEGACY_UNRESOLVED": 0.35,
    }.get((value or "").upper(), 0.4)


def row_matches_scope(row: Any, scope: ScopeEnvelope) -> bool:
    """Require every explicit boundary to match; missing metadata fails closed."""
    for key, expected in (
        ("capsule_id", scope.capsule_id),
        ("community_id", scope.community_id),
        ("project_id", scope.project_id),
        ("orbit_id", scope.orbit_id),
    ):
        if expected is None:
            continue
        actual = getattr(row, key, None)
        if actual is None or str(actual) != str(expected):
            return False
    return True


def _claim_score(
    claim: OmegaClaim,
    *,
    query: str,
    active_goal: str | None,
    contradicted_ids: set[uuid.UUID],
) -> AttentionScore:
    evidence_count = max(0, claim.support_count) + max(0, claim.contradiction_count)
    return AttentionScore(
        query_relevance=_lexical_relevance(claim.claim_text, query),
        goal_relevance=_lexical_relevance(claim.claim_text, active_goal),
        contradiction_urgency=1.0 if claim.id in contradicted_ids else 0.0,
        authority_weight=_authority(claim.authority_status),
        freshness=_freshness(claim.updated_at),
        evidence_quality=min(1.0, evidence_count / 3.0),
        owner_pin=1.0 if bool((claim.object_value or {}).get("owner_pinned")) else 0.0,
    )


async def retrieve_canonical_context(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    scope_envelope: ScopeEnvelope | None,
    query: str,
    active_goal: str | None = None,
    limit: int = 6,
) -> CanonicalContextSelection:
    if scope_envelope is None:
        raise ScopeResolutionError("Canonical retrieval requires an explicit ScopeEnvelope.")
    if scope_envelope.owner_user_id != owner_user_id:
        raise ScopeResolutionError("ScopeEnvelope owner mismatch blocks canonical retrieval.")

    bounded = max(1, min(int(limit), 50))
    claims = (await db.execute(
        select(OmegaClaim).where(
            OmegaClaim.owner_user_id == owner_user_id,
            OmegaClaim.truth_status.in_(["OBSERVED", "INFERRED", "HYPOTHESIS"]),
        )
    )).scalars().all()
    experiences = (await db.execute(
        select(OmegaExperience).where(
            OmegaExperience.owner_user_id == owner_user_id,
            OmegaExperience.sensitivity != "SECRET_EXCLUDED",
        )
    )).scalars().all()
    contradictions = (await db.execute(
        select(OmegaContradiction).where(
            OmegaContradiction.owner_user_id == owner_user_id,
            OmegaContradiction.status == "OPEN",
        )
    )).scalars().all()

    claims = [row for row in claims if row_matches_scope(row, scope_envelope)]
    experiences = [row for row in experiences if row_matches_scope(row, scope_envelope)]
    contradictions = [row for row in contradictions if row_matches_scope(row, scope_envelope)]
    contradicted_ids = {
        claim_id
        for row in contradictions
        for claim_id in (row.claim_a_id, row.claim_b_id)
    }

    ranked_claims: list[tuple[float, OmegaClaim, AttentionScore]] = []
    for claim in claims:
        score = _claim_score(
            claim,
            query=query,
            active_goal=active_goal,
            contradicted_ids=contradicted_ids,
        )
        ranked_claims.append((score.total(), claim, score))
    ranked_claims.sort(key=lambda item: (item[0], item[1].updated_at), reverse=True)

    selected_claims = [row for _, row, _ in ranked_claims[:bounded]]
    explanations = {
        str(row.id): {
            "score": score.total(),
            "features": score.model_dump(),
        }
        for _, row, score in ranked_claims[:bounded]
    }
    experiences.sort(
        key=lambda row: (
            _lexical_relevance(row.summary, query),
            _freshness(row.created_at),
        ),
        reverse=True,
    )
    contradictions.sort(key=lambda row: row.created_at, reverse=True)
    return CanonicalContextSelection(
        claims=selected_claims,
        experiences=experiences[:bounded],
        contradictions=contradictions[: min(3, bounded)],
        explanations=explanations,
    )
