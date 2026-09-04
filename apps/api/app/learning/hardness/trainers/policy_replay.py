from __future__ import annotations

import datetime as dt
from dataclasses import asdict
from typing import Any

from app.learning.hardness.fingerprint import sha256_hex
from app.learning.hardness.replay import ReplayCorpus, run_policy_replay
from app.learning.hardness.schemas import CandidateArtifact, TrainerType
from app.learning.hardness.trainers.base import BaseTrainer
from app.models.hardness import CurriculumSnapshotRecord, TrainingExperimentRecord


class PolicyReplayTrainer(BaseTrainer):
    def __init__(
        self,
        *,
        baseline_policy: dict[str, Any],
        candidate_policy: dict[str, Any],
        corpus: ReplayCorpus,
    ) -> None:
        self.baseline_policy = dict(baseline_policy)
        self.candidate_policy = dict(candidate_policy)
        self.corpus = corpus

    async def execute_training(
        self,
        experiment: TrainingExperimentRecord,
        curriculum: CurriculumSnapshotRecord,
    ) -> CandidateArtifact:
        result = await run_policy_replay(
            baseline=self.baseline_policy,
            candidate=self.candidate_policy,
            corpus=self.corpus,
        )
        replay_payload = asdict(result)
        artifact_hash = sha256_hex({
            "experiment_id": str(experiment.id),
            "curriculum_hash": curriculum.dataset_hash,
            "replay": replay_payload,
        })
        return CandidateArtifact(
            candidate_checkpoint_id=f"policy_{self.corpus.corpus_hash[:16]}",
            base_checkpoint_id=experiment.base_checkpoint_id,
            experiment_id=experiment.id,
            curriculum_hash=curriculum.dataset_hash,
            trainer_type=TrainerType.POLICY_REPLAY,
            artifact_hash=artifact_hash,
            metrics_summary={"policy_replay": replay_payload},
            spend_cents=0,
            real_training_performed=False,
            external_provider_invoked=False,
            created_at=dt.datetime.now(dt.UTC),
        )
