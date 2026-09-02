from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class EpistemicStatus(StrEnum):
    OBSERVED = "OBSERVED"
    INFERRED = "INFERRED"
    HYPOTHESIS = "HYPOTHESIS"
    CONTESTED = "CONTESTED"
    CONTRADICTED = "CONTRADICTED"
    SUPERSEDED = "SUPERSEDED"
    RETIRED = "RETIRED"


class AuthorityStatus(StrEnum):
    MODEL_PROPOSED = "MODEL_PROPOSED"
    OWNER_STATED = "OWNER_STATED"
    OWNER_CONFIRMED = "OWNER_CONFIRMED"
    OWNER_CORRECTED = "OWNER_CORRECTED"
    SYSTEM_MEASURED = "SYSTEM_MEASURED"
    RESEARCH_DERIVED = "RESEARCH_DERIVED"
    LEGACY_UNRESOLVED = "LEGACY_UNRESOLVED"

TRUTH_TO_EPISTEMIC: dict[str, EpistemicStatus] = {
    "OBSERVED": EpistemicStatus.OBSERVED,
    "INFERRED": EpistemicStatus.INFERRED,
    "HYPOTHESIS": EpistemicStatus.HYPOTHESIS,
    "CONTRADICTED": EpistemicStatus.CONTRADICTED,
    "SUPERSEDED": EpistemicStatus.SUPERSEDED,
    "RETIRED": EpistemicStatus.RETIRED,
}

PROVENANCE_TO_AUTHORITY: dict[str, AuthorityStatus] = {
    "MODEL_GENERATED": AuthorityStatus.MODEL_PROPOSED,
    "OWNER_WRITTEN": AuthorityStatus.OWNER_STATED,
    "USER_CORRECTION": AuthorityStatus.OWNER_CORRECTED,
    "SYSTEM_MEASURED": AuthorityStatus.SYSTEM_MEASURED,
    "OBSERVED_OUTCOME": AuthorityStatus.SYSTEM_MEASURED,
    "RESEARCH_DERIVED": AuthorityStatus.RESEARCH_DERIVED,
}


def epistemic_from_truth_status(value: str) -> EpistemicStatus:
    return TRUTH_TO_EPISTEMIC.get(value, EpistemicStatus.HYPOTHESIS)


def authority_from_provenance(value: str) -> AuthorityStatus:
    return PROVENANCE_TO_AUTHORITY.get(value, AuthorityStatus.MODEL_PROPOSED)

class CanonicalClaimSnapshot(BaseModel):
    claim_id: uuid.UUID
    version: int
    claim_text: str
    claim_type: str
    orbit_id: uuid.UUID | None = None
    scope: str = "PRIVATE_ORBIT"
    subject_ref: str | None = None
    predicate: str | None = None
    object_value: dict = Field(default_factory=dict)
    valid_from: dt.datetime | None = None
    valid_until: dt.datetime | None = None
    epistemic_status: EpistemicStatus
    authority_status: AuthorityStatus
    confidence: float
    uncertainty_kind: str | None = None
    falsification_condition: str | None = None
    support_count: int = 0
    contradiction_count: int = 0
    created_at: dt.datetime
    updated_at: dt.datetime