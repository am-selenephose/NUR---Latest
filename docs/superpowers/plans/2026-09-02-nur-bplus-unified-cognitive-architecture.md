# NUR B+ Unified Cognitive Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade NUR Omega V1 and the existing Mind/Memory/Insights/Hardness/Agency organs into one unified Jarvis-like cognitive architecture without replacing proven NUR behavior or creating competing truth systems.

**Architecture:** Keep one NUR externally, but enforce internal ownership: Omega owns durable epistemic reality and revision; Memory owns recall; Mind owns present cognition/attention/context; domain models own actual world objects; Hardness owns adaptation experiments; Authority/Agency own permission and execution. Migrate additively using dual-read/single-canonical-write compatibility until parity gates pass.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, PostgreSQL 16 + FORCE RLS, Alembic, Redis/Celery, Pydantic, pytest/pytest-asyncio, TypeScript, Vite, Playwright, existing V197 bridge/runtime.

**Spec:** `docs/superpowers/specs/2026-09-02-nur-bplus-unified-cognitive-architecture-v0.1.md`

## Global Constraints

- Baseline source commit is `caf58863e93b47b4c148c11d86efdd1245354ef1`.
- Preserve V197 visual ownership and interaction contracts.
- Preserve FORCE RLS, Capsule isolation, owner authority, and no cross-owner context.
- Scope must resolve before retrieval/provider/tool access.
- No raw chain-of-thought persistence or exposure.
- No false sentience/consciousness claims.
- No direct donor-runtime ownership of NUR identity, canonical memory, epistemic state, policy, or learning records.
- No production self-promotion of RLS/auth/secrets/tool permissions.
- Do not drop legacy claim/prediction/learning tables in B+ v0.1.
- Every schema change must have migration round-trip/RLS coverage.
- Every vertical slice ends with tests and one focused commit.

---

### Task 1: Canonical Omega Claim Schema and Contracts

**Files:**
- Create: `apps/api/alembic/versions/0059_nur_bplus_epistemic_core.py`
- Create: `apps/api/app/omega/contracts.py`
- Modify: `apps/api/app/models/omega.py`
- Modify: `apps/api/app/omega/schemas.py`
- Test: `apps/api/app/tests/test_bplus_epistemic_core.py`
- Test: `apps/api/app/tests/test_omega.py`

**Interfaces:**
- Produces `EpistemicStatus`, `AuthorityStatus`, `CanonicalClaimSnapshot`, and `OmegaClaimVersion` persistence.
- Later tasks consume `OmegaClaim.epistemic_status`, `authority_status`, `current_version`, `subject_ref`, `predicate`, and `object_value`.

- [ ] **Step 1: Write the failing schema/RLS test**

```python
async def test_bplus_claim_schema_separates_epistemic_and_authority(client, super_engine):
    owner, _, _ = await register_user(client)
    claim = (await client.post('/api/v1/omega/claims', headers=H(client), json={
        'claim_text': 'Night work may currently produce more deep-work completions.',
        'claim_type': 'PATTERN',
        'truth_status': 'INFERRED',
        'provenance_label': 'MODEL_GENERATED',
    })).json()
    assert claim['epistemic_status'] == 'INFERRED'
    assert claim['authority_status'] == 'MODEL_PROPOSED'
    assert claim['current_version'] == 1
```

```python
    async with super_engine.connect() as conn:
        row = (await conn.execute(text("""
            SELECT relrowsecurity, relforcerowsecurity
            FROM pg_class WHERE relname='omega_claim_versions'
        """))).one()
    assert row.relrowsecurity and row.relforcerowsecurity
```

- [ ] **Step 2: Run the test and verify the schema is absent**

Run:
```bash
cd apps/api
.venv/bin/pytest -q app/tests/test_bplus_epistemic_core.py::test_bplus_claim_schema_separates_epistemic_and_authority
```
Expected: FAIL because B+ columns/table are not present.

- [ ] **Step 3: Add the migration and ORM contract**

Migration `0059` must add to `omega_claims`:
```text
subject_ref varchar(240)
predicate varchar(120)
object_value jsonb NOT NULL DEFAULT '{}'
scope varchar(32) NOT NULL DEFAULT 'PRIVATE_ORBIT'
valid_from timestamptz
valid_until timestamptz
epistemic_status varchar(24) NOT NULL
authority_status varchar(24) NOT NULL
uncertainty_kind varchar(48)
falsification_condition text
current_version integer NOT NULL DEFAULT 1
```

Backfill rules:
```text
truth_status OBSERVED      -> epistemic_status OBSERVED
truth_status INFERRED      -> epistemic_status INFERRED
truth_status HYPOTHESIS    -> epistemic_status HYPOTHESIS
truth_status CONTRADICTED  -> epistemic_status CONTRADICTED
truth_status SUPERSEDED    -> epistemic_status SUPERSEDED
truth_status RETIRED       -> epistemic_status RETIRED
OWNER_WRITTEN              -> authority_status OWNER_STATED
USER_CORRECTION            -> authority_status OWNER_CORRECTED
SYSTEM_MEASURED            -> authority_status SYSTEM_MEASURED
MODEL_GENERATED            -> authority_status MODEL_PROPOSED
OBSERVED_OUTCOME           -> authority_status SYSTEM_MEASURED
legacy without proven provenance -> authority_status LEGACY_UNRESOLVED
```

Create `omega_claim_versions` with owner RLS, `(claim_id, version)` uniqueness, snapshot JSONB, `why_changed_id`, `change_class`, `actor`, `evidence_digest`, and timestamp.

`contracts.py` defines:
```python
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
class CanonicalClaimSnapshot(BaseModel):
    claim_id: uuid.UUID
    version: int
    epistemic_status: EpistemicStatus
    authority_status: AuthorityStatus
    confidence: float
    claim_text: str
    subject_ref: str | None = None
    predicate: str | None = None
    object_value: dict = Field(default_factory=dict)
    uncertainty_kind: str | None = None
    falsification_condition: str | None = None
```

- [ ] **Step 4: Run migration/ORM tests**

Run `pytest -q app/tests/test_bplus_epistemic_core.py app/tests/test_omega.py` and require PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/alembic/versions/0059_nur_bplus_epistemic_core.py apps/api/app/models/omega.py apps/api/app/omega/contracts.py apps/api/app/omega/schemas.py apps/api/app/tests/test_bplus_epistemic_core.py apps/api/app/tests/test_omega.py
git commit -m "feat(nur): establish canonical Omega epistemic schema"
```

---

### Task 2: Atomic Canonical Claim Mutation + WhyChanged

**Files:**
- Create: `apps/api/app/omega/canonical_claim_service.py`
- Modify: `apps/api/app/omega/claim_service.py`
- Modify: `apps/api/app/omega/review_queue_service.py`
- Modify: `apps/api/app/omega/routes.py`
- Test: `apps/api/app/tests/test_bplus_claim_versioning.py`

**Interfaces:**
- Produces `create_canonical_claim()`, `mutate_canonical_claim()`, and `confirm_claim_authority()`.
- Every mutation returns the updated `OmegaClaim` plus the created `WhyChangedRecord` reference.

- [ ] **Step 1: Write the failing authority/version test**

```python
async def test_owner_confirmation_changes_authority_not_epistemic(client, super_engine):
    await register_user(client)
    created = (await client.post('/api/v1/omega/claims', headers=H(client), json={
        'claim_text': 'Late-night work may be more productive.',
        'claim_type': 'PATTERN', 'truth_status': 'INFERRED',
        'provenance_label': 'MODEL_GENERATED',
    })).json()
    confirmed = (await client.post(f"/api/v1/omega/claims/{created['id']}/confirm", headers=H(client))).json()
    assert confirmed['epistemic_status'] == 'INFERRED'
    assert confirmed['authority_status'] == 'OWNER_CONFIRMED'
    assert confirmed['current_version'] == 2
```

Also assert exactly two `omega_claim_versions` rows and one new `why_changed_records` row for the confirmation.

- [ ] **Step 2: Verify the current behavior fails the B+ law**

Run:
```bash
cd apps/api
.venv/bin/pytest -q app/tests/test_bplus_claim_versioning.py
```
Expected: FAIL because confirmation currently rewrites truth semantics and no canonical version row is written.

- [ ] **Step 3: Implement row-locked atomic mutation**

Use a row-locked owner-scoped select on `OmegaClaim`. `mutate_canonical_claim()` must:
```python
stmt = (
    select(OmegaClaim)
    .where(
        OmegaClaim.id == claim_id,
        OmegaClaim.owner_user_id == owner_user_id,
    )
    .with_for_update()
)
claim = (await db.execute(stmt)).scalar_one_or_none()
if claim is None:
    raise LookupError("Omega claim not found.")
previous = snapshot_claim(claim)
apply_patch(claim, patch)
claim.current_version += 1
why = await WhyChangedService.record_change(
    db,
    owner_user_id=owner_user_id,
    entity_type=EntityType.BELIEF,
    entity_id=str(claim.id),
    change_class=change_class,
    trigger=trigger,
    previous_version=str(previous.version),
    new_version=str(claim.current_version),
    supporting_evidence=supporting_evidence,
    counter_evidence=counter_evidence,
    owner_correction=(actor == "owner"),
    actor=actor,
    affected_future_behavior=affected_future_behavior,
    rollback_target=str(previous.version),
)
db.add(OmegaClaimVersion(
    owner_user_id=owner_user_id,
    claim_id=claim.id,
    version=claim.current_version,
    snapshot=snapshot_claim(claim).model_dump(mode='json'),
    why_changed_id=why.id,
    change_class=change_class,
    actor=actor,
    evidence_digest=evidence_digest,
))
```
Creation writes version 1. Confirmation only sets `authority_status=OWNER_CONFIRMED`; owner correction uses `OWNER_CORRECTED`. Existing `truth_status` stays compatibility-mapped until legacy readers are migrated.

- [ ] **Step 4: Add concurrency regression**

Two simultaneous mutations against one claim must produce versions `2` and `3`, never duplicate version numbers or lost updates.

- [ ] **Step 5: Run tests and commit**

Run `pytest -q app/tests/test_bplus_claim_versioning.py app/tests/test_omega.py app/tests/test_why_changed_phase2.py`.

```bash
git add apps/api/app/omega apps/api/app/tests/test_bplus_claim_versioning.py
git commit -m "feat(nur): version canonical claims with WhyChanged lineage"
```

---

### Task 3: Projection Links and Single-Canonical-Write Compatibility

**Files:**
- Create: `apps/api/alembic/versions/0060_nur_bplus_projection_links.py`
- Create: `apps/api/app/omega/projections.py`
- Modify: `apps/api/app/models/cognition.py`
- Modify: `apps/api/app/models/memory.py`
- Modify: `apps/api/app/models/intelligence.py`
- Modify: `apps/api/app/models/orbit_relational.py`
- Modify: `apps/api/app/mind/beliefs.py`
- Modify: `apps/api/app/mind/user_model.py`
- Test: `apps/api/app/tests/test_bplus_projections.py`

**Interfaces:**
- Produces `project_belief()`, `project_user_model_claim()`, `sync_semantic_claim_projection()`, `link_memory_projection()`, and `link_insight_projection()`.
- Adds nullable `canonical_omega_claim_id` FKs to legacy/projection tables; existing IDs remain stable.

- [x] **Step 1: Write failing single-truth tests**

```python
async def test_belief_and_user_model_project_same_canonical_claim(client, app_engine):
    await register_user(client)
    claim = await create_owner_inferred_claim(client, 'I may prefer visual progress.')
    belief = await load_belief_projection(app_engine, claim['id'])
    user_claim = await load_user_model_projection(app_engine, claim['id'])
    assert belief.id == uuid.UUID(claim['id'])
    assert user_claim.id == uuid.UUID(claim['id'])
    assert belief.claim_text == user_claim.claim_text == claim['claim_text']
```

Also test that a `semantic_claims` compatibility row links to the Omega claim instead of becoming an unrelated truth row.

- [x] **Step 2: Add projection-link migration**

`0060` adds `canonical_omega_claim_id` to `semantic_claims`, `memories`, `insights`, and `orbit_relational_insights`, with owner-safe indexes and uniqueness only where the product guarantees one projection row per claim.

Do not drop legacy fields. Backfill only rows that can be matched unambiguously by existing evidence/source references; ambiguous legacy rows remain unlinked and are reported by a migration audit query.

- [x] **Step 3: Implement pure projection functions**

```python
def project_belief(claim: OmegaClaim) -> Belief:
    return Belief(
        id=claim.id,
        owner_user_id=claim.owner_user_id,
        kind=map_epistemic_to_belief_kind(claim.epistemic_status),
        status=map_epistemic_to_belief_status(claim.epistemic_status),
        claim_text=claim.claim_text,
        confidence=float(claim.confidence),
        source_authority=claim.authority_status.lower(),
        falsification_condition=claim.falsification_condition,
        version=claim.current_version,
    )
```

`UserModelClaim` projection maps authority separately from epistemic state; high-sensitivity policy remains enforced by the projection/service boundary.

- [x] **Step 4: Redirect new semantic-claim writes**

New write paths call canonical Omega service first, then sync the compatibility row. Add a feature flag `NUR_BPLUS_CANONICAL_CLAIMS` defaulting `false` until Task 10 integration; tests run both modes.

- [x] **Step 5: Verify and commit**

Run `pytest -q app/tests/test_bplus_projections.py app/tests/test_cognition.py app/tests/test_personal_memory.py app/tests/test_agentic_insights.py app/tests/test_beliefs_attention_phase3.py`.

```bash
git add apps/api/alembic/versions/0060_nur_bplus_projection_links.py apps/api/app/omega/projections.py apps/api/app/models apps/api/app/mind apps/api/app/tests/test_bplus_projections.py
git commit -m "feat(nur): project legacy cognition from canonical Omega claims"
```


**Closure repair — 2026-09-03:** PASS. Original Task-3 commit `5dd5b9e` added the `OrbitContextLink.canonical_omega_claim_id` ORM field but `0060_nur_bplus_projection_links` omitted `orbit_context_links`, causing fresh PostgreSQL schemas to diverge from ORM metadata. Forward repair migration `0062_bplus_orbit_ctx_link` adds the missing owner-safe canonical Omega FK + partial index without rewriting historical migration `0060`. Fresh standalone `0062` verification passes the schema assertion and the previously crashing private context-link runtime test; Task-3 + Orbit regression suite: 93 passed; full API commit-candidate suite with pending Task 6 removed: 1094 passed.


---

### Task 4: Scope-Complete Attention and Retrieval

**Files:**
- Create: `apps/api/app/omega/retrieval.py`
- Create: `apps/api/app/mind/unified_state.py`
- Modify: `apps/api/app/omega/workspace_service.py`
- Modify: `apps/api/app/mind/context.py`
- Modify: `apps/api/app/mind/attention.py`
- Modify: `apps/api/app/mind/capabilities/hydrator.py`
- Test: `apps/api/app/tests/test_bplus_scope_attention.py`

**Interfaces:**
- Produces `retrieve_canonical_context(db, *, owner_user_id, scope_envelope, query, active_goal, limit)` and `UnifiedCognitiveState`.
- Requires a `ScopeEnvelope`; calling without one raises `ScopeResolutionError`.

- [x] **Step 1: Write adversarial cross-Orbit tests**

```python
async def test_workspace_frame_never_reads_other_orbit_claim(client):
    await register_user(client)
    orbit_a, orbit_b = await create_two_orbits(client)
    await create_claim(client, orbit_a, 'A-only marker bplus-a-771')
    frame = await talk_in_orbit(client, orbit_b, 'What matters here?')
    assert 'bplus-a-771' not in str(frame['omega'])
```

Add project/capsule variants proving unrelated private Omega and Memories are absent.

- [x] **Step 2: Add deterministic rank contract**

Implement `AttentionScore` from normalized features `query_relevance`, `scope_match`, `goal_relevance`, `contradiction_urgency`, `outcome_relevance`, `authority_weight`, `freshness`, `evidence_quality`, `owner_pin`, `correction_relevance`. Owner pin dominates; scope mismatch is a hard exclusion, not a negative score.

- [x] **Step 3: Replace latest-N workspace reads**

`build_workspace_frame()` calls `retrieve_canonical_context()` and stores selected IDs + score explanations. `load_semantic_hydration_inputs()` applies the same Orbit/project scope to every family, not only `memories`.

- [x] **Step 4: Add relevance fixture**

A relevant 30-day-old claim must outrank six irrelevant one-hour-old claims for a matching query.

- [x] **Step 5: Verify and commit**

Run `pytest -q app/tests/test_bplus_scope_attention.py app/tests/test_scope_identity_phase1.py app/tests/test_omega.py app/tests/test_mind_brain_vertical_slice.py`.

```bash
git add apps/api/app/omega/retrieval.py apps/api/app/omega/workspace_service.py apps/api/app/mind apps/api/app/tests/test_bplus_scope_attention.py
git commit -m "feat(nur): make scoped attention the canonical context gate"
```

**Closure receipt — 2026-09-03:** PASS. Initial implementation `8f68aa3`; corrective scope-completeness commit `593f1df`. Fresh Task-4 verification: 70 tests passed; scoped Ruff and `git diff --check` clean. Adversarial coverage now includes Orbit, Project, Capsule, Community, scope/argument disagreement, semantic projection Orbit derivation, final Talk summary scoping, and missing-ScopeEnvelope rejection.

---

### Task 5: Starvation-Free Omega Consolidation

**Files:**
- Create: `apps/api/alembic/versions/0061_nur_bplus_consolidation_receipts.py`
- Create: `apps/api/app/omega/ingestion_receipts.py`
- Modify: `apps/api/app/models/omega.py`
- Modify: `apps/api/app/omega/consolidation_service.py`
- Test: `apps/api/app/tests/test_bplus_consolidation_v2.py`

**Interfaces:**
- Produces `OmegaIngestionReceipt` and `next_unprocessed_sources()`.
- Receipt states: `PROCESSED`, `IGNORED`, `RETRYABLE`, `QUARANTINED`, `INVALIDATED`.

- [ ] **Step 1: Replace the 105-event test with a no-starvation proof**

```python
async def test_1005_events_eventually_all_receive_receipts(client, app_engine):
    await register_user(client)
    await seed_cognitive_events(client, count=1005)
    for _ in range(12):
        await client.post('/api/v1/omega/consolidate', headers=H(client), json={'run_kind': 'MANUAL'})
    counts = await receipt_counts(app_engine)
    assert counts['unseen'] == 0
    assert counts['PROCESSED'] + counts['IGNORED'] + counts['QUARANTINED'] == 1005
```

- [ ] **Step 2: Add receipt schema**

`omega_ingestion_receipts` fields: owner, source_kind, source_id, status, experience_id, attempt_count, error_code, error_summary, first_seen_at, last_attempt_at, completed_at; unique `(owner_user_id, source_kind, source_id)` and FORCE RLS.

- [ ] **Step 3: Process oldest unseen sources first**

Use an anti-join against receipts ordered by source time + ID. Acquire each receipt idempotently with PostgreSQL `ON CONFLICT DO NOTHING`:

```python
stmt = (
    pg_insert(OmegaIngestionReceipt)
    .values(
        owner_user_id=owner_user_id,
        source_kind=source_kind,
        source_id=source_id,
        status="RETRYABLE",
        attempt_count=0,
    )
    .on_conflict_do_nothing(
        index_elements=["owner_user_id", "source_kind", "source_id"]
    )
    .returning(OmegaIngestionReceipt.id)
)
receipt_id = (await db.execute(stmt)).scalar_one_or_none()
```

Retries increment `attempt_count`. After three deterministic failures, mark `QUARANTINED` with a safe error class.

- [ ] **Step 4: Preserve idempotency**

Re-running consolidation after all receipts are terminal must create zero duplicate experiences, claims, evidence edges, or receipts.

- [ ] **Step 5: Verify and commit**

Run `pytest -q app/tests/test_bplus_consolidation_v2.py app/tests/test_omega.py app/tests/test_agentic_insights.py`.

```bash
git add apps/api/alembic/versions/0061_nur_bplus_consolidation_receipts.py apps/api/app/models/omega.py apps/api/app/omega apps/api/app/tests/test_bplus_consolidation_v2.py
git commit -m "feat(nur): make Omega consolidation complete and starvation-free"
```

---

### Task 6: Canonical Prediction Ledger and Calibration

**Files:**
- Create: `apps/api/alembic/versions/0063_nur_bplus_prediction_semantics.py`
- Create: `apps/api/app/omega/prediction_v2.py`
- Create: `apps/api/app/omega/calibration.py`
- Modify: `apps/api/app/models/cognition.py`
- Modify: `apps/api/app/cognition/prediction_service.py`
- Modify: `apps/api/app/omega/prediction_ledger.py`
- Test: `apps/api/app/tests/test_bplus_predictions.py`

**Interfaces:**
- Canonical storage remains `predictions`; legacy `omega_predictions` reads bridge through `prediction_v2`.
- Produces `register_prediction()`, `resolve_prediction()`, and `calibration_report()`.

- [x] **Step 1: Write failing structured prediction test**

```python
async def test_prediction_requires_observable_contract(client):
    await register_user(client)
    row = await register_prediction_via_service(
        statement='Strategy A will reduce completion time.',
        expected_observation={'metric': 'completion_minutes', 'operator': '<=', 'value': 60},
        confidence=0.75, horizon_days=7,
        assumptions=['same task class'], falsification_condition='median > 60',
    )
    assert row.review_by is not None
    assert row.confidence == Decimal('0.750')
```

- [x] **Step 2: Extend prediction schema without breaking current rows**

Add `metric`, `falsification_condition`, `resolution_rule`, `resolved_outcome_id`, and `prediction_error`; preserve `outcome_event_id`, `resolution`, `learning`, assumptions, confidence, horizon and review date.

- [x] **Step 3: Resolve from observed outcomes**

Resolution accepts an explicit evaluator result: `CONFIRMED`, `PARTIALLY_CONFIRMED`, or `CONTRADICTED`; computes a numeric error only where metric semantics support it. Resolution writes a WhyChanged receipt and emits an Omega evidence edge when linked to a claim.

- [x] **Step 4: Add reproducible calibration**

`calibration_report()` groups resolved binary predictions into 0.1 confidence buckets and returns count, mean forecast, observed frequency, absolute calibration error, and Brier score. Exclude predictions lacking a binary-compatible resolution; never fabricate a score.

- [x] **Step 5: Bridge legacy Omega predictions**

Migration/service maps legacy rows into canonical predictions idempotently and records source IDs. New Omega API writes canonical predictions only.

- [x] **Step 6: Verify and commit**

Run `pytest -q app/tests/test_bplus_predictions.py app/tests/test_cognition.py app/tests/test_omega.py`.

```bash
git add apps/api/alembic/versions/0063_nur_bplus_prediction_semantics.py apps/api/app/models/cognition.py apps/api/app/cognition/prediction_service.py apps/api/app/omega apps/api/app/tests/test_bplus_predictions.py
git commit -m "feat(nur): unify predictions with outcome calibration"
```

**Closure — 2026-09-03:** PASS. Canonical `predictions` now owns new Omega prediction writes; legacy `omega_predictions` is bridged idempotently through `prediction_v2` without read-side mutation. Explicit resolution records `CONFIRMED` / `PARTIALLY_CONFIRMED` / `CONTRADICTED`, persists WhyChanged lineage, links observed outcomes into Omega evidence when a canonical claim is attached, and computes numeric error only for supported metric semantics. Calibration uses only binary-compatible resolved predictions in 0.1 confidence buckets and reports count, mean forecast, observed frequency, absolute calibration error, and Brier score. Free-form Talk hypotheses are not promoted into fake measurable predictions; Map manual resolution and Talk summary both use the canonical ledger. Verification: Task-6 exact suite 30 passed; Map regression 39 passed; migration reachability 1 passed; full API suite 1103 passed.


---

### Task 7: Semantic Contradiction Candidate + Deterministic Verifier

**Files:**
- Create: `apps/api/app/omega/semantic_relations.py`
- Modify: `apps/api/app/omega/contradiction_service.py`
- Modify: `apps/api/app/omega/confirmation_policy.py`
- Test: `apps/api/app/tests/test_bplus_contradictions.py`

**Interfaces:**
- Produces `ContradictionCandidate` and `verify_contradiction(candidate, claim_a, claim_b)`.
- Candidate generation may use structured model output; verification remains deterministic and owner/scope-aware.

- [x] **Step 1: Write false-positive and false-negative fixtures**

```python
def test_never_avoid_exercise_is_not_opposite_of_do_exercise():
    a = claim('Never avoid exercise.', predicate='avoid', object_value={'value': False})
    b = claim('Do exercise.', predicate='exercise', object_value={'value': True})
    verdict = verify_contradiction(candidate(a, b), a, b)
    assert verdict.persist is False

async def test_cross_scope_conflict_is_not_auto_persisted():
    a = claim('Never share raw memory.', orbit_id=ORBIT_A)
    b = claim('Share complete context with the doctor.', orbit_id=ORBIT_B)
    assert verify_contradiction(candidate(a, b), a, b).persist is False
```

- [x] **Step 2: Implement normalized proposition candidates**

`ContradictionCandidate` carries claim IDs, normalized subject/predicate/object polarity, temporal overlap, scope compatibility, semantic rationale code, generator confidence, and sensitivity flag. No free-form chain-of-thought field.

- [x] **Step 3: Gate persistence**

Persist automatically only when: same owner; scopes overlap; validity windows overlap; evidence sources still exist; relation is structurally incompatible; sensitivity policy permits auto-persist. Otherwise queue review or return no contradiction.

- [x] **Step 4: Keep lexical detector only as fallback candidate generator**

Existing keyword logic may propose candidates when no semantic provider is available, but it cannot bypass the deterministic verifier.

- [x] **Step 5: Verify and commit**

Run `pytest -q app/tests/test_bplus_contradictions.py app/tests/test_omega.py`.

```bash
git add apps/api/app/omega/semantic_relations.py apps/api/app/omega/contradiction_service.py apps/api/app/omega/confirmation_policy.py apps/api/app/tests/test_bplus_contradictions.py
git commit -m "feat(nur): verify semantic contradictions before belief revision"
```

**Closure — 2026-09-03:** PASS. Lexical contradiction logic is now candidate generation only. `ContradictionCandidate` stores normalized propositions, temporal/scope compatibility, generator confidence, sensitivity and evidence-source validity without hidden reasoning. `verify_contradiction()` deterministically blocks owner mismatch, cross-Orbit scope, disjoint validity windows, stale evidence, sensitive auto-persistence, predicate mismatch, non-opposed polarity, and object mismatch. Sensitive structurally valid conflicts return review-required rather than silently persisting. Verified structural conflicts preserve the existing Omega contradiction flow. Verification: Task-7 + Omega suite 24 passed; full API suite 1112 passed.


---

### Task 8: Real Policy Replay Learning Through Hardness

**Files:**
- Create: `apps/api/app/learning/hardness/replay.py`
- Create: `apps/api/app/learning/hardness/trainers/policy_replay.py`
- Modify: `apps/api/app/learning/hardness/schemas.py`
- Modify: `apps/api/app/learning/hardness/pipeline.py`
- Modify: `apps/api/app/learning/hardness/evaluation.py`
- Modify: `apps/api/app/omega/learning_proposal_service.py`
- Test: `apps/api/app/tests/test_bplus_learning_replay.py`

**Interfaces:**
- Adds `LearningIntervention.POLICY_REPLAY` and `TrainerType.POLICY_REPLAY`.
- Produces a candidate artifact containing a bounded policy delta, replay corpus hash, target metrics, critical gate results, and rollback payload.

- [x] **Step 1: Write a failing replay-improvement test**

```python
async def test_retrieval_weight_candidate_must_beat_baseline_before_promotion(app_engine):
    corpus = fixed_replay_corpus([
        case(query='project deadline', expected_source='project:deadline'),
        case(query='private relationship note', expected_source='orbit:personal'),
    ])
    result = await run_policy_replay(
        baseline={'recency': 1.5, 'query_relevance': 2.0},
        candidate={'recency': 0.5, 'query_relevance': 5.0},
        corpus=corpus,
    )
    assert result.target_metric_delta > 0
    assert result.scope_leak_count == 0
    assert result.critical_gates_passed is True
```

- [x] **Step 2: Implement replay corpus construction**

Build frozen cases from owner-approved historical `ModelRunSource`, `ModelEvaluation`, `UserCorrection`, prediction/outcome pairs, and explicit scope metadata. Hash the manifest; do not include raw secrets or Capsule-recipient-excluded material.

- [x] **Step 3: Implement POLICY_REPLAY trainer**

Supported v0.1 policy deltas: retrieval weights, context recipes, prompt rules, planning heuristics, and router policies. Execute baseline and candidate against the same frozen fixtures. Store only structured scores/results, not hidden reasoning.

- [x] **Step 4: Add critical gates**

Always evaluate `scope_leaks == 0`, no new forbidden capability, no authority widening, no increase in owner-correction rate on heldout fixtures, and no critical Agency regression. A target win with a failed critical gate is `REJECTED`.

- [x] **Step 5: Bridge Omega learning proposals**

Creating an eligible Omega proposal emits a Hardness learning signal/candidate; approval never skips Hardness evaluation. Legacy UI status mirrors Hardness result.

- [x] **Step 6: Verify and commit**

Run `pytest -q app/tests/test_bplus_learning_replay.py app/tests/test_hardness_unit.py app/tests/test_hardness_e2e.py app/tests/test_omega.py`.

```bash
git add apps/api/app/learning/hardness apps/api/app/omega/learning_proposal_service.py apps/api/app/tests/test_bplus_learning_replay.py
git commit -m "feat(nur): evaluate learning changes with real policy replay"
```


**Closure — 2026-09-03:** PASS. Hardness now supports `POLICY_REPLAY` as a real bounded intervention/trainer over a frozen replay corpus instead of simulated improvement. Replay manifests are deterministic and sanitized; raw secrets and Capsule-recipient-excluded material are not persisted in the corpus artifact. Baseline and candidate policies run against the same fixtures, and promotion is vetoed by any scope leak, authority widening, forbidden capability, owner-correction regression, or critical Agency regression. Eligible Omega policy proposals emit canonical Hardness signals/candidates and owner approval cannot bypass replay evaluation; legacy proposal status mirrors the Hardness verdict. Forward migration `0064_bplus_policy_replay` extends only the existing Hardness intervention/trainer constraints. Verification: Task-8 + Hardness/Omega regression 47 passed; full API suite 1121 passed.


---

### Task 9: Donor Audit and Animantum Capability Broker

**Files:**
- Create: `tools/bplus/audit_donors.py`
- Create: `apps/api/app/tool_broker/contracts.py`
- Create: `apps/api/app/tool_broker/registry.py`
- Create: `apps/api/app/tool_broker/adapters/__init__.py`
- Create: `docs/research/NUR_BPLUS_DONOR_AUDIT.md`
- Test: `apps/api/app/tests/test_bplus_tool_broker.py`

**Interfaces:**
- Produces stable `CapabilityKey`, `AdapterSpec`, `CapabilityRequest`, and `CapabilityResult` contracts.
- Existing `agentic.registry` remains risk/authority owner; broker only chooses an implementation adapter after Agency has authorized the capability.

- [ ] **Step 1: Write the broker contract test**

```python
def test_broker_resolves_capability_without_exposing_donor_api():
    registry = CapabilityBrokerRegistry()
    registry.register(FakeAdapter(key='playwright.local', capabilities={'browser.navigate'}))
    resolved = registry.resolve('browser.navigate')
    assert resolved.key == 'playwright.local'
    assert 'playwright' not in CapabilityKey.BROWSER_NAVIGATE.value
```

- [ ] **Step 2: Implement read-only donor auditor**

`audit_donors.py` receives local repo paths, reads Git remote/HEAD, license files, package manifests, executable hooks, network/secrets/config references, and recent commit metadata without running setup scripts. It writes one row per donor with evidence and classification `USE|DONOR|REWRITE|QUARANTINE|KILL`.

Audit at minimum: OpenClaw/Animantum adapter, Playwright, browser-use, Letta, Graphiti, Mem0, LangGraph, OpenHands, Agent Lightning, Composio, Nango, Firecracker, gVisor, cosign, TUF.

- [ ] **Step 3: Add broker contracts only; no donor execution yet**

Initial stable capability keys: `browser.navigate`, `browser.extract`, `research.fetch`, `worker.background`, `worker.code`, `app.read`, `app.write`, `model.run`.

- [ ] **Step 4: Enforce adapter enablement from audit evidence**

Registry refuses `QUARANTINE`/`KILL` adapters and requires explicit code-level allow-list for `USE` or `REWRITE` adapters. `DONOR` means study-only and cannot be resolved at runtime.

- [ ] **Step 5: Verify and commit**

Run `pytest -q app/tests/test_bplus_tool_broker.py app/tests/agentic/test_tool_registry.py`.

```bash
git add tools/bplus/audit_donors.py apps/api/app/tool_broker docs/research/NUR_BPLUS_DONOR_AUDIT.md apps/api/app/tests/test_bplus_tool_broker.py
git commit -m "feat(nur): add audited capability broker boundary"
```

---

### Task 10: Brokered Execution Receipts Through Agency

**Files:**
- Create: `apps/api/alembic/versions/0063_nur_bplus_execution_receipts.py`
- Modify: `apps/api/app/models/agentic.py`
- Modify: `apps/api/app/agentic/handlers.py`
- Modify: `apps/api/app/agentic/registry.py`
- Modify: `apps/api/app/tool_broker/registry.py`
- Test: `apps/api/app/tests/test_bplus_execution_receipts.py`

**Interfaces:**
- Evolves `AgentToolCall` into the canonical external-effect receipt.
- Adds `capability_key`, `adapter_key`, `adapter_version`, `result_digest`, `external_effects`, `artifact_refs`, `verification_verdict`, `rollback_ref`.

- [ ] **Step 1: Write failing receipt test**

```python
async def test_authorized_broker_call_writes_complete_receipt(client, app_engine):
    workflow = await create_authorized_read_only_workflow(client, capability='browser.extract')
    await execute_workflow(workflow)
    receipt = await latest_tool_call(app_engine, workflow.id)
    assert receipt.capability_key == 'browser.extract'
    assert receipt.adapter_key
    assert receipt.result_digest
    assert receipt.verification_verdict in {'PASS', 'WARN'}
```

- [ ] **Step 2: Add migration/ORM fields with FORCE-RLS parity tests**
- [ ] **Step 3: Route authorized AgentStep execution through broker resolution; unknown/unapproved capabilities fail closed**
- [ ] **Step 4: Hash redacted inputs/results, record external effects/artifacts, and never persist secrets**
- [ ] **Step 5: Run `pytest -q app/tests/test_bplus_execution_receipts.py app/tests/agentic/test_tool_call_approval_binding_db.py app/tests/agentic/test_real_broker_e2e_db.py app/tests/test_agency_bridge_strict.py`**
- [ ] **Step 6: Commit**

```bash
git add apps/api/alembic/versions/0063_nur_bplus_execution_receipts.py apps/api/app/models/agentic.py apps/api/app/agentic apps/api/app/tool_broker apps/api/app/tests/test_bplus_execution_receipts.py
git commit -m "feat(nur): record brokered tool effects as Agency receipts"
```

---

### Task 11: Unified Cognitive State and Talk Loop Integration

**Files:**
- Modify: `apps/api/app/mind/unified_state.py`
- Modify: `apps/api/app/mind/cognitive_loop.py`
- Modify: `apps/api/app/mind/context.py`
- Modify: `apps/api/app/brain/schemas.py`
- Modify: `apps/api/app/brain/cognition.py`
- Test: `apps/api/app/tests/test_bplus_unified_loop.py`

**Interfaces:**
- `build_unified_cognitive_state()` returns one transient owner-scoped state carrying identity, scope, attention, canonical claims, memories, world refs, self/user projections, predictions, contradictions, capabilities and evidence.

- [ ] **Step 1: Write a failing turn-level continuity test**
- [ ] **Step 2: Build unified state only after `resolve_scope()` and before provider/worker dispatch**
- [ ] **Step 3: Make `CognitiveTaskPacket` consume projections from unified state instead of parallel legacy hydration lists**
- [ ] **Step 4: Keep Talk response schema backward compatible and preserve existing streaming events**
- [ ] **Step 5: Enable `NUR_BPLUS_CANONICAL_CLAIMS` in tests and run shadow parity against legacy mode**
- [ ] **Step 6: Run `pytest -q app/tests/test_bplus_unified_loop.py app/tests/test_mind_brain_vertical_slice.py app/tests/test_cognition.py app/tests/test_cognition_streaming.py`**
- [ ] **Step 7: Commit `feat(nur): assemble one scoped unified cognitive state per turn`**

---

### Task 12: Ambient B+ State Across V197 Without Re-skinning It

**Files:**
- Create: `apps/web/src/bridge/v197Cognition.ts`
- Modify: `apps/web/src/bridge/v197ApiClient.ts`
- Modify: `apps/web/src/bridge/v197Bridge.ts`
- Modify: `apps/web/src/bridge/v197Insights.ts`
- Modify: `apps/web/src/bridge/v197Timeline.ts`
- Modify: `apps/web/src/bridge/v197Map.ts`
- Test: `apps/web/src/v197/bplus-cognition-contract.test.ts`
- Test: `apps/web/e2e/bplus-ambient-cognition.spec.ts`

**Interfaces:**
- Adds owner-visible epistemic receipts: `whyChanged`, `epistemicStatus`, `authorityStatus`, `confidence`, `openContradictions`, `predictionState`, and `learningState`.
- Does not change the V197 visual ownership contract; it hydrates existing surfaces with governed state.

- [ ] **Step 1: Write bridge contract tests**

```ts
it('keeps observation, inference, and owner authority visually distinguishable', () => {
  const vm = toCognitionViewModel(seedCanonicalClaim())
  expect(vm.epistemicStatus).toBe('INFERRED')
  expect(vm.authorityStatus).toBe('OWNER_CONFIRMED')
  expect(vm.whyChangedHref).toContain('/why-changed')
})
```

- [ ] **Step 2: Add ambient state to Talk/Insights/Timeline/Map bridge models only where the current surface already has a semantic home**
- [ ] **Step 3: Add E2E proof that a WhyChanged receipt can be opened from an Insight/Timeline transition without exposing raw chain-of-thought**
- [ ] **Step 4: Run V197 contract/performance/accessibility tests plus `omega-research.spec.ts`, `insights-seeded-review.spec.ts`, `timeline-surface.spec.ts`, and `map-surface.spec.ts`**
- [ ] **Step 5: Commit `feat(nur): surface unified cognition through V197 receipts`**

---

### Task 13: B+ Gate Runner and Jarvis Continuity End-to-End Proof

**Files:**
- Create: `infra/scripts/nur-bplus-gate.sh`
- Create: `apps/api/app/tests/test_bplus_jarvis_continuity.py`
- Create: `apps/web/e2e/bplus-jarvis-continuity.spec.ts`
- Modify: release documentation only after gates pass.

**Interfaces:**
- Gate runner executes B00-B15 and exits non-zero on any missing or failed proof.

- [ ] **Step 1: Write the end-to-end persisted-state scenario**

```python
async def test_prediction_outcome_revision_changes_later_recommendation(client):
    await seed_strategy_a_with_prediction(client, confidence=0.75)
    await record_contradicting_outcome(client)
    await run_omega_and_learning(client)
    later = await ask_same_task_class(client)
    assert later.recommendation != 'Strategy A'
    why = await fetch_why_changed_for_revised_claim(client)
    assert why['changes']
    assert 'chain' not in str(why).lower()
```

- [ ] **Step 2: Require the later response to cite persisted claim version, prediction resolution, and outcome evidence IDs**
- [ ] **Step 3: Prove owner confirmation cannot be forged, scope cannot leak, and learning cannot widen Agency permissions inside the same scenario**
- [ ] **Step 4: Implement `nur-bplus-gate.sh` with named B00-B15 sections and exact commands**
- [ ] **Step 5: Run the full API suite, relevant web unit tests, Playwright V197 suites, migration roundtrip/RLS suites, and the Jarvis continuity E2E**
- [ ] **Step 6: Commit `test(nur): lock B+ Jarvis continuity acceptance gates`**

---