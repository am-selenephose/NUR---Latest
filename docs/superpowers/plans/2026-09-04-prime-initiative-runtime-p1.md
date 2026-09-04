# Prime Initiative Runtime P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Prime P1 so NUR can wake without a Talk prompt, detect a material canonical state change, persist exactly one scoped initiative, revise it when evidence changes, surface it in later cognition/V197, and remain unable to create external execution authority.

**Architecture:** Prime is a small Mind-owned initiative runtime over existing ScopeEnvelope, UnifiedCognitiveState, Omega/WhyChanged, AgentPolicy and Agency. Deterministic detectors create typed opportunity signals from canonical records; a versioned `mind_initiatives` ledger provides dedupe/restart continuity; owner-visible and Agency projections reference that ledger without copying memory, workflow, policy or execution state.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, SQLAlchemy async, PostgreSQL + FORCE RLS, Alembic, Celery/Redis, pytest, TypeScript, Vite/Vitest, Playwright, existing V197 bridge.

**Spec:** `docs/superpowers/specs/2026-09-04-prime-initiative-runtime-design.md`

## Global Constraints

- Implementation base is `feat/nur-bplus-v0.1`; inspect current HEAD before every task because main may have been merged again.
- Prime remains inside Mind; do not add a second Brain, Omega, memory store, workflow engine, provider boundary or autonomy policy.
- P1 is proposal-first: P1 has no external tool invocation path, and no new path may auto-start an external action.
- Existing `AgentPolicy` is the only owner initiative/authority policy; Prime cannot edit `permitted_tools`, `auto_run_tools`, capabilities or risk ceilings.
- Existing Agency is the only durable execution authority; any tool path remains Agency → capability broker → verifier → receipt.
- Existing `UnifiedCognitiveState` is the only cognitive carrier; Prime may add a bounded initiative projection to it but may not hydrate a shadow context stack.
- Existing Omega evidence/version lineage and `WhyChangedService` determine why initiative state changed.
- Add only one new durable table family in P1: `mind_initiatives`; do not create speculative P2–P5 tables.
- Existing `infra/scripts/nur-bplus-gate.sh` B00–B15 semantics are frozen. Prime gets a separate `infra/scripts/nur-prime-gate.sh`.
- Ship scheduled Prime processing behind `NUR_PRIME_ENABLED=false` by default; tests explicitly enable it. Enabling the scheduler is deployment configuration, not execution authority.
- Preserve V197 DOM/CSS ownership: add typed adjunct state to existing surfaces, never a new Prime dashboard.
- No raw chain-of-thought, scratchpad, hidden reasoning or private context dumps in database rows, Celery payloads, logs or DOM.

## File Structure

```text
apps/api/alembic/versions/0066_nur_prime_initiatives.py
    Forward migration for mind_initiatives, FORCE RLS, constraints and indexes.
apps/api/app/models/initiative.py
    Minimal ORM for the initiative ledger; no workflow/event/memory duplication.
apps/api/app/mind/initiative_contracts.py
    Typed trigger, priority, status, signal, candidate, decision and service result contracts.
apps/api/app/mind/initiative_detector.py
    Deterministic P1 signal formation from prediction, workflow and explicit owner-correction records.
apps/api/app/mind/initiative_service.py
    Policy gate, dedupe/versioning, WhyChanged, decision persistence, owner actions and Agency proposal handoff.
apps/api/app/mind/initiative_tasks.py
    ID-only scheduled owner discovery/dispatch and owner-scoped worker entry.
apps/api/app/api/v1/initiatives.py
    Owner-scoped read/dismiss/defer/correct/why-changed API.
apps/api/app/mind/unified_state.py
    Bounded open-initiative projection into the existing cognitive carrier.
apps/api/app/mind/why_changed.py
    Add INITIATIVE entity type only.
apps/api/app/mind/agency_bridge.py
    Accept explicit trigger kind/ref so Prime workflows retain lineage without auto-starting.
apps/api/app/core/config.py + apps/api/app/workers/celery_app.py
    Prime feature flag, cadence/bounds and Beat registration.
apps/web/src/bridge/v197ApiClient.ts + apps/web/src/bridge/v197Prime.ts
    Fetch and whitelist owner-visible initiative receipts.
apps/web/src/bridge/v197Hydration.ts + apps/web/src/bridge/v197Bindings.ts
    Existing Talk adjunct projection and typed owner actions.
infra/scripts/nur-prime-gate.sh
    Fail-closed P1 acceptance runner that invokes frozen B+ acceptance as a prerequisite.
```

---
### Task 1: Prime P1 typed contracts

**Files:**
- Create: `apps/api/app/mind/initiative_contracts.py`
- Test: `apps/api/app/tests/test_prime_contracts.py`

**Interfaces:**
- Consumes: `app.brain.schemas.ScopeEnvelope`, existing `AgentPolicy` vocabulary.
- Produces: `PrimeTriggerKind`, `PriorityClass`, `InitiativeStatus`, `InitiativeDisposition`, `OpportunitySignal`, `InitiativeCandidate`, `InitiativeDecision`, `PrimeProcessResult`.

- [ ] **Step 1: Write the failing contract tests**

```python
def test_opportunity_signal_is_scoped_and_has_no_authority_fields(scope):
    signal = OpportunitySignal(
        owner_user_id=scope.owner_user_id, scope=scope,
        trigger_kind=PrimeTriggerKind.PREDICTION_RESOLVED,
        trigger_ref="PREDICTION:00000000-0000-0000-0000-000000000001",
        subject_ref="OMEGA_CLAIM:00000000-0000-0000-0000-000000000002",
        evidence_refs=["OUTCOME:00000000-0000-0000-0000-000000000003"],
        source_versions={"claim": "2"}, signal_fingerprint="sha256:" + "a" * 64,
    )
    assert signal.scope.scope_id == scope.scope_id
    assert "owner_confirmed" not in signal.model_fields
    assert "permitted_tools" not in signal.model_fields
```

- [ ] **Step 2: Run `pytest -q app/tests/test_prime_contracts.py` and require RED because the module is absent.**
- [ ] **Step 3: Implement the exact P1 enums and immutable contracts**

```python
class PrimeTriggerKind(StrEnum):
    PREDICTION_RESOLVED = "PREDICTION_RESOLVED"
    WORKFLOW_FAILED_OR_STALLED = "WORKFLOW_FAILED_OR_STALLED"
    OWNER_CORRECTION = "OWNER_CORRECTION"
    SCHEDULED_REVIEW = "SCHEDULED_REVIEW"

class PriorityClass(StrEnum):
    P0 = "P0"; P1 = "P1"; P2 = "P2"; P3 = "P3"; P4 = "P4"

class InitiativeStatus(StrEnum):
    OPEN = "OPEN"; DEFERRED = "DEFERRED"; BLOCKED = "BLOCKED"
    PROPOSED = "PROPOSED"; SUPERSEDED = "SUPERSEDED"
    DISMISSED = "DISMISSED"; CLOSED = "CLOSED"

class InitiativeDisposition(StrEnum):
    DISMISS = "DISMISS"; DEFER = "DEFER"; ASK_OWNER = "ASK_OWNER"
    PROPOSE_AGENCY = "PROPOSE_AGENCY"; SURFACE_IN_TALK = "SURFACE_IN_TALK"
```

`OpportunitySignal` must include `signal_id`, `owner_user_id`, full resolved `scope: ScopeEnvelope`, `trigger_kind`, `trigger_ref`, `subject_ref`, `observed_at`, `evidence_refs`, `source_versions`, and `signal_fingerprint`. `InitiativeCandidate` adds task class, objective, reason code, priority, uncertainty/missing-information lists, expiry, policy version, review strategy, candidate version, and `estimated_cost_cents: int = 0` for the existing daily-budget gate. `InitiativeDecision` stores only disposition, concise reason code, evidence refs, review verdict and policy version. `PrimeProcessResult` is `{initiative_id: UUID | None, status: str, candidate_version: int | None, disposition: InitiativeDisposition | None, changed: bool}`.

- [ ] **Step 4: Add validation tests that reject owner mismatch, empty evidence for evidence-required triggers, invalid sha256 fingerprints and unknown dispositions.**
- [ ] **Step 5: Run `pytest -q app/tests/test_prime_contracts.py`; require PASS.**
- [ ] **Step 6: Run Ruff on the two Task-1 files and `git diff --check`.**
- [ ] **Step 7: Commit `feat(nur): define Prime initiative contracts`.**

---
### Task 2: `mind_initiatives` ledger, migration and FORCE RLS

**Files:**
- Create: `apps/api/alembic/versions/0066_nur_prime_initiatives.py`
- Create: `apps/api/app/models/initiative.py`
- Modify: `apps/api/app/models/__init__.py`
- Modify: `apps/api/app/mind/why_changed.py`
- Test: `apps/api/app/tests/test_prime_initiative_schema.py`

**Interfaces:**
- Consumes: Task-1 enums; `WhyChangedRecordRow`; current Alembic head `0065_bplus_execution_receipts`.
- Produces: ORM `MindInitiative`; `EntityType.INITIATIVE`; database uniqueness/RLS guarantees used by Task 4.

- [ ] **Step 1: Write RED schema tests against a fresh migrated database**

```python
async def test_mind_initiatives_has_force_rls_and_open_dedupe(super_engine):
    # assert relrowsecurity + relforcerowsecurity
    # assert partial unique index uq_mind_initiatives_owner_open_dedupe exists
    # assert all required columns exist and no raw_reasoning/chain_of_thought column exists
```

Also add the real `nur_app` denial matrix: owner A can CRUD A; owner A cannot SELECT/INSERT/UPDATE/DELETE B; missing owner context returns no rows/refuses writes.

- [ ] **Step 2: Run `pytest -q app/tests/test_prime_initiative_schema.py`; require RED because migration/table do not exist.**
- [ ] **Step 3: Add forward migration `0066_nur_prime_initiatives.py` with `down_revision = "0065_bplus_execution_receipts"`.**
Migration columns must be exactly:

```text
id uuid PK; owner_user_id uuid FK users CASCADE
orbit_id uuid FK orbits SET NULL; project_id uuid FK am_projects SET NULL
capsule_id uuid FK context_capsules SET NULL; community_id uuid FK community_rooms SET NULL
trigger_kind varchar(48); trigger_ref varchar(160); subject_ref varchar(160)
dedupe_key varchar(71); evidence_digest varchar(71); candidate_version integer >= 1
status varchar(24); disposition varchar(24); task_class varchar(64); priority_class varchar(4)
objective text; reason_code varchar(80)
scope_snapshot jsonb; evidence_refs jsonb; counter_evidence_refs jsonb
uncertainties jsonb; missing_information jsonb
policy_version integer; review_strategy_id varchar(80); review_verdict varchar(24)
expires_at timestamptz; deferred_until timestamptz; last_seen_at timestamptz
workflow_id uuid FK agent_workflows SET NULL
created_at timestamptz; updated_at timestamptz
```

Add CHECK constraints for Task-1 status/disposition/priority enums, `candidate_version >= 1`, sha256 digest shape, and a partial unique index:

```sql
CREATE UNIQUE INDEX uq_mind_initiatives_owner_open_dedupe
ON mind_initiatives(owner_user_id, dedupe_key)
WHERE status IN ('OPEN','DEFERRED','BLOCKED','PROPOSED');
```

Enable + FORCE RLS and create owner SELECT/INSERT/UPDATE/DELETE policies using `app_current_user_id()`.

- [ ] **Step 4: Implement `MindInitiative` ORM matching the migration exactly; export it from `app.models`.**
- [ ] **Step 5: Add `INITIATIVE = "initiative"` to `EntityType`; do not create a second WhyChanged table.**
- [ ] **Step 6: Run `alembic heads` and require exactly `0066_prime_initiatives (head)`; run schema/RLS test and migration reachability/roundtrip suites.**
- [ ] **Step 7: Run Ruff + `git diff --check`; commit `feat(nur): add Prime initiative ledger`.**

---
### Task 3: Deterministic opportunity detector

**Files:**
- Create: `apps/api/app/mind/initiative_detector.py`
- Test: `apps/api/app/tests/test_prime_detector.py`

**Interfaces:**
- Consumes: Task-1 `OpportunitySignal`; `Prediction`, `OmegaClaim`, `OmegaClaimVersion`, `AgentWorkflow`, `UserCorrection`, resolved `ScopeEnvelope`.
- Produces: `prediction_resolved_signal()`, `workflow_stalled_signal()`, `owner_correction_signal()`, `discover_owner_signals()`.

- [ ] **Step 1: Write RED tests for all three mandatory P1 source classes.**

```python
async def test_contradicted_prediction_forms_real_evidence_signal(db, owner, scope, seeded_prediction):
    signals = await discover_owner_signals(db, owner_user_id=owner, scope=scope, limit=25)
    signal = next(item for item in signals if item.trigger_kind == PrimeTriggerKind.PREDICTION_RESOLVED)
    assert signal.evidence_refs == [
        f"OMEGA_CLAIM_VERSION:{seeded_prediction.claim_version_id}",
        f"PREDICTION:{seeded_prediction.id}",
        f"OUTCOME:{seeded_prediction.outcome_id}",
    ]
```

Add tests for an owner-scoped `AgentWorkflow(state="NEEDS_REVISION")` producing `WORKFLOW_FAILED_OR_STALLED`, and an explicitly bound `UserCorrection + MindInitiative` producing `OWNER_CORRECTION`. Add negatives for open prediction, succeeded workflow, cross-owner row and cross-Orbit row.

- [ ] **Step 2: Run `pytest -q app/tests/test_prime_detector.py`; require RED.**
- [ ] **Step 3: Implement canonical fingerprinting and signal formation.**

```python
def signal_fingerprint(*, owner_user_id: UUID, scope: ScopeEnvelope,
                       trigger_kind: PrimeTriggerKind, trigger_ref: str,
                       subject_ref: str, evidence_refs: list[str],
                       source_versions: dict[str, str]) -> str:
    payload = {
        "owner": str(owner_user_id), "scope": scope.model_dump(mode="json"),
        "trigger": trigger_kind.value, "trigger_ref": trigger_ref,
        "subject_ref": subject_ref, "evidence_refs": sorted(evidence_refs),
        "source_versions": source_versions,
    }
    return "sha256:" + sha256(canonical_json(payload)).hexdigest()
```

`prediction_resolved_signal()` returns a signal only for `status=RESOLVED`, `resolution=CONTRADICTED`, real `resolved_outcome_id`, real `omega_claim_id`, and the current owner-scoped claim version. `workflow_stalled_signal()` accepts only `FAILED` or `NEEDS_REVISION`; it must not claim transient RUNNING leases because Agency recovery owns lease recovery. `owner_correction_signal()` requires an already-owned initiative argument, preventing fuzzy text matching from attaching a correction to arbitrary state.

Priority rules are code constants: owner correction `P1`; contradicted prediction and workflow revision `P2`; scheduled review `P4`. P1 detectors do not produce P0.

- [ ] **Step 4: Implement `discover_owner_signals()` with exact owner/scope filters and a hard `limit <= 25`; narrow Project/Capsule/Community scopes return only source classes whose rows prove those boundaries, otherwise fail closed.**
- [ ] **Step 5: Assert detector output contains canonical IDs only and never raw correction text, workflow result blobs or outcome bodies.**
- [ ] **Step 6: Run detector + Task-13 continuity tests; require PASS.**
- [ ] **Step 7: Ruff/diff check; commit `feat(nur): detect bounded Prime opportunities`.**

---
### Task 4: Initiative service — policy gate, dedupe, versioning and WhyChanged

**Files:**
- Create: `apps/api/app/mind/initiative_service.py`
- Test: `apps/api/app/tests/test_prime_service.py`

**Interfaces:**
- Consumes: Tasks 1–3 contracts/signals, `MindInitiative`, `load_policy()`, `select_review_strategy()`, `WhyChangedService`.
- Produces: `initiative_dedupe_key()`, `process_signal()`, `run_prime_owner_pass()`, `dismiss_initiative()`, `defer_initiative()`, `apply_owner_correction()`.

- [ ] **Step 1: Write RED idempotency/versioning tests.**

```python
async def test_same_signal_is_one_initiative_and_material_change_versions_it(db, owner, signal):
    first = await process_signal(db, signal=signal)
    replay = await process_signal(db, signal=signal)
    assert replay.initiative_id == first.initiative_id
    assert replay.candidate_version == 1

    changed = signal.model_copy(update={
        "evidence_refs": [*signal.evidence_refs, "OUTCOME:00000000-0000-0000-0000-000000000099"],
        "signal_fingerprint": "sha256:" + "b" * 64,
    })
    revised = await process_signal(db, signal=changed)
    assert revised.initiative_id == first.initiative_id
    assert revised.candidate_version == 2
```

Add a concurrent two-session test proving one active row survives the partial unique index/advisory-lock path. Add terminal-memory tests: DISMISSED/SUPERSEDED + unchanged evidence returns the existing terminal result and creates no row; materially changed evidence may open a new current initiative for the same dedupe identity.

- [ ] **Step 2: Write RED policy tests for OFF, proposal quota, cooldown, quiet hours, zero remaining daily budget and evaluation failure.**
- [ ] **Step 3: Implement stable dedupe and evidence digests separately.**

```python
def initiative_dedupe_key(signal: OpportunitySignal, *, task_class: str) -> str:
    identity = {
        "owner": str(signal.owner_user_id),
        "scope": {
            "orbit": str(signal.scope.orbit_id or ""), "project": str(signal.scope.project_id or ""),
            "capsule": str(signal.scope.capsule_id or ""), "community": str(signal.scope.community_id or ""),
        },
        "trigger_class": signal.trigger_kind.value,
        "subject": signal.subject_ref,
        "task_class": task_class,
    }
    return digest(identity)

def evidence_digest(signal: OpportunitySignal) -> str:
    return digest({"refs": sorted(signal.evidence_refs), "versions": signal.source_versions})
```

Use `pg_advisory_xact_lock(hashtextextended(...))` on `owner + dedupe_key` before reading/upserting the active row. Same key + same evidence + same policy/review version only advances `last_seen_at`. Same key + changed evidence increments `candidate_version` exactly once and records `EntityType.INITIATIVE` WhyChanged with old/new version and supporting evidence. Same evidence with a changed `AgentPolicy.version` or selected review-strategy ID also increments/re-evaluates exactly once and records `POLICY_CHANGE`. Before creating a new active row, query the latest terminal row for the dedupe key; unchanged terminal evidence remains terminal, while materially changed evidence may create a new active initiative.

- [ ] **Step 4: Implement deterministic P1 candidate/decision mapping.**

```text
PREDICTION_RESOLVED        → task=strategy_review, priority=P2, disposition=SURFACE_IN_TALK
WORKFLOW_FAILED_OR_STALLED → task=workflow_recovery, priority=P2, disposition=ASK_OWNER
OWNER_CORRECTION           → task=initiative_correction, priority=P1, disposition=DISMISS + status=SUPERSEDED
```

The prediction objective is “Re-evaluate the active recommendation after contradicted prediction evidence”; the workflow objective is “Decide whether to revise, retry, or retire the stalled workflow”. Do not generate Strategy B inside the detector/service; later Talk uses the same persisted evidence/initiative state to synthesize the updated recommendation.
- [ ] **Step 5: Enforce current AgentPolicy before surfacing/proposing.**

`process_signal()` loads policy fresh via `load_policy()`, derives `review_strategy_id = f"prime-p1:{review.depth.value}:v1"`, and applies this order before decision persistence:

```text
initiative_level == OFF                         → SKIPPED_POLICY_OFF, no initiative surfaced
quiet hours active                              → status=DEFERRED, reason=BUDGET_OR_QUIET_HOURS
same owner has surfaced/proposed inside cooldown→ status=DEFERRED, deferred_until=last + cooldown
max_proposals_per_day reached                   → status=DEFERRED until next local day
estimated evaluation cost > remaining daily budget → status=DEFERRED, reason=BUDGET_OR_QUIET_HOURS
otherwise                                       → run deterministic P1 evaluation/review
```

Read timezone from persisted quiet-hours policy exactly as Agency does; never compare owner clock hours in UTC by accident. Count only dispositions `SURFACE_IN_TALK`, `ASK_OWNER`, `PROPOSE_AGENCY` toward proposal quota, not idempotent re-observations.

- [ ] **Step 6: Make evaluation/review failure fail closed.**

Expose an internal `InitiativeEvaluator` protocol whose P1 default is deterministic. `process_signal(..., evaluator=...)` catches typed evaluator/schema/review failures and persists `DEFERRED` with reason `TRANSIENT_INPUT_FAILURE`, `SCHEMA_OR_VALIDATION`, or `INSUFFICIENT_EVIDENCE`; it must never fall through to `PROPOSE_AGENCY`.

- [ ] **Step 7: Implement typed owner actions.** `dismiss_initiative()` terminally marks `DISMISSED`; `defer_initiative()` requires a future UTC timestamp; `apply_owner_correction()` creates/accepts an explicit correction evidence ref, records owner-corrected WhyChanged and marks the prior candidate `SUPERSEDED` so unchanged evidence cannot resurrect it.
- [ ] **Step 8: Run `test_prime_service.py`, detector tests, Agency policy tests and Task-13 continuity tests; require PASS.**
- [ ] **Step 9: Ruff/diff check; commit `feat(nur): persist governed Prime initiative decisions`.**

---
### Task 5: Ambient scheduler and ID-only worker entry

**Files:**
- Create: `apps/api/app/mind/initiative_tasks.py`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/workers/celery_app.py`
- Test: `apps/api/app/tests/test_prime_tasks.py`

**Interfaces:**
- Consumes: Task-4 `run_prime_owner_pass()`; existing `set_user_context`, `get_sessionmaker`, Celery app and active `User` records.
- Produces: `prime_due_owner_ids()`, tasks `nur.prime.scan_due_owners` and `nur.prime.scan_owner`.

- [ ] **Step 1: Write RED tests proving payload privacy and feature gating.**

```python
def test_prime_beat_is_disabled_by_default(settings, celery):
    assert "nur-prime-scan-due-owners" not in celery.conf.beat_schedule

async def test_prime_owner_task_sets_rls_before_reading_private_state(monkeypatch):
    # assert call order: set_user_context -> run_prime_owner_pass -> commit
    # task argument is owner UUID string only; no evidence/context/body fields
```

Also test owner batch bound and `prime_signal_limit_per_owner <= 25`.

- [ ] **Step 2: Run `pytest -q app/tests/test_prime_tasks.py`; require RED.**
- [ ] **Step 3: Add settings:**

```python
prime_enabled: bool = Field(default=False, validation_alias="NUR_PRIME_ENABLED")
prime_scan_interval_seconds: int = Field(default=300, ge=60, le=3600, validation_alias="NUR_PRIME_SCAN_INTERVAL_SECONDS")
prime_owner_batch: int = Field(default=50, ge=1, le=100, validation_alias="NUR_PRIME_OWNER_BATCH")
prime_signal_limit_per_owner: int = Field(default=25, ge=1, le=25, validation_alias="NUR_PRIME_SIGNAL_LIMIT_PER_OWNER")
```
- [ ] **Step 4: Implement owner discovery and owner worker entry in `initiative_tasks.py`.**

```python
async def prime_due_owner_ids(db: AsyncSession, *, limit: int) -> list[UUID]:
    await set_auth_context(db)
    return list((await db.execute(
        select(User.id).where(User.status == "active")
        .order_by(User.created_at.asc(), User.id.asc()).limit(min(max(limit, 1), 100))
    )).scalars())

@celery.task(name="nur.prime.scan_owner", ignore_result=False, acks_late=True)
def prime_scan_owner_task(owner_user_id: str) -> dict:
    return run_task(lambda: _prime_scan_owner(owner_user_id))
```

The async owner worker parses the UUID, opens one session, calls `set_user_context`, invokes `run_prime_owner_pass(limit=settings.prime_signal_limit_per_owner)`, commits, and returns IDs/counts only. The due-owner task enumerates active IDs under auth context and enqueues one owner task per ID.

- [ ] **Step 5: Register `app.mind.initiative_tasks` in Celery `include` and add one Beat entry only when `prime_enabled` is true.** Use task `nur.prime.scan_due_owners`, cadence `max(60, prime_scan_interval_seconds)`, and matching expiry so scans cannot backlog indefinitely.
- [ ] **Step 6: Add tests that duplicate scheduled deliveries produce the same initiative state through Task-4 dedupe.**
- [ ] **Step 7: Run Prime task tests plus existing Omega/Insights/Agency worker tests; require PASS.**
- [ ] **Step 8: Ruff/diff check; commit `feat(nur): schedule bounded Prime owner scans`.**

---
### Task 6: UnifiedCognitiveState projection and typed owner API

**Files:**
- Modify: `apps/api/app/mind/unified_state.py`
- Create: `apps/api/app/api/v1/initiatives.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/app/tests/test_prime_interactive.py`

**Interfaces:**
- Consumes: `MindInitiative`, Task-4 owner actions, existing `build_unified_cognitive_state()`.
- Produces: `UnifiedCognitiveState.initiatives`, owner routes `GET /initiatives` (`status=open` means OPEN/DEFERRED/BLOCKED/PROPOSED), `POST /initiatives/{id}/dismiss`, `/defer`, `/correct`, `GET /initiatives/{id}/why-changed`.

- [ ] **Step 1: Write RED state-projection tests.**

```python
async def test_unified_state_projects_only_open_exact_scope_initiatives(db, owner, orbit_a, orbit_b):
    state = await build_state(owner=owner, orbit=orbit_a)
    assert [row["id"] for row in state.initiatives] == [str(expected_orbit_a.id)]
    assert str(other_owner.id) not in json.dumps(state.model_dump(mode="json"))
    assert str(orbit_b_initiative.id) not in json.dumps(state.model_dump(mode="json"))
```

Test Project/Capsule/Community exact-boundary filters using the ledger's own scope columns; no account/Orbit fallback is allowed for a narrower request.

- [ ] **Step 2: Write RED API tests for owner-only list/detail actions, CSRF on mutations, 404 for cross-owner IDs, and unchanged-evidence dismissal suppression.**
- [ ] **Step 3: Add `initiatives: list[dict[str, Any]] = Field(default_factory=list)` to `UnifiedCognitiveState`.**
Load at most 5 nonterminal initiatives after scope resolution, ordered `priority_class ASC, updated_at DESC`, with exact boundary predicates. Project/Capsule/Community rows are usable only when the corresponding requested scope ID matches. Projection fields are whitelist-only:

```text
id, candidate_version, objective, reason_code, priority_class,
status, disposition, evidence_refs, uncertainties, missing_information,
workflow_id, updated_at, why_changed_endpoint
```

No `scope_snapshot` raw JSON, provider trace, correction text or hidden reasoning enters the Brain packet.

- [ ] **Step 4: Create owner API Pydantic inputs.**

```python
class InitiativeDeferIn(BaseModel):
    deferred_until: datetime

class InitiativeCorrectionIn(BaseModel):
    correction_text: str = Field(min_length=1, max_length=4000)
```

`/correct` persists a normal owner `UserCorrection` with the initiative's Orbit, builds an explicit `OWNER_CORRECTION` signal using the known initiative identity, calls `apply_owner_correction()`, and records `USER_CORRECTION:{id}` in WhyChanged evidence. It must not infer which initiative a free-form correction refers to.

- [ ] **Step 5: Implement generic initiative WhyChanged retrieval through `WhyChangedService.get_change_history(entity_type="initiative", entity_id=str(id))`.**
- [ ] **Step 6: Register the router under `/api/v1`; generated Talk output has no direct service mutation hook.**
- [ ] **Step 7: Run interactive tests, Task-11 unified-state tests, Task-13 Jarvis tests and cognition streaming regressions; require PASS.**
- [ ] **Step 8: Ruff/diff check; commit `feat(nur): project Prime initiatives into scoped cognition`.**

---
### Task 7: Agency proposal handoff without auto-start

**Files:**
- Modify: `apps/api/app/mind/agency_bridge.py`
- Modify: `apps/api/app/mind/initiative_service.py`
- Test: `apps/api/app/tests/test_prime_agency_handoff.py`

**Interfaces:**
- Consumes: existing `WorkflowProposalV2`, `submit_workflow_proposal()`, `MindInitiative`.
- Produces: lineage-aware `submit_workflow_proposal(..., trigger_kind, trigger_ref)` and `propose_agency_for_initiative()`.

- [ ] **Step 1: Write RED lineage/no-execution test.**

```python
async def test_prime_proposal_links_workflow_but_never_starts_it(db, owner, initiative, proposal):
    result = await propose_agency_for_initiative(
        db, owner_user_id=owner, initiative_id=initiative.id, proposal=proposal
    )
    assert result.workflow_id is not None
    workflow = await db.get(AgentWorkflow, result.workflow_id)
    assert workflow.trigger_kind == "PRIME_INITIATIVE"
    assert workflow.trigger_ref == initiative.id
    assert workflow.state == "PLAN_READY"
    assert await count_rows(db, AgentDispatchOutbox) == 0
    assert await count_rows(db, AgentToolCall) == 0
```

Use a registered/bound reversible tool contract so the test proves the real compiler path, not an unknown-tool rejection.

- [ ] **Step 2: Run `pytest -q app/tests/test_prime_agency_handoff.py`; require RED because the bridge cannot carry Prime lineage yet.**
- [ ] **Step 3: Extend the existing bridge signature without changing legacy callers.**

```python
async def submit_workflow_proposal(
    db: AsyncSession, *, owner_user_id: UUID, proposal: WorkflowProposal,
    orbit_id: UUID | None = None, project_id: UUID | None = None,
    trigger_kind: str = "MIND_COGNITIVE_RESULT",
    trigger_ref: UUID | None = None,
) -> tuple[AgentWorkflow | None, CompileResult]:
    ...
```

Persist `trigger_kind` and `trigger_ref or proposal.task_id`; all tool validation, policy loading, compilation and approval creation remain existing Agency behavior.

- [ ] **Step 4: Implement `propose_agency_for_initiative()`.** It owner-locks the initiative, requires a nonterminal current version, reloads current policy through the bridge/compiler, compiles the proposal, and on success sets only `workflow_id`, `status=PROPOSED`, `disposition=PROPOSE_AGENCY`. It never calls `start_workflow()`, `queue_ready_dependants()`, dispatcher, broker or handler.
- [ ] **Step 5: On compile failure persist `BLOCKED` with a safe compiler reason and WhyChanged; do not create an approval that could grant an unpermitted tool.**
- [ ] **Step 6: Add a static source guard test proving `initiative_service.py` has no imports/calls to `app.agentic.handlers`, capability broker execution, `run_step`, `start_workflow`, or Celery execution tasks.**
- [ ] **Step 7: Run Prime handoff + existing Agency bridge/compiler/approval/broker receipt suites; require PASS.**
- [ ] **Step 8: Ruff/diff check; commit `feat(nur): hand Prime proposals to existing Agency`.**

---
### Task 8: V197 owner-visible Prime receipts in existing Talk surface

**Files:**
- Create: `apps/web/src/bridge/v197Prime.ts`
- Modify: `apps/web/src/bridge/v197ApiClient.ts`
- Modify: `apps/web/src/bridge/v197Hydration.ts`
- Modify: `apps/web/src/bridge/v197Bindings.ts`
- Test: `apps/web/src/v197/prime-initiative-contract.test.ts`
- Test: `apps/web/e2e/prime-initiative.spec.ts`

**Interfaces:**
- Consumes: Task-6 `/initiatives` API and owner action endpoints.
- Produces: `V197PrimeInitiative`, `toPrimeReceipt()`, `primeSummary()`, Talk adjunct rendering/actions.

- [ ] **Step 1: Write RED unit tests for whitelist projection.**

```ts
it("never projects reasoning or scope dumps into Prime receipts", () => {
  const vm = toPrimeReceipt({
    id: "i-1", candidate_version: 2, objective: "Re-evaluate strategy",
    reason_code: "PREDICTION_CONTRADICTED", priority_class: "P2",
    status: "OPEN", disposition: "SURFACE_IN_TALK", evidence_refs: ["OUTCOME:o-1"],
    chain_of_thought: "never expose", scope_snapshot: { secret: "never expose" },
  });
  expect(JSON.stringify(vm)).not.toContain("never expose");
  expect(vm.whyChangedEndpoint).toBe("/initiatives/i-1/why-changed");
});
```

- [ ] **Step 2: Add `V197PrimeInitiative` API type, `initiatives?: V197PrimeInitiative[]` to `V197BridgeSnapshot`, `initiatives()` client method, and one resilient snapshot read of `/initiatives?status=open&limit=5`.**
- [ ] **Step 3: Implement `v197Prime.ts` as a pure whitelist view-model layer.**

Receipt fields are only:

```text
id, version, objective, reasonCode, priorityClass,
status, disposition, evidenceRefs, missingInformation,
workflowId, updatedAt, whyChangedEndpoint
```

- [ ] **Step 4: Render at most one highest-priority open initiative above/beside the existing `#talk-stream` using existing V197 adjunct/card classes.** Copy starts `NUR noticed…`; show objective, concise reason, evidence count and WhyChanged affordance. Do not create a new navigation root, panel or animation loop.
- [ ] **Step 5: Bind typed actions only:** `Dismiss` → POST `/initiatives/{id}/dismiss`; `Later` → POST `/initiatives/{id}/defer` with `deferred_until = now + 24 hours` (ISO-8601 UTC); `Why changed` → GET the governed `whyChangedEndpoint` and expand a bounded inline history inside the same Talk adjunct; do not navigate to raw API JSON. Do not offer an “Execute” button in P1.
- [ ] **Step 6: Write Playwright proof with mocked and then live API:** initiative appears after snapshot refresh; reload preserves it; dismiss removes it; WhyChanged survives reload; `chain_of_thought`, `reasoning`, `scope_snapshot` sentinels never appear in DOM.
- [ ] **Step 7: Run `npm run typecheck`, the new Vitest file, existing V197 contract/accessibility/performance tests, and `prime-initiative.spec.ts` on Chromium with `--workers=1 --retries=0`; require PASS.**
- [ ] **Step 8: Run canonical V197 integrity hash script and `git diff --check`; commit `feat(nur): surface Prime initiative receipts in V197 Talk`.**

---
### Task 9: P1 end-to-end self-starting continuity proof

**Files:**
- Test: `apps/api/app/tests/test_prime_p1_e2e.py`
- Extend: `apps/web/e2e/prime-initiative.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–8 production paths, Omega consolidation/prediction resolution, scheduled owner worker, UnifiedState and V197 API.
- Produces: release-grade proof that Prime wakes without Talk and remains proposal-only.

- [ ] **Step 1: Write the backend E2E before adding any E2E-specific production code.**

```python
async def test_no_talk_contradiction_wakes_prime_and_survives_restart(...):
    # seed Strategy A canonical claim + OPEN prediction
    # record contradictory Outcome and run real Omega consolidation
    assert await count_talk_turns(db, owner) == 0

    first = await _prime_scan_owner(str(owner))
    initiative = await one_open_initiative(db, owner)
    assert set(initiative.evidence_refs) >= {claim_version_ref, prediction_ref, outcome_ref}
    assert await count_rows(db, AgentToolCall) == 0
    assert await count_rows(db, AgentDispatchOutbox) == 0

    # new DB session = restart boundary
    second = await _prime_scan_owner(str(owner))
    assert await initiative_count(db, owner) == 1
    assert initiative.candidate_version == 1
```

- [ ] **Step 2: Extend the test with material claim-version evidence change; require same initiative ID, version `2`, new WhyChanged row and no duplicate proposal.**
- [ ] **Step 3: Prove later cognition sees the same initiative rather than recomputing it.** Build a real scoped `UnifiedCognitiveState` after the ambient pass and assert the initiative ID/version/evidence refs are in `state.initiatives`. Monkeypatch the existing `app.mind.cognitive_loop.run_brain_step` seam with a deterministic Brain stub that asserts the packet contains the persisted initiative ID/version/evidence refs and returns Strategy B; then run the real `run_talk_kernel` persistence/verifier path and require the later recommendation to differ from the pre-outcome Strategy-A recommendation while citations remain verifier-compatible.
- [ ] **Step 4: Add the two non-prediction branches to the same file:** a `NEEDS_REVISION` workflow yields one `ASK_OWNER` initiative; explicit typed owner correction supersedes an open initiative and an unchanged scheduled pass does not resurrect it.
- [ ] **Step 5: Add release-blocking negative assertions in the same scenario:** cross-owner/cross-Orbit initiative absent; forged owner confirmation is impossible; `AgentPolicy.version`, `permitted_tools`, `auto_run_tools`, capabilities and risk ceiling are byte-for-byte unchanged; no broker/handler/tool call exists.
- [ ] **Step 6: Run `pytest -q app/tests/test_prime_p1_e2e.py app/tests/test_bplus_jarvis_continuity.py`; require PASS.**
- [ ] **Step 7: Run live Chromium Prime E2E on a fresh role-split seeded DB with `NUR_PRIME_ENABLED=true`; require no retries/skips.** The browser must show the persisted initiative after reload and its WhyChanged receipt, then show dismissal/correction durability.
- [ ] **Step 8: Ruff/typecheck/diff check; commit `test(nur): prove Prime P1 self-starting continuity`.**

---

### Task 10: Prime fail-closed acceptance runner and P1 closure

**Files:**
- Create: `infra/scripts/nur-prime-gate.sh`
- Modify: `docs/superpowers/plans/2026-09-04-prime-initiative-runtime-p1.md` only to mark completed tasks after evidence exists.

**Interfaces:**
- Consumes: all P1 tests plus frozen `infra/scripts/nur-bplus-gate.sh`.
- Produces: one no-selector P1 release command that exits non-zero for missing, skipped or failed proof.

- [ ] **Step 1: Write the runner with named P00–P09 gates and `set -euo pipefail`.**
Gate meanings are fixed for P1:

```text
P00  repo truth: required Prime paths, shell syntax, exactly one Alembic head, git diff --check
P01  typed contracts + mind_initiatives schema/FORCE-RLS/roundtrip
P02  deterministic detector + dedupe/version/policy service
P03  scheduled owner-ID dispatch + duplicate-delivery idempotency
P04  UnifiedState projection + typed owner API + Agency proposal/no-execution proof
P05  full Prime P1 backend E2E + existing Jarvis continuity
P06  Prime V197 unit/typecheck + live Chromium Prime E2E, zero retries/skips
P07  Prime source/security guards + generic RLS/migration suites + secret scan
P08  full API suite + full web unit suite + production build + V197 integrity
P09  frozen prerequisite: `bash infra/scripts/nur-bplus-gate.sh` with no selector
```

- [ ] **Step 2: Make the runner reject unknown gate names and report every requested PASS/FAIL.** A selected gate that cannot run is failure; no `SKIP`, `PASS-CANDIDATE`, or external-environment exemption is accepted.
- [ ] **Step 3: P06 must self-provision a fresh role-split DB using the existing pytest database fixture pattern, unique Redis namespace, isolated API/web ports, `NUR_PRIME_ENABLED=true`, canonical B+ flags, official demo seed, Chromium `--workers=1 --retries=0`, and cleanup in `finally`.** Celery behavior that needs a worker is tested in backend integration; browser proof must not depend on a developer's already-running `:8000` stack.
- [ ] **Step 4: Run each P00–P09 individually once; fix real failures at root cause.**
- [ ] **Step 5: Run `bash infra/scripts/nur-prime-gate.sh` with no selector from a clean candidate state and require `Prime P1 GATE PASS: 10/10`, exit 0.**
- [ ] **Step 6: Update this plan's checkboxes/closure receipt with exact command totals only after Step 5.** Include base/head SHA, migration head, focused totals, full API/web totals, Prime browser count, B+ 16/16 result, known warnings and rollback note.
- [ ] **Step 7: Stage only P1 files + this plan; explicitly verify `docs/NUR_OMEGA_A_VS_B_DECISION.html` remains untracked/uncommitted unless separately requested.**
- [ ] **Step 8: Run `git diff --cached --check`, commit `feat(nur): ship Prime P1 self-starting initiative runtime`, push `feat/nur-bplus-v0.1`, and require exact local SHA = remote SHA.**
- [ ] **Step 9: Post-commit run `nur-prime-gate.sh P00 P05 P06` to prove committed baseline, core continuity and owner-visible surface without modifying code.**

---
## Implementation Order and Non-Negotiable Review Checkpoints

Tasks execute strictly 1 → 10. Do not parallel-edit the same worktree. Each task's commit must be independently green before the next task begins; later tasks may amend earlier interfaces only through a reviewed plan amendment if the current repository makes the specified interface impossible.

Before every commit:

```bash
git status --short
git diff --check
cd apps/api && .venv/bin/ruff check <task-python-files>
```

For web tasks also run:

```bash
cd apps/web
npm run typecheck
npm run test -- --run <task-vitest-files>
```

Release evidence must distinguish focused proof from full acceptance. A focused PASS never substitutes for P09 frozen B+ acceptance or the no-selector Prime runner.

## P1 Done Definition

P1 is done only when one persisted contradicted prediction can wake Prime through the scheduled owner job with zero Talk prompts, create one exact-scope initiative backed by real claim-version/prediction/outcome refs, survive a new DB session and duplicate delivery without duplication, revise on material evidence, disappear/supersede after typed owner correction, enter later UnifiedCognitiveState/V197 as the same initiative/version, and still produce zero external tool effects.

A release is rejected if any test shows Prime can widen scope, invent evidence, forge owner confirmation, mutate AgentPolicy/capabilities, call a broker/handler directly, auto-start an external workflow, persist raw reasoning, or pass while a required integration proof is skipped.

P2 internal autonomy, P3 pre-authorized reversible execution, P4 long-horizon objectives and P5 adaptive autonomy are explicitly outside this plan. They require separate reviewed plans after P1 is remote-backed and `nur-prime-gate.sh` is green.
