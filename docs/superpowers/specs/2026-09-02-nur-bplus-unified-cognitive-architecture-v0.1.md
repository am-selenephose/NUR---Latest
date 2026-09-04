# NUR B+ Unified Cognitive Architecture v0.1

**Approved:** 2026-09-02  
**Baseline commit:** `caf58863e93b47b4c148c11d86efdd1245354ef1`  
**Status:** Approved architecture; implementation not started.

## Product Thesis

NUR must feel like one continuous Jarvis-like intelligence to the owner while remaining internally modular, inspectable, reversible, and truthful about capability. The product experience is one NUR; the engineering architecture is a set of organs with hard ownership contracts.

NUR must carry a world forward: remember events, distinguish observation from inference, maintain evidence-backed beliefs, register predictions, observe outcomes, revise confidence, explain state transitions, learn from verified discrepancies, and behave differently later because of persisted tested experience.

## Non-Negotiable Laws

1. One canonical epistemic reality. Competing durable truth systems are forbidden.
2. Raw chronology survives abstraction; summaries never overwrite source history.
3. Scope resolves before retrieval, provider invocation, memory hydration, or tool access.
4. Epistemic status and authority status are separate dimensions.
5. Important canonical claim changes are versioned and emit append-only WhyChanged receipts.
6. Attention/retrieval is scope- and relevance-driven, not latest-N recency alone.
7. Predictions are testable, confidence-bearing, time-bounded when possible, outcome-resolved, and calibratable.
8. Contradictions are semantic candidates verified against normalized scope/time/entity facts; a model suggestion alone is not canonical contradiction truth.
9. Consolidation is idempotent, complete, replayable, and starvation-free.
10. Learning means evaluated behavioral change, not a row called learning.
11. Capability is not authority. Cognition cannot grant itself execution permission.
12. No silent expansion of RLS, credentials, tool permissions, sharing scope, or owner authority.
13. No raw chain-of-thought persistence or exposure. Persist structured claims, evidence, decisions, state transitions, evaluations, and receipts.
14. No false consciousness or sentience claims.
15. V197 presentation law, privacy/RLS, Capsule isolation, owner authority, and proven behavior remain regression gates.

## Unified Organ Model

```text
Identity Kernel
    -> Scope/Context Kernel
    -> Attention Kernel
    -> Memory Fabric + World Model + User/Self Model
    -> Omega Epistemic Core
    -> Cognitive Cortex
    -> Prediction/Simulation
    -> Planning
    -> Authority Kernel
    -> Agency/Execution
    -> Outcome/Evaluation
    -> Learning/Adaptation
    -> revised NUR state
```

The user sees one NUR. Internal organs communicate via typed contracts and may not seize another organ's durable ownership.

## Canonical Data Ownership

| Domain | Canonical owner | Existing substrate | B+ rule |
| --- | --- | --- | --- |
| Raw personal chronology | Event spine | `cognitive_events` | Immutable source history |
| Raw system/world chronology | Domain event spine | `domain_events` | Durable source history |
| Normalized observations | Omega | `omega_experiences` | Canonical observation layer |
| Epistemic propositions | Omega | `omega_claims` | Canonical durable belief/claim state |
| Evidence graph | Omega | `omega_evidence_edges` | Canonical claim evidence relations |
| Claim versions | Omega | new `omega_claim_versions` | Append-only snapshots |
| Change history | WhyChanged | `why_changed_records` | Canonical transition explanation ledger |
| Recall | Memory Fabric | `memories`, `memory_versions`, `memory_edges` | Projection/recall, not independent truth |
| Present beliefs | Mind | `Belief` DTO | Runtime projection from Omega |
| User model | Mind | `UserModelClaim` DTO | Runtime projection from Omega |
| Insights | Insights | `insights` + evidence tables | Interpretation/surfacing projection |
| Relational insights | Orbit world | `orbit_relational_insights` | Relationship-specific projection |
| Predictions | Omega semantics over cognition table | `predictions` | Canonical prediction ledger |
| Legacy Omega predictions | Compatibility | `omega_predictions` | Read/migration compatibility only |
| Learning signals/experiments | Hardness | `learning_*`, `training_experiments` | Canonical adaptation laboratory |
| Legacy Omega learning proposals | Compatibility/UI | `omega_learning_proposals` | Facade over Hardness after bridge |
| Authority + execution | Agency | `agent_*` | Canonical action/approval/effect history |
| Domain objects | Domain services | people/orbits/goals/projects/timeline/map/etc. | Own actual object state; Omega owns claims about them |

## Omega B+ Claim Contract

`omega_claims` remains the durable current-state row. B+ extends it rather than replacing it.

Required current-state fields:

```text
claim_text
claim_type
subject_ref
predicate
object_value
orbit_id / scope
valid_from / valid_until
epistemic_status
authority_status
confidence
uncertainty_kind
falsification_condition
support_count / contradiction_count
current_version
created_at / updated_at
```

Allowed epistemic states:

```text
OBSERVED
INFERRED
HYPOTHESIS
CONTESTED
CONTRADICTED
SUPERSEDED
RETIRED
```Allowed authority states:

```text
MODEL_PROPOSED
OWNER_STATED
OWNER_CONFIRMED
OWNER_CORRECTED
SYSTEM_MEASURED
RESEARCH_DERIVED
LEGACY_UNRESOLVED
```

Owner confirmation changes authority. It does not automatically rewrite epistemic state to `OBSERVED`.

`LEGACY_UNRESOLVED` is migration-only: use it when an old claim predates persisted authority provenance and no surviving evidence proves who established it. B+ must not fabricate owner/model authority during backfill. New canonical writes may not use this state.

## Claim Versioning

Every canonical mutation locks the claim row, increments `current_version`, writes `omega_claim_versions`, and writes `why_changed_records` in the same database transaction.

A version snapshot contains the complete owner-visible epistemic state necessary to reconstruct history, including confidence, scope, authority, uncertainty, falsifier, structured proposition fields, and evidence digest. No hidden reasoning is stored.

## Projection Law

`semantic_claims`, Mind Beliefs, UserModel claims, Memories, Insights, and relational insights may project canonical Omega state. They may not establish a competing durable truth source.

Compatibility migration uses dual-read/single-canonical-write:

```text
new write -> Omega canonical claim -> projection adapters -> legacy/read surfaces
legacy read -> projection/compatibility row
legacy write path -> redirected to canonical service before projection persistence
```

Existing tables are not dropped during B+ v0.1.## Scope and Attention

`ScopeEnvelope` is the required input to every cognitive retrieval contract. Orbit/project/capsule/community boundaries must be applied consistently across Omega, semantic context, memory, research, insights, and world refs.

Attention is a runtime frame. Durable persistence is limited to explicit owner controls such as pin, snooze, dismiss, or resolve.

Ranking features are explicit and auditable:

```text
query_relevance
scope_match
goal_relevance
contradiction_urgency
outcome_relevance
authority_weight
freshness
evidence_quality
owner_pin
correction_relevance
```

Recency alone can never dominate a clearly more relevant scoped item.

## Memory Fabric

Memory answers "what should NUR recall?" rather than "what is true?".

Supported projections remain:

```text
EPISODIC
SEMANTIC
PROCEDURAL
SOCIAL/RELATIONAL
SELF/META_COGNITIVE
GOAL
ADAPTIVE_INTERFACE
```Where a memory represents a proposition, it stores a link to the canonical Omega claim/version/evidence chain. Owner-authored episodic records may remain event-backed without requiring a semantic claim.

## World Model

B+ does not create a duplicate universal object table. Existing domain models continue to own actual state. Omega claims refer to typed domain refs such as:

```text
person:<uuid>
orbit:<uuid>
goal:<uuid>
project:<uuid>
timeline_event:<uuid>
system:<slug>
```

## Prediction Contract

The richer generic `predictions` table becomes canonical storage under Omega semantics. `omega_predictions` is migrated/bridged for compatibility.

Required prediction semantics:

```text
statement
expected_observation
metric
assumptions
confidence
horizon_days / review_by
falsification_condition
resolution_rule
outcome reference
resolution
prediction_error
learning
```

Calibration is computed only from resolved predictions with explicit confidence and resolution evidence.## Contradiction Contract

Contradiction detection is two-stage:

1. Candidate generation: normalized propositions + optional semantic model suggestion.
2. Verification: deterministic scope/time/entity compatibility, evidence validity, owner authority, and contradiction rule checks.

High-certainty verified contradictions may be persisted automatically. Ambiguous or high-sensitivity contradictions go to owner review. Model text alone cannot force canonical contradiction state.

## Consolidation Contract

Every candidate source event receives an ingestion receipt with a terminal or retryable status. Consolidation processes oldest eligible unseen source items first, not only newest N events.

Allowed receipt states:

```text
PROCESSED
IGNORED
RETRYABLE
QUARANTINED
INVALIDATED
```

A source event may not disappear silently. Replays must be idempotent.

## Learning Contract

Omega detects epistemic/behavioral learning signals. Hardness owns candidate selection, curricula, experiments, evaluation, and promotion proposals.

B+ v0.1 adds a real `POLICY_REPLAY` intervention for non-neural changes such as retrieval weights, context recipes, prompt rules, planning heuristics, and routing policies. SFT/RL remain explicitly non-production until a real trainer exists.

Promotion requires measured improvement on target fixtures plus passing privacy, scope, authority, Agency, and general-regression gates. No candidate can auto-promote a permission expansion.## Tool / Capability Broker

NUR calls stable capability contracts, never donor-specific APIs directly.

```text
NUR Agency -> Capability Broker -> Adapter -> External runtime/tool
```

Initial capability families:

```text
browser.navigate
browser.extract
research.fetch
worker.background
worker.code
app.read
app.write
model.run
```

Existing Agency registry remains the authority/risk contract owner. The broker selects implementation adapters behind registered capability keys.

Before a donor adapter is enabled, the donor audit records repository identity, commit, license, maintenance state, execution model, network/secrets behavior, risks, and one of: `USE`, `DONOR`, `REWRITE`, `QUARANTINE`, `KILL`.

## Execution Receipt Contract

`AgentToolCall` evolves into the canonical external-effect receipt by adding stable capability and adapter identity plus result/effect verification fields.

A receipt must be able to answer:

```text
who requested
which workflow/step
which capability
which adapter/version
which approval
input digest
result digest
external effects
artifact refs
cost/duration
verification verdict
rollback ref
trace id
```## Unified Runtime State

A transient `UnifiedCognitiveState` composes identity, scope, attention, canonical Omega projections, relevant memories, world refs, self/user models, capabilities, evidence, predictions, risks, and open contradictions for one cognitive turn.

It is not a new durable truth database.

## Compatibility Strategy

B+ is additive and staged:

1. Extend schema and create canonical services.
2. Add projection links/adapters.
3. Redirect write paths behind compatibility facades.
4. Move readers to canonical projections.
5. Compare canonical vs legacy outputs in shadow tests.
6. Disable independent legacy writes only after parity gates pass.
7. Drop/rename legacy storage only in a future separately approved migration.

## Acceptance Gates

- B00 Baseline: existing focused B+ suite remains green; full release gate remains green.
- B01 Single Truth: all durable claim writers resolve through canonical Omega service.
- B02 Scope: adversarial Orbit/Capsule/project tests prove zero context leakage.
- B03 Versioning: each canonical claim mutation atomically writes version + WhyChanged.
- B04 Authority: inference cannot self-promote to owner confirmation.
- B05 Retrieval: scoped attention beats recency baseline on fixed fixtures.
- B06 Memory: explicit versioned memory lifecycle/export remains intact.
- B07 Prediction: confidence, assumptions, horizon, metric, outcome and error are inspectable.
- B08 Calibration: resolved predictions generate reproducible calibration metrics.
- B09 Consolidation: 1,000+ mixed events process without starvation, loss, or duplicate effects.
- B10 Learning: candidate policy must beat baseline replay and pass critical gates.
- B11 No self-authority: learning cannot widen RLS/auth/secrets/tool permission.
- B12 Agency: consequential execution remains policy/approval bound.
- B13 Receipts: every brokered external effect creates a verifiable receipt.
- B14 V197: visual ownership and interaction regression suites remain green.
- B15 Continuity: an earlier prediction/outcome/correction changes persisted state and demonstrably changes a later NUR response with a valid WhyChanged explanation.## Jarvis Continuity Scenario

```text
Day 1: owner chooses Strategy A; NUR records a 0.75 prediction.
Day 7: outcome Y contradicts the prediction.
NUR resolves the prediction, records counter-evidence, revises claim confidence,
emits WhyChanged, and creates a bounded learning signal.
Day 8: owner asks the same class of question.
NUR does not repeat the old recommendation unless new evidence supports it.
When asked why, NUR returns the decision, prediction, outcome, claim version change,
current uncertainty, and learning receipt without exposing chain-of-thought.
```

This scenario is the final B+ v0.1 product gate.