"""Allow governed POLICY_REPLAY experiments in the Hardness plane.

Revision ID: 0064_bplus_policy_replay
Revises: 0063_nur_bplus_prediction_v2
"""

from alembic import op

revision = "0064_bplus_policy_replay"
down_revision = "0063_nur_bplus_prediction_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE curriculum_snapshots "
        "DROP CONSTRAINT ck_curriculum_intervention"
    )
    op.execute(
        "ALTER TABLE curriculum_snapshots ADD CONSTRAINT "
        "ck_curriculum_intervention CHECK (intervention IN ("
        "'NO_CHANGE','MEMORY_UPDATE','RETRIEVAL_POLICY','ROUTER_POLICY',"
        "'CONTEXT_RECIPE','PROMPT_EXPERIMENT','SYNTHETIC_DATA','SFT',"
        "'PREFERENCE_TRAINING','RL','CODE_CHANGE_PROPOSAL','POLICY_REPLAY'"
        "))"
    )
    op.execute(
        "ALTER TABLE training_experiments "
        "DROP CONSTRAINT ck_training_experiments_trainer"
    )
    op.execute(
        "ALTER TABLE training_experiments ADD CONSTRAINT "
        "ck_training_experiments_trainer CHECK ("
        "trainer_type IN ('DRY_RUN','POLICY_REPLAY'))"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE training_experiments "
        "DROP CONSTRAINT ck_training_experiments_trainer"
    )
    op.execute(
        "ALTER TABLE training_experiments ADD CONSTRAINT "
        "ck_training_experiments_trainer CHECK (trainer_type IN ('DRY_RUN'))"
    )
    op.execute(
        "ALTER TABLE curriculum_snapshots "
        "DROP CONSTRAINT ck_curriculum_intervention"
    )
    op.execute(
        "ALTER TABLE curriculum_snapshots ADD CONSTRAINT "
        "ck_curriculum_intervention CHECK (intervention IN ("
        "'NO_CHANGE','MEMORY_UPDATE','RETRIEVAL_POLICY','ROUTER_POLICY',"
        "'CONTEXT_RECIPE','PROMPT_EXPERIMENT','SYNTHETIC_DATA','SFT',"
        "'PREFERENCE_TRAINING','RL','CODE_CHANGE_PROPOSAL'"
        "))"
    )
