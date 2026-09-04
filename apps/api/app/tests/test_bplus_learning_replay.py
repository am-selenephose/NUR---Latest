from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import ModelEvaluation, ModelRun, ModelRunSource, UserCorrection
from app.models.hardness import LearningCandidateRecord, LearningSignalRecord
from app.tests.conftest import register_user

SET_USER = "SELECT set_config('app.current_user_id', :uid, true)"


async def test_retrieval_weight_candidate_must_beat_baseline_before_promotion():
    from app.learning.hardness.replay import (
        case,
        fixed_replay_corpus,
        run_policy_replay,
    )

    corpus = fixed_replay_corpus([
        case(query="project deadline", expected_source="project:deadline"),
        case(query="private relationship note", expected_source="orbit:personal"),
    ])
    result = await run_policy_replay(
        baseline={"recency": 1.5, "query_relevance": 2.0},
        candidate={"recency": 0.5, "query_relevance": 5.0},
        corpus=corpus,
    )
    assert result.target_metric_delta > 0
    assert result.scope_leak_count == 0
    assert result.critical_gates_passed is True
    assert result.status == "PASS"
    assert result.artifact.rollback_payload == {"recency": 1.5, "query_relevance": 2.0}
    assert result.artifact.replay_corpus_hash == corpus.corpus_hash


async def test_target_win_with_scope_leak_is_rejected():
    from app.learning.hardness.replay import (
        ReplayCase,
        ReplaySource,
        fixed_replay_corpus,
        run_policy_replay,
    )

    corpus = fixed_replay_corpus([
        ReplayCase(
            case_id="scope-leak",
            query="private relationship note",
            expected_source="orbit:personal",
            sources=(
                ReplaySource("orbit:personal", query_relevance=0.9, recency=0.2, scope_allowed=True),
                ReplaySource("capsule:recipient", query_relevance=1.0, recency=1.0, scope_allowed=False),
            ),
        )
    ])
    result = await run_policy_replay(
        baseline={"recency": 2.0, "query_relevance": 0.1},
        candidate={"recency": 0.1, "query_relevance": 5.0, "router_policy": "unsafe"},
        corpus=corpus,
    )
    assert result.scope_leak_count >= 1
    assert result.critical_gates_passed is False
    assert result.status == "REJECTED"


async def test_authority_widening_or_owner_correction_regression_vetoes_candidate():
    from app.learning.hardness.replay import (
        case,
        fixed_replay_corpus,
        run_policy_replay,
    )

    corpus = fixed_replay_corpus([
        case(query="corrected deadline", expected_source="project:corrected", owner_corrected=True),
    ])
    result = await run_policy_replay(
        baseline={"recency": 0.5, "query_relevance": 5.0, "authority_level": 1},
        candidate={"recency": 3.0, "query_relevance": 0.1, "authority_level": 2},
        corpus=corpus,
    )
    assert result.authority_widened is True
    assert result.owner_correction_rate_candidate >= result.owner_correction_rate_baseline
    assert result.critical_gates_passed is False
    assert result.status == "REJECTED"


def test_replay_manifest_is_deterministic_and_contains_no_raw_secret_material():
    from app.learning.hardness.replay import case, fixed_replay_corpus

    cases = [case(query="project deadline", expected_source="project:deadline")]
    first = fixed_replay_corpus(cases, source_manifest={"source_refs": ["model_run_source:abc"]})
    second = fixed_replay_corpus(cases, source_manifest={"source_refs": ["model_run_source:abc"]})
    assert first.corpus_hash == second.corpus_hash
    rendered = str(first.manifest).lower()
    assert "secret-value" not in rendered
    assert "raw_excerpt" not in rendered


async def test_build_replay_corpus_uses_structured_history_without_raw_text(client, app_engine):
    from app.learning.hardness.replay import build_replay_corpus

    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner)})
        run = ModelRun(owner_user_id=owner, provider="fixture", mode="talk")
        db.add(run)
        await db.flush()
        db.add_all([
            ModelRunSource(
                owner_user_id=owner, model_run_id=run.id, source_kind="PROJECT",
                source_id=uuid.uuid4(), excerpt="SECRET-VALUE raw excerpt", rank=0.95,
            ),
            ModelEvaluation(
                owner_user_id=owner, model_run_id=run.id, verdict="PASS",
                checks={
                    "query": "project deadline",
                    "expected_source": "PROJECT",
                    "scope_allowed_source_kinds": ["PROJECT"],
                },
            ),
            UserCorrection(
                owner_user_id=owner, correction_text="SECRET-VALUE corrected text",
                reason="raw private correction",
            ),
        ])
        await db.flush()
        corpus = await build_replay_corpus(db, owner_user_id=owner)

    assert corpus.cases
    rendered = str(corpus.manifest).lower()
    assert "secret-value" not in rendered
    assert "raw private correction" not in rendered
    assert "correction_ids" in rendered
    assert "evaluation_ids" in rendered


def test_policy_replay_enums_exist():
    from app.learning.hardness.schemas import LearningIntervention, TrainerType

    assert LearningIntervention.POLICY_REPLAY.value == "POLICY_REPLAY"
    assert TrainerType.POLICY_REPLAY.value == "POLICY_REPLAY"


async def test_eligible_omega_proposal_emits_hardness_signal_and_candidate(client, app_engine):
    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    csrf = {"X-CSRF-Token": client.cookies.get("nur_csrf")}
    response = await client.post(
        "/api/v1/omega/learning-proposals",
        headers=csrf,
        json={
            "proposal_kind": "RETRIEVAL_WEIGHT",
            "description": "Prefer query relevance over recency for project deadlines.",
            "evidence_summary": "Owner-approved replay candidate.",
            "baseline_policy": {"recency": 1.5, "query_relevance": 2.0},
            "candidate_policy": {"recency": 0.5, "query_relevance": 5.0},
        },
    )
    assert response.status_code == 201, response.text
    proposal_id = response.json()["id"]

    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner)})
        signal = (await db.execute(select(LearningSignalRecord).where(
            LearningSignalRecord.owner_user_id == owner,
            LearningSignalRecord.idempotency_key == f"omega_learning_proposal:{proposal_id}",
        ))).scalar_one()
        candidates = (await db.execute(select(LearningCandidateRecord).where(
            LearningCandidateRecord.owner_user_id == owner,
        ))).scalars().all()
    assert signal.structured_payload["intervention"] == "POLICY_REPLAY"
    assert signal.structured_payload["candidate_policy"]["query_relevance"] == 5.0
    assert len(candidates) == 1


async def test_omega_approval_cannot_skip_policy_replay_evaluation(client):
    await register_user(client)
    csrf = {"X-CSRF-Token": client.cookies.get("nur_csrf")}
    proposal = (await client.post(
        "/api/v1/omega/learning-proposals",
        headers=csrf,
        json={
            "proposal_kind": "RETRIEVAL_WEIGHT",
            "description": "Try a retrieval weight change.",
            "evidence_summary": "No replay corpus exists yet.",
            "baseline_policy": {"recency": 1.5, "query_relevance": 2.0},
            "candidate_policy": {"recency": 0.5, "query_relevance": 5.0},
        },
    )).json()
    response = await client.post(
        f"/api/v1/omega/learning-proposals/{proposal['id']}/approve", headers=csrf
    )
    assert response.status_code == 422
    assert "replay" in response.text.lower() or "evaluation" in response.text.lower()

async def test_omega_policy_proposal_approves_only_after_passing_replay(client, app_engine):
    registered, _, _ = await register_user(client)
    owner = uuid.UUID(registered.json()["id"])
    csrf = {"X-CSRF-Token": client.cookies.get("nur_csrf")}
    maker = async_sessionmaker(app_engine, expire_on_commit=False, class_=AsyncSession)

    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner)})
        run = ModelRun(owner_user_id=owner, provider="fixture", mode="talk")
        db.add(run)
        await db.flush()
        now = dt.datetime.now(dt.UTC)
        db.add_all([
            ModelRunSource(
                owner_user_id=owner,
                model_run_id=run.id,
                source_kind="WEB",
                source_id=uuid.uuid4(),
                excerpt=None,
                rank=0.20,
                created_at=now,
            ),
            ModelRunSource(
                owner_user_id=owner,
                model_run_id=run.id,
                source_kind="PROJECT",
                source_id=uuid.uuid4(),
                excerpt=None,
                rank=0.60,
                created_at=now - dt.timedelta(seconds=10),
            ),
            ModelEvaluation(
                owner_user_id=owner,
                model_run_id=run.id,
                verdict="PASS",
                checks={
                    "query": "project deadline",
                    "expected_source": "PROJECT",
                    "scope_allowed_source_kinds": ["PROJECT", "WEB"],
                },
            ),
        ])
        await db.commit()

    created = await client.post(
        "/api/v1/omega/learning-proposals",
        headers=csrf,
        json={
            "proposal_kind": "RETRIEVAL_WEIGHT",
            "description": "Prefer query relevance over recency for project deadlines.",
            "evidence_summary": "Historical evaluation identifies the correct project source.",
            "baseline_policy": {"recency": 2.0, "query_relevance": 1.0},
            "candidate_policy": {"recency": 0.5, "query_relevance": 5.0},
        },
    )
    assert created.status_code == 201, created.text
    proposal = created.json()

    approved = await client.post(
        f"/api/v1/omega/learning-proposals/{proposal['id']}/approve", headers=csrf
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "APPROVED"
    assert approved.json()["approved_by_owner"] is True

    async with maker() as db:
        await db.execute(text(SET_USER), {"uid": str(owner)})
        from app.models.hardness import (
            LearningPromotionProposalRecord,
            TrainingExperimentRecord,
        )

        experiment = (await db.execute(select(TrainingExperimentRecord).where(
            TrainingExperimentRecord.owner_user_id == owner,
            TrainingExperimentRecord.trainer_type == "POLICY_REPLAY",
        ))).scalar_one()
        hardness = (await db.execute(select(LearningPromotionProposalRecord).where(
            LearningPromotionProposalRecord.owner_user_id == owner,
            LearningPromotionProposalRecord.experiment_id == experiment.id,
        ))).scalar_one()
    assert experiment.status == "COMPLETED"
    assert hardness.evaluation_summary["evaluation_mode"] == "POLICY_REPLAY"
    assert hardness.evaluation_summary["verdict"] == "PASS"
    assert hardness.critical_gates_passed is True
