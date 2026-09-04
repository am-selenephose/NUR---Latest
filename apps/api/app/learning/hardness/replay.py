from __future__ import annotations

import uuid
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.learning.hardness.fingerprint import sha256_hex
from app.models import ModelEvaluation, ModelRunSource, Prediction, UserCorrection

_SUPPORTED_POLICY_KEYS = {
    "recency",
    "query_relevance",
    "context_recipe",
    "prompt_rules",
    "planning_heuristics",
    "router_policy",
    "authority_level",
    "agency_risk",
    "capabilities",
}


@dataclass(frozen=True)
class ReplaySource:
    source_ref: str
    query_relevance: float
    recency: float
    scope_allowed: bool = True


@dataclass(frozen=True)
class ReplayCase:
    case_id: str
    query: str
    expected_source: str
    sources: tuple[ReplaySource, ...]
    owner_corrected: bool = False


@dataclass(frozen=True)
class ReplayCorpus:
    cases: tuple[ReplayCase, ...]
    corpus_hash: str
    manifest: dict[str, Any]


@dataclass(frozen=True)
class ReplayGate:
    gate_name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class PolicyReplayArtifact:
    policy_delta: dict[str, Any]
    replay_corpus_hash: str
    target_metrics: dict[str, float]
    critical_gate_results: tuple[ReplayGate, ...]
    rollback_payload: dict[str, Any]


@dataclass(frozen=True)
class PolicyReplayResult:
    status: str
    target_metric_base: float
    target_metric_candidate: float
    target_metric_delta: float
    scope_leak_count: int
    forbidden_capability_count: int
    authority_widened: bool
    owner_correction_rate_baseline: float
    owner_correction_rate_candidate: float
    agency_regression: bool
    bounded_policy_delta: bool
    critical_gates_passed: bool
    artifact: PolicyReplayArtifact


def case(
    *,
    query: str,
    expected_source: str,
    owner_corrected: bool = False,
) -> ReplayCase:
    distractor = f"distractor:{sha256_hex({'q': query, 's': expected_source})[:10]}"
    return ReplayCase(
        case_id=sha256_hex({"query": query, "expected_source": expected_source})[:16],
        query=query,
        expected_source=expected_source,
        owner_corrected=owner_corrected,
        sources=(
            ReplaySource(expected_source, query_relevance=0.60, recency=0.0, scope_allowed=True),
            ReplaySource(distractor, query_relevance=0.20, recency=1.0, scope_allowed=True),
        ),
    )


def fixed_replay_corpus(
    cases: Iterable[ReplayCase],
    *,
    source_manifest: dict[str, Any] | None = None,
) -> ReplayCorpus:
    frozen_cases = tuple(cases)
    safe_manifest = {
        "version": "policy-replay-v1",
        "case_count": len(frozen_cases),
        "source_manifest": source_manifest or {},
        "cases": [
            {
                "case_id": item.case_id,
                "query": item.query,
                "expected_source": item.expected_source,
                "owner_corrected": item.owner_corrected,
                "sources": [asdict(source) for source in item.sources],
            }
            for item in frozen_cases
        ],
        "raw_secrets_included": False,
        "capsule_recipient_material_included": False,
    }
    return ReplayCorpus(
        cases=frozen_cases,
        corpus_hash=sha256_hex(safe_manifest),
        manifest=safe_manifest,
    )


async def build_replay_corpus(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    limit: int = 200,
) -> ReplayCorpus:
    sources = list((await db.execute(
        select(ModelRunSource)
        .where(ModelRunSource.owner_user_id == owner_user_id)
        .order_by(ModelRunSource.created_at.desc())
        .limit(limit * 4)
    )).scalars())
    evaluations = list((await db.execute(
        select(ModelEvaluation)
        .where(ModelEvaluation.owner_user_id == owner_user_id)
        .order_by(ModelEvaluation.created_at.desc())
        .limit(limit)
    )).scalars())
    corrections = list((await db.execute(
        select(UserCorrection.id)
        .where(UserCorrection.owner_user_id == owner_user_id)
        .order_by(UserCorrection.created_at.desc())
        .limit(limit)
    )).scalars())
    resolved_predictions = list((await db.execute(
        select(Prediction.id, Prediction.resolved_outcome_id)
        .where(
            Prediction.owner_user_id == owner_user_id,
            Prediction.resolved_outcome_id.is_not(None),
        )
        .order_by(Prediction.created_at.desc())
        .limit(limit)
    )).all())

    by_run: dict[uuid.UUID, list[ModelRunSource]] = {}
    for source in sources:
        by_run.setdefault(source.model_run_id, []).append(source)

    replay_cases: list[ReplayCase] = []
    included_eval_ids: list[str] = []
    for evaluation in evaluations:
        checks = evaluation.checks or {}
        if checks.get("capsule_recipient_excluded") or checks.get("secret_excluded"):
            continue
        query = checks.get("query")
        expected = checks.get("expected_source") or checks.get("expected_source_ref")
        if not query or not expected or evaluation.model_run_id is None:
            continue
        run_sources = by_run.get(evaluation.model_run_id, [])
        if not run_sources:
            continue
        allowed_kinds = set(checks.get("scope_allowed_source_kinds") or [])
        replay_sources: list[ReplaySource] = []
        seen: set[str] = set()
        for index, source in enumerate(run_sources):
            source_ref = source.source_kind
            if source_ref in seen:
                continue
            seen.add(source_ref)
            rank = max(0.0, min(float(source.rank or 0.0), 1.0))
            replay_sources.append(ReplaySource(
                source_ref=source_ref,
                query_relevance=rank,
                recency=1.0 / (index + 1),
                scope_allowed=(not allowed_kinds or source.source_kind in allowed_kinds),
            ))
        if not replay_sources:
            continue
        replay_cases.append(ReplayCase(
            case_id=f"evaluation:{evaluation.id}",
            query=str(query)[:240],
            expected_source=str(expected),
            sources=tuple(replay_sources),
            owner_corrected=bool(checks.get("owner_corrected", False)),
        ))
        included_eval_ids.append(str(evaluation.id))

    manifest = {
        "owner_user_id": str(owner_user_id),
        "source_refs": [f"model_run_source:{source.id}" for source in sources],
        "evaluation_ids": included_eval_ids,
        "correction_ids": [str(item) for item in corrections],
        "prediction_outcome_pairs": [
            {"prediction_id": str(prediction_id), "outcome_id": str(outcome_id)}
            for prediction_id, outcome_id in resolved_predictions
        ],
        "raw_excerpts_included": False,
        "raw_corrections_included": False,
        "raw_outcomes_included": False,
    }
    return fixed_replay_corpus(replay_cases, source_manifest=manifest)


async def run_policy_replay(
    *,
    baseline: dict[str, Any],
    candidate: dict[str, Any],
    corpus: ReplayCorpus,
) -> PolicyReplayResult:
    base = _evaluate_policy(baseline, corpus)
    cand = _evaluate_policy(candidate, corpus)
    bounded = set(candidate) <= _SUPPORTED_POLICY_KEYS and set(baseline) <= _SUPPORTED_POLICY_KEYS
    base_capabilities = set(baseline.get("capabilities") or [])
    candidate_capabilities = set(candidate.get("capabilities") or [])
    forbidden_capability_count = len(candidate_capabilities - base_capabilities)
    authority_widened = float(candidate.get("authority_level", 0)) > float(baseline.get("authority_level", 0))
    agency_regression = float(candidate.get("agency_risk", 0)) > float(baseline.get("agency_risk", 0))
    correction_regressed = cand["correction_rate"] > base["correction_rate"]

    gates = (
        ReplayGate("scope_leaks_zero", cand["scope_leaks"] == 0, f"scope_leaks={cand['scope_leaks']}"),
        ReplayGate("no_new_capability", forbidden_capability_count == 0, f"new_capabilities={forbidden_capability_count}"),
        ReplayGate("no_authority_widening", not authority_widened, f"authority_widened={authority_widened}"),
        ReplayGate("owner_correction_not_worse", not correction_regressed, f"baseline={base['correction_rate']:.6f};candidate={cand['correction_rate']:.6f}"),
        ReplayGate("no_agency_regression", not agency_regression, f"agency_regression={agency_regression}"),
        ReplayGate("bounded_policy_delta", bounded, f"bounded={bounded}"),
    )
    critical_gates_passed = all(gate.passed for gate in gates)
    target_delta = cand["accuracy"] - base["accuracy"]
    status = "PASS" if target_delta > 0 and critical_gates_passed else "REJECTED"
    delta = {
        key: candidate.get(key)
        for key in sorted(set(baseline) | set(candidate))
        if baseline.get(key) != candidate.get(key)
    }
    artifact = PolicyReplayArtifact(
        policy_delta=delta,
        replay_corpus_hash=corpus.corpus_hash,
        target_metrics={
            "baseline_accuracy": base["accuracy"],
            "candidate_accuracy": cand["accuracy"],
            "target_metric_delta": target_delta,
            "baseline_owner_correction_rate": base["correction_rate"],
            "candidate_owner_correction_rate": cand["correction_rate"],
        },
        critical_gate_results=gates,
        rollback_payload=dict(baseline),
    )
    return PolicyReplayResult(
        status=status,
        target_metric_base=base["accuracy"],
        target_metric_candidate=cand["accuracy"],
        target_metric_delta=target_delta,
        scope_leak_count=cand["scope_leaks"],
        forbidden_capability_count=forbidden_capability_count,
        authority_widened=authority_widened,
        owner_correction_rate_baseline=base["correction_rate"],
        owner_correction_rate_candidate=cand["correction_rate"],
        agency_regression=agency_regression,
        bounded_policy_delta=bounded,
        critical_gates_passed=critical_gates_passed,
        artifact=artifact,
    )


def _evaluate_policy(policy: dict[str, Any], corpus: ReplayCorpus) -> dict[str, float | int]:
    if not corpus.cases:
        return {"accuracy": 0.0, "scope_leaks": 0, "correction_rate": 0.0}
    relevance_weight = float(policy.get("query_relevance", 1.0))
    recency_weight = float(policy.get("recency", 1.0))
    correct = 0
    scope_leaks = 0
    correction_total = 0
    correction_errors = 0
    for replay_case in corpus.cases:
        selected = max(
            replay_case.sources,
            key=lambda source: (
                source.query_relevance * relevance_weight + source.recency * recency_weight,
                source.source_ref,
            ),
        )
        matched = selected.source_ref == replay_case.expected_source
        correct += int(matched)
        scope_leaks += int(not selected.scope_allowed)
        if replay_case.owner_corrected:
            correction_total += 1
            correction_errors += int(not matched)
    return {
        "accuracy": correct / len(corpus.cases),
        "scope_leaks": scope_leaks,
        "correction_rate": correction_errors / correction_total if correction_total else 0.0,
    }
