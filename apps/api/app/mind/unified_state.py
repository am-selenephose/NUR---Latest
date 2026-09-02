from __future__ import annotations

from pydantic import BaseModel, Field

from app.brain.schemas import ScopeEnvelope


class UnifiedCognitiveState(BaseModel):
    """Small B+ state carrier; later slices add world, agency, and learning."""

    scope_envelope: ScopeEnvelope
    active_question: str
    selected_claim_ids: list[str] = Field(default_factory=list)
    selected_experience_ids: list[str] = Field(default_factory=list)
    attention_explanations: dict[str, dict] = Field(default_factory=dict)
