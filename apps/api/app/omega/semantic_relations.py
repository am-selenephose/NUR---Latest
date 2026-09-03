from __future__ import annotations

import datetime as dt
import re
import uuid
from dataclasses import dataclass

from app.models import OmegaClaim
from app.omega.confirmation_policy import sensitivity_reason_for_text

_WORD = re.compile(r"[a-z0-9_'-]+")
_NEGATIVE_MARKERS = ("must not", "never", "cannot", "can't", "do not", "don't", "avoid ")
_ACTION_MARKERS = ("will", "should", "must", "use", "do", "ship", "create", "send", "share")
_ACTION_TYPES = {"DECISION", "HYPOTHESIS", "PATTERN"}
_STOPWORDS = {
    "a", "an", "the", "to", "with", "for", "of", "and", "or", "we", "i", "you",
    "owner", "will", "should", "must", "not", "never", "cannot", "do", "don't",
    "raw",  # qualifier, not enough by itself to establish same object
}


@dataclass(frozen=True)
class NormalizedProposition:
    subject: str
    predicate: str
    object_tokens: tuple[str, ...]
    polarity: bool | None


@dataclass(frozen=True)
class ContradictionCandidate:
    claim_a_id: uuid.UUID
    claim_b_id: uuid.UUID
    proposition_a: NormalizedProposition
    proposition_b: NormalizedProposition
    temporal_overlap: bool
    scope_compatible: bool
    semantic_rationale_code: str
    generator_confidence: float
    sensitivity_flag: bool
    evidence_sources_exist: bool


@dataclass(frozen=True)
class ContradictionVerdict:
    persist: bool
    queue_review: bool
    rationale_code: str


def build_contradiction_candidate(
    claim_a: OmegaClaim,
    claim_b: OmegaClaim,
    *,
    generator_confidence: float | None = None,
    evidence_sources_exist: bool = True,
) -> ContradictionCandidate:
    proposition_a = normalize_claim(claim_a)
    proposition_b = normalize_claim(claim_b)
    same_predicate = bool(
        proposition_a.predicate
        and proposition_a.predicate == proposition_b.predicate
    )
    rationale = (
        "STRUCTURAL_POLARITY_CANDIDATE"
        if same_predicate and proposition_a.polarity != proposition_b.polarity
        else "LEXICAL_FALLBACK_CANDIDATE"
    )
    confidence = generator_confidence
    if confidence is None:
        confidence = 0.9 if claim_a.predicate and claim_b.predicate and same_predicate else (0.65 if same_predicate else 0.35)
    return ContradictionCandidate(
        claim_a_id=claim_a.id,
        claim_b_id=claim_b.id,
        proposition_a=proposition_a,
        proposition_b=proposition_b,
        temporal_overlap=_temporal_overlap(claim_a, claim_b),
        scope_compatible=_scope_compatible(claim_a, claim_b),
        semantic_rationale_code=rationale,
        generator_confidence=max(0.0, min(float(confidence), 1.0)),
        sensitivity_flag=sensitivity_reason_for_text(
            claim_a.claim_text,
            claim_b.claim_text,
            claim_a.object_value,
            claim_b.object_value,
        ) is not None,
        evidence_sources_exist=evidence_sources_exist,
    )


def lexical_candidate(claim_a: OmegaClaim, claim_b: OmegaClaim) -> ContradictionCandidate | None:
    types = {claim_a.claim_type, claim_b.claim_type}
    if "CONSTRAINT" not in types or not (types & _ACTION_TYPES):
        return None
    constraint = claim_a if claim_a.claim_type == "CONSTRAINT" else claim_b
    action = claim_b if constraint is claim_a else claim_a
    constraint_text = _clean(constraint.claim_text)
    action_text = _clean(action.claim_text)
    if not any(marker in constraint_text for marker in _NEGATIVE_MARKERS):
        return None
    if not any(re.search(rf"\b{re.escape(marker)}\b", action_text) for marker in _ACTION_MARKERS):
        return None
    return build_contradiction_candidate(claim_a, claim_b, generator_confidence=0.55)


def verify_contradiction(
    candidate: ContradictionCandidate,
    claim_a: OmegaClaim,
    claim_b: OmegaClaim,
) -> ContradictionVerdict:
    if {candidate.claim_a_id, candidate.claim_b_id} != {claim_a.id, claim_b.id}:
        return ContradictionVerdict(False, False, "CLAIM_ID_MISMATCH")
    if claim_a.owner_user_id != claim_b.owner_user_id:
        return ContradictionVerdict(False, False, "OWNER_MISMATCH")
    if not candidate.scope_compatible:
        return ContradictionVerdict(False, False, "SCOPE_MISMATCH")
    if not candidate.temporal_overlap:
        return ContradictionVerdict(False, False, "TEMPORAL_DISJOINT")
    if not candidate.evidence_sources_exist:
        return ContradictionVerdict(False, False, "EVIDENCE_SOURCE_MISSING")
    if candidate.sensitivity_flag:
        return ContradictionVerdict(False, True, "SENSITIVE_REVIEW_REQUIRED")

    a = candidate.proposition_a
    b = candidate.proposition_b
    if a.subject != b.subject and "owner" not in {a.subject, b.subject}:
        return ContradictionVerdict(False, False, "SUBJECT_MISMATCH")
    if not a.predicate or a.predicate != b.predicate:
        return ContradictionVerdict(False, False, "PREDICATE_MISMATCH")
    if a.polarity is None or b.polarity is None or a.polarity == b.polarity:
        return ContradictionVerdict(False, False, "POLARITY_NOT_OPPOSED")
    if not _objects_overlap(a.object_tokens, b.object_tokens):
        return ContradictionVerdict(False, False, "OBJECT_MISMATCH")
    return ContradictionVerdict(True, False, "STRUCTURAL_POLARITY_CONFLICT")


def normalize_claim(claim: OmegaClaim) -> NormalizedProposition:
    text = _clean(claim.claim_text)
    words = _WORD.findall(text)
    predicate = _normalize_predicate(claim.predicate or _infer_predicate(text, words))
    polarity = _polarity(claim, text)
    subject = _normalize_subject(claim.subject_ref)
    object_tokens = _object_tokens(text, predicate, claim.object_value)
    return NormalizedProposition(subject, predicate, object_tokens, polarity)


def _polarity(claim: OmegaClaim, text: str) -> bool | None:
    value = (claim.object_value or {}).get("value")
    if isinstance(value, bool):
        return value
    if any(marker in text for marker in _NEGATIVE_MARKERS):
        return False
    if claim.claim_type in _ACTION_TYPES or any(
        re.search(rf"\b{re.escape(marker)}\b", text) for marker in _ACTION_MARKERS
    ):
        return True
    return None


def _infer_predicate(text: str, words: list[str]) -> str:
    if not words:
        return ""
    marker_patterns = (
        r"\bmust not\s+([a-z0-9_'-]+)",
        r"\bdo not\s+([a-z0-9_'-]+)",
        r"\bnever\s+([a-z0-9_'-]+)",
        r"\bcannot\s+([a-z0-9_'-]+)",
        r"\bwill\s+([a-z0-9_'-]+)",
        r"\bshould\s+([a-z0-9_'-]+)",
        r"\bmust\s+([a-z0-9_'-]+)",
        r"\bavoid\s+([a-z0-9_'-]+)",
        r"\bdo\s+([a-z0-9_'-]+)",
    )
    for pattern in marker_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    for word in words:
        if word not in {"we", "i", "you", "owner", "the", "a", "an"}:
            return word
    return ""


def _object_tokens(text: str, predicate: str, object_value: dict) -> tuple[str, ...]:
    explicit = object_value.get("object") or object_value.get("target")
    source = _clean(str(explicit)) if explicit is not None else text
    words = _WORD.findall(source)
    if explicit is None and predicate in words:
        words = words[words.index(predicate) + 1 :]
    normalized = {
        _normalize_predicate(word)
        for word in words
        if word not in _STOPWORDS and word != predicate and len(word) > 1
    }
    return tuple(sorted(normalized))


def _objects_overlap(a: tuple[str, ...], b: tuple[str, ...]) -> bool:
    if not a or not b:
        return True
    left, right = set(a), set(b)
    return bool(left & right)


def _scope_compatible(a: OmegaClaim, b: OmegaClaim) -> bool:
    if a.owner_user_id != b.owner_user_id:
        return False
    if a.orbit_id is not None or b.orbit_id is not None:
        if a.orbit_id is None or b.orbit_id is None:
            global_claim = a if a.orbit_id is None else b
            return global_claim.scope == "SYSTEM_SHARED"
        return a.orbit_id == b.orbit_id
    return a.scope == b.scope or "SYSTEM_SHARED" in {a.scope, b.scope}


def _temporal_overlap(a: OmegaClaim, b: OmegaClaim) -> bool:
    earliest_end = _min_time(a.valid_until, b.valid_until)
    latest_start = _max_time(a.valid_from, b.valid_from)
    return earliest_end is None or latest_start is None or latest_start <= earliest_end


def _min_time(a: dt.datetime | None, b: dt.datetime | None) -> dt.datetime | None:
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)


def _max_time(a: dt.datetime | None, b: dt.datetime | None) -> dt.datetime | None:
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


def _normalize_predicate(value: str | None) -> str:
    if not value:
        return ""
    word = _WORD.findall(value.lower())
    if not word:
        return ""
    token = word[0]
    if token.endswith("ing") and len(token) > 5:
        stem = token[:-3]
        if stem.endswith("r"):
            return stem + "e"
        return stem
    if token.endswith("ed") and len(token) > 4:
        return token[:-2]
    return token


def _normalize_subject(value: str | None) -> str:
    if not value:
        return "owner"
    return " ".join(_WORD.findall(value.lower())) or "owner"


def _clean(value: str) -> str:
    return " ".join(value.lower().replace("’", "'").split())
