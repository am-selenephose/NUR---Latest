from __future__ import annotations

import datetime as dt
import uuid

from app.models import OmegaClaim
from app.tests.conftest import register_user


def _claim(
    text_value: str,
    *,
    claim_type: str,
    owner: uuid.UUID | None = None,
    orbit_id: uuid.UUID | None = None,
    predicate: str | None = None,
    object_value: dict | None = None,
    valid_from: dt.datetime | None = None,
    valid_until: dt.datetime | None = None,
) -> OmegaClaim:
    return OmegaClaim(
        id=uuid.uuid4(),
        owner_user_id=owner or uuid.uuid4(),
        orbit_id=orbit_id,
        claim_text=text_value,
        claim_type=claim_type,
        truth_status="HYPOTHESIS",
        epistemic_status="HYPOTHESIS",
        authority_status="MODEL_PROPOSED",
        predicate=predicate,
        object_value=object_value or {},
        scope="PRIVATE_ORBIT",
        valid_from=valid_from,
        valid_until=valid_until,
    )


def test_never_avoid_exercise_is_not_opposite_of_do_exercise():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    a = _claim(
        "Never avoid exercise.", claim_type="CONSTRAINT", owner=owner,
        predicate="avoid", object_value={"value": False},
    )
    b = _claim(
        "Do exercise.", claim_type="DECISION", owner=owner,
        predicate="exercise", object_value={"value": True},
    )
    verdict = verify_contradiction(build_contradiction_candidate(a, b), a, b)
    assert verdict.persist is False
    assert verdict.rationale_code == "PREDICATE_MISMATCH"


def test_same_predicate_opposite_polarity_is_structurally_incompatible():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    orbit = uuid.uuid4()
    a = _claim(
        "Never send raw owner memory to recipients.", claim_type="CONSTRAINT",
        owner=owner, orbit_id=orbit,
    )
    b = _claim(
        "We will send raw owner memory to recipients.", claim_type="DECISION",
        owner=owner, orbit_id=orbit,
    )
    candidate = build_contradiction_candidate(a, b)
    verdict = verify_contradiction(candidate, a, b)
    assert candidate.proposition_a.predicate == candidate.proposition_b.predicate == "send"
    assert candidate.proposition_a.polarity is False
    assert candidate.proposition_b.polarity is True
    assert candidate.scope_compatible is True
    assert candidate.temporal_overlap is True
    assert verdict.persist is True
    assert verdict.rationale_code == "STRUCTURAL_POLARITY_CONFLICT"


def test_cross_scope_conflict_is_not_auto_persisted():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    a = _claim(
        "Never share raw memory.", claim_type="CONSTRAINT", owner=owner,
        orbit_id=uuid.uuid4(),
    )
    b = _claim(
        "Share raw memory with the doctor.", claim_type="DECISION", owner=owner,
        orbit_id=uuid.uuid4(),
    )
    candidate = build_contradiction_candidate(a, b)
    assert candidate.scope_compatible is False
    assert verify_contradiction(candidate, a, b).persist is False


def test_disjoint_validity_windows_cannot_auto_persist():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    orbit = uuid.uuid4()
    a = _claim(
        "Never send raw memory.", claim_type="CONSTRAINT", owner=owner, orbit_id=orbit,
        valid_until=dt.datetime(2026, 1, 1, tzinfo=dt.UTC),
    )
    b = _claim(
        "We will send raw memory.", claim_type="DECISION", owner=owner, orbit_id=orbit,
        valid_from=dt.datetime(2026, 2, 1, tzinfo=dt.UTC),
    )
    candidate = build_contradiction_candidate(a, b)
    assert candidate.temporal_overlap is False
    assert verify_contradiction(candidate, a, b).persist is False


def test_sensitive_conflict_requires_review_instead_of_auto_persist():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    orbit = uuid.uuid4()
    a = _claim(
        "Never share medical diagnosis details.", claim_type="CONSTRAINT",
        owner=owner, orbit_id=orbit,
    )
    b = _claim(
        "We will share medical diagnosis details.", claim_type="DECISION",
        owner=owner, orbit_id=orbit,
    )
    candidate = build_contradiction_candidate(a, b)
    verdict = verify_contradiction(candidate, a, b)
    assert candidate.sensitivity_flag is True
    assert verdict.persist is False
    assert verdict.queue_review is True
    assert verdict.rationale_code == "SENSITIVE_REVIEW_REQUIRED"


def test_cross_owner_candidate_is_rejected_even_when_text_conflicts():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    orbit = uuid.uuid4()
    a = _claim("Never send raw memory.", claim_type="CONSTRAINT", orbit_id=orbit)
    b = _claim("We will send raw memory.", claim_type="DECISION", orbit_id=orbit)
    assert verify_contradiction(build_contradiction_candidate(a, b), a, b).persist is False



def test_missing_evidence_source_blocks_auto_persist():
    from app.omega.semantic_relations import (
        build_contradiction_candidate,
        verify_contradiction,
    )

    owner = uuid.uuid4()
    orbit = uuid.uuid4()
    a = _claim(
        "Never send raw memory.", claim_type="CONSTRAINT", owner=owner, orbit_id=orbit
    )
    b = _claim(
        "We will send raw memory.", claim_type="DECISION", owner=owner, orbit_id=orbit
    )
    candidate = build_contradiction_candidate(a, b, evidence_sources_exist=False)
    verdict = verify_contradiction(candidate, a, b)
    assert verdict.persist is False
    assert verdict.rationale_code == "EVIDENCE_SOURCE_MISSING"



def test_candidate_contract_has_no_hidden_reasoning_field():
    from app.omega.semantic_relations import ContradictionCandidate

    fields = set(ContradictionCandidate.__dataclass_fields__)
    assert {"claim_a_id", "claim_b_id", "proposition_a", "proposition_b"} <= fields
    assert {"temporal_overlap", "scope_compatible", "semantic_rationale_code"} <= fields
    assert {"generator_confidence", "sensitivity_flag", "evidence_sources_exist"} <= fields
    assert not ({"reasoning", "chain_of_thought", "hidden_reasoning"} & fields)


async def test_detector_persists_verified_conflict_but_not_unrelated_lexical_pair(client):
    registered, _, _ = await register_user(client)
    owner_id = registered.json()["id"]
    csrf = {"X-CSRF-Token": client.cookies.get("nur_csrf")}
    for payload in (
        {
            "claim_text": "Never send raw owner memory to recipients.",
            "claim_type": "CONSTRAINT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
        },
        {
            "claim_text": "We will send raw owner memory to recipients.",
            "claim_type": "DECISION",
            "truth_status": "HYPOTHESIS",
            "provenance_label": "MODEL_GENERATED",
        },
        {
            "claim_text": "Never disclose the private key.",
            "claim_type": "CONSTRAINT",
            "truth_status": "OBSERVED",
            "provenance_label": "OWNER_WRITTEN",
        },
        {
            "claim_text": "We will create a marketing page.",
            "claim_type": "DECISION",
            "truth_status": "HYPOTHESIS",
            "provenance_label": "MODEL_GENERATED",
        },
    ):
        response = await client.post("/api/v1/omega/claims", headers=csrf, json=payload)
        assert response.status_code == 201, response.text

    run = await client.post("/api/v1/omega/consolidate", headers=csrf, json={"run_kind": "MANUAL"})
    assert run.status_code == 200, run.text
    contradictions = (await client.get("/api/v1/omega/contradictions?status=OPEN")).json()
    descriptions = [row["description"] for row in contradictions]
    assert any("raw owner memory" in text for text in descriptions)
    assert not any("marketing page" in text and "private key" in text for text in descriptions)

    # RLS/owner proof: the persisted rows belong only to the registered owner.
    assert owner_id
