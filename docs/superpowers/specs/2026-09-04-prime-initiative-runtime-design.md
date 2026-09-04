# Prime Initiative Runtime — Phase 2 Design

**Status:** Approved design, implementation not started
**Date:** 2026-09-04
**Repository:** NUR B+ unified cognitive architecture
**Design base:** `feat/nur-bplus-v0.1` at `6d841c0`

## 1. Purpose

Prime is NUR's self-starting initiative layer. It does not create a second Brain, second Mind, second memory system, second Omega, second workflow engine, or a parallel authority model.

Prime composes the organs already proven by the B+ spine so that NUR can notice meaningful state changes without an owner prompt, decide whether they matter, form a governed next move, and carry that initiative into later Talk or Agency flows with continuity.

The architectural objective is:

```text
responsive cognition
→ persistent initiative
→ internal autonomy
→ pre-authorized reversible execution
→ long-horizon governed operation
```

The first implementation slice stops at proposal-first initiative. It must prove self-starting continuity before external autonomous execution is enabled.

## 2. Repository truths Prime must preserve

Prime is an orchestration layer over existing canonical boundaries:

- Mind owns identity, scope, attention, durable owner state, review strategy and WhyChanged.
- `UnifiedCognitiveState` is the one scoped per-turn cognitive carrier.
- Brain owns provider-backed cognition, planning, research, simulation and typed output.
- Omega owns canonical epistemic state, contradictions, predictions and evidence-linked change.
- Hardness owns bounded learning evaluation; learning cannot grant authority.
- Agency owns workflows, policy, approvals, tool authority, dispatch, execution, verification, rollback and recovery.
- Capability Broker selects an implementation only after Agency authorization.
- PostgreSQL + FORCE RLS remain durable owner truth; Redis/Celery remain coordination.
- V197 remains the experience shell and shows consequences, not internal database-shaped dashboards.

Existing `AgentPolicy` already provides an initiative authority vocabulary: initiative level, permitted tools, auto-run tools, risk ceiling, proposal quota, cooldown, quiet hours and daily budget. Prime must reuse this policy rather than inventing a second autonomy policy.

Existing Agency recovery, fencing and idempotency remain authoritative if a Prime initiative later becomes a workflow.

## 3. Non-goals

The first Prime release will not:

- execute external side effects automatically;
- widen owner policy, capabilities or approval state;
- create a new provider stack or direct model API path;
- persist hidden chain-of-thought;
- create a parallel memory, belief, prediction, contradiction or outcome ledger;
- infer owner authority from model confidence;
- treat activity, generated prose, or a proposed plan as completed work;
- add a new generic UI shell for “agent logs”;
- enable unrestricted recursive self-modification or policy mutation.

## 4. Runtime model

Prime has one core and three operating modes.

```text
Events / Beat / Talk
        ↓
ScopeEnvelope + UnifiedCognitiveState
        ↓
Opportunity Detector
        ↓
Initiative Candidate
        ↓
Planner / Simulator / Researcher as needed
        ↓
Review Strategy + deterministic validation
        ↓
Initiative Decision
        ↓
Talk projection OR Agency proposal
        ↓
Outcome / correction / evidence
        ↓
Omega + Hardness + next Prime cycle
```

### 4.1 Ambient mode

Triggered without an owner message by bounded scheduled or durable events. It notices work that may deserve attention and creates or updates an initiative. It does not receive durable action authority merely because it woke itself.

### 4.2 Interactive mode

Talk consumes the same open initiative state through `UnifiedCognitiveState`. Prime does not run a separate chat planner. The owner can see that NUR already noticed something, ask why, correct it, dismiss it, or turn it into a governed action.

### 4.3 Execution mode

A Prime decision may compile a workflow only through the existing Agency path. The first release may create a proposal but may not start external execution automatically. Later releases may use existing `AgentPolicy.auto_run_tools` for explicitly pre-authorized reversible actions; no new auto-run policy exists in Prime.

## 5. Trigger model

Prime accepts typed triggers, never arbitrary background prose.

Initial trigger classes:

- `PREDICTION_RESOLVED`
- `CONTRADICTION_OPENED`
- `CLAIM_VERSION_CHANGED`
- `OUTCOME_RECORDED`
- `WORKFLOW_FAILED_OR_STALLED`
- `GOAL_STALLED_OR_DUE`
- `LEARNING_EVALUATION_COMPLETED`
- `OWNER_CORRECTION`
- `SCHEDULED_REVIEW`
- `TALK_CONTEXT_REFRESH`

Scheduled discovery follows the existing safe pattern: Beat discovers owner IDs only; private owner state is loaded only after request/worker RLS context is set.

Event-driven triggers carry canonical IDs, not private payload dumps. The runtime re-reads the owning records inside the scoped transaction before making a decision.
## 6. Core contracts

Prime is implemented inside the Mind boundary, not as a new top-level plane. The product name may remain “Prime”; the code boundary should be an initiative runtime under `app/mind`.

### 6.1 OpportunitySignal

Required fields:

```text
signal_id
owner_user_id
scope_id
trigger_kind
trigger_ref
subject_ref
observed_at
evidence_refs
source_versions
signal_fingerprint
```

A signal is a scoped observation that something may deserve initiative. It has no recommendation and no authority.

### 6.2 InitiativeCandidate

Required fields:

```text
initiative_id / candidate_id
owner_user_id
scope envelope reference
task_class
objective
reason_code
priority_class
evidence_refs
counter_evidence_refs
uncertainties
missing_information
expected_benefit
expiry
policy_snapshot_version
review_strategy_id
candidate_version
```

`priority_class` is ordinal and auditable (`P0`–`P4`), not a model-invented precision score. Code enforces hard priority floors/ceilings for security, owner correction, deadlines and blocked authority.

### 6.3 InitiativeDecision

Disposition is one of:

```text
DISMISS
DEFER
ASK_OWNER
PROPOSE_AGENCY
SURFACE_IN_TALK
```

The decision stores concise reason codes, evidence IDs, review verdict, policy version and WhyChanged lineage. It never stores hidden reasoning.

The first release permits `DISMISS`, `DEFER`, `ASK_OWNER`, `SURFACE_IN_TALK`, and proposal creation. `PROPOSE_AGENCY` may persist a plan proposal but may not auto-start external execution.
## 7. Persistence and source-of-truth rules

Prime needs one minimal durable object: an initiative ledger. It does not need its own event, memory, prediction or workflow database.

Proposed canonical table: `mind_initiatives`.

Minimum fields:

```text
id, owner_user_id
orbit_id, project_id, capsule_id, community_id
trigger_kind, trigger_ref, subject_ref
dedupe_key, evidence_digest, candidate_version
status, disposition, task_class, priority_class
objective, reason_code
scope_snapshot, evidence_refs, counter_evidence_refs
policy_version, review_strategy_id, review_verdict
expires_at, deferred_until, last_seen_at
workflow_id nullable
created_at, updated_at
```

Owner-specific RLS is ENABLE + FORCE. Cross-owner denial uses the same real `nur_app` role matrix as the B+ tables.

Initiative change history uses the existing WhyChanged service. Operational model/provider details remain in existing `ModelRun`, `ModelRunSource`, Brain trace and cognitive event records.

If an initiative becomes a durable workflow, Agency owns execution state. `mind_initiatives.workflow_id` is a reference, never a duplicated workflow state machine.
## 8. Dedupe, continuity and material change

Prime must not spam the owner or create a new initiative every time Beat re-observes the same unresolved state.

A stable `dedupe_key` is derived from:

```text
owner + scope identity
trigger class
subject/canonical entity
relevant claim/prediction/workflow/goal identity
initiative task class
```

The current evidence set produces a separate `evidence_digest`.

Rules:

1. Same dedupe key + same evidence digest → idempotent no-op; only `last_seen_at` may advance.
2. Same key + materially changed evidence → increment `candidate_version`, re-evaluate, and append WhyChanged.
3. Same key + policy/review version change → re-evaluate before any new proposal.
4. Terminal initiative + unchanged evidence → stay terminal until expiry/reset condition.
5. Contradicting owner correction supersedes the old candidate immediately.
6. One open initiative per owner/scope/dedupe key is enforced transactionally.

Restarts therefore resume from persisted initiative state rather than replaying model decisions from scratch.

## 9. Opportunity detection

Detection is two-stage so model creativity cannot manufacture work from nothing.
### 9.1 Deterministic signal formation

Code identifies canonical conditions that are eligible for review, for example:

- an open contradiction with owner impact;
- a falsified prediction attached to a still-active recommendation;
- a failed/stalled workflow with retry or revision state;
- a goal or scheduled obligation crossing a defined deadline;
- a material claim version change used by an open project;
- a learning evaluation that changes an approved routing/retrieval candidate;
- an owner correction that invalidates an open initiative.

A detector may abstain. Absence of a signal is not evidence that no problem exists.

### 9.2 Cognitive evaluation

Only after deterministic eligibility may Brain help classify or formulate the next move. It receives one scoped `UnifiedCognitiveState`, the trigger, evidence refs, current owner policy snapshot, budget and required output schema.

Planner/Researcher/Simulator are specialists behind the existing Brain/Conductor boundary. Prime never calls providers directly.

Every model-produced evidence ref must already exist in the packet. Invented refs, widened scope, unsupported capabilities or fake completion are deterministic validation failures.
## 10. Authority ladder and rollout semantics

Prime reuses the existing `InitiativeLevel` order rather than defining a competing autonomy enum.

```text
OFF        → no autonomous initiative processing
SUGGEST    → notice and surface; read-only cognition may be evaluated
PREPARE    → prepare private drafts/proposals but do not externally act
INTERNAL   → later phase may perform explicitly permitted durable-private actions
CONNECTED  → prepare connected/external actions and pause for required approval
DELEGATED  → reserved for future narrower delegation; no extra power until code explicitly ships it
```

Existing Agency policy remains the final authority. `permitted_tools` answers whether a tool may appear at all; `auto_run_tools` separately answers whether a permitted tool may execute unattended. Prime cannot edit either list.

The first Prime implementation uses only initiative detection, cognitive evaluation and governed surfacing/proposal behavior. Even if an owner policy is already more permissive, Phase P1 does not introduce a new path that auto-starts external work.

Later phases may rely on the existing Agency auto-run ceilings and risk classes. R3 external mutations still require the current Agency policy/approval behavior; R4 stays disabled until an explicit separately reviewed code change enables it.

## 11. Decision pipeline

Every initiative follows this order:

```text
trigger re-read under RLS
→ ScopeEnvelope resolution
→ UnifiedCognitiveState freeze
→ deterministic eligibility + dedupe
→ policy quota/cooldown/quiet-hours/budget check
→ optional bounded Brain specialist work
→ deterministic evidence/capability validation
→ ReviewStrategy
→ InitiativeDecision persistence
→ surface or Agency proposal handoff
```
## 12. Agency handoff

`PROPOSE_AGENCY` is a compile request, not execution authority.

Prime converts the validated initiative into the existing workflow proposal/create contract and calls the existing Agency compiler/service. Required rules:

- tool keys must already exist and be bound;
- requested capabilities are derived from registered tool contracts;
- current owner policy is loaded at compile/start time, not trusted from the initiative snapshot;
- argument digests and approvals remain Agency-owned;
- proposal compile failure produces a blocked initiative decision, never success;
- the workflow records a Prime initiative trigger/reference once that trigger kind is supported;
- no tool executes in the initiative transaction;
- workflow outcome is linked back as evidence and can resolve/revise the initiative.

Prime never copies Agency step state into its own ledger. Owner cancellation/revocation continues to operate through Agency.

## 13. Interactive continuity

Open initiatives are projected into `UnifiedCognitiveState` as a bounded semantic family. They carry only owner-visible/governed fields:

```text
initiative id and version
objective / reason code
priority class
status / disposition
supporting evidence refs
uncertainty / missing owner input
linked workflow id if any
WhyChanged reference
```

Talk may mention or act on these projections, but it cannot mutate the initiative directly from generated prose. Owner actions use typed service/API operations.
## 14. Background scheduling and concurrency

Prime reuses Celery Beat and the existing owner-ID discovery pattern.

A scheduled pass:

```text
Beat task
→ bounded active owner IDs only
→ one owner job per ID
→ set owner RLS context
→ inspect eligible canonical signals
→ upsert/evaluate initiative under transactional dedupe
→ commit
```

Private source text never rides in Beat/Celery messages.

Concurrency rules:

- advisory/row locking or a uniqueness constraint protects one open initiative per dedupe key;
- repeated event delivery is idempotent;
- candidate version changes only on material evidence/policy changes;
- two workers evaluating the same version cannot both publish different current decisions;
- stale evaluations fail their guarded update and are discarded/retried from current state;
- Agency execution keeps its own existing lease/fencing model after handoff.

The runtime has bounded owner/candidate limits per pass. Existing policy `max_proposals_per_day`, cooldown, quiet hours and daily budget are enforced before surfacing repeated proactive work.

## 15. Failure and recovery

Provider, retrieval or review failure never falls through into action.
Failure dispositions are explicit:

```text
TRANSIENT_INPUT_FAILURE → defer and retry within bounded policy
NO_ELIGIBLE_ROUTE       → defer or ask owner; no silent incompatible fallback
STALE_STATE              → discard stale decision and re-read current state
INSUFFICIENT_EVIDENCE    → defer / ask owner
POLICY_BLOCK             → persist blocked reason; do not create approval authority
BUDGET_OR_QUIET_HOURS    → defer until allowed window
SCHEMA_OR_VALIDATION     → reject candidate version and record failure class
```

A restart resumes from persisted `mind_initiatives` and current canonical evidence. It does not require reconstructing a hidden model conversation.

If an initiative has already produced an Agency workflow, Prime reads the linked workflow/outcome state; it never reissues the workflow because its own worker restarted.

## 16. Privacy, security and authority invariants

The following are release-blocking:

1. Scope is resolved before Prime reads owner state.
2. Scope may narrow but never widen inside Prime.
3. Project/Capsule/Community data follows the same fail-closed support rules as UnifiedCognitiveState.
4. Owner confirmation/authority cannot be created by a Prime model result.
5. Learning/Hardness may change strategy candidates but cannot change `AgentPolicy` or capabilities.
6. Prime cannot create a tool approval row directly.
7. Prime cannot call a tool handler or capability adapter directly.
8. External execution must pass Agency → capability broker → verified receipt.
9. Background jobs carry IDs, not private context dumps.
10. No hidden chain-of-thought is persisted or exposed; only concise decision summaries, reason codes and WhyChanged receipts.
## 17. Observability and owner-visible behavior

Prime traces reuse canonical lineage IDs and add only initiative identity/version where needed.

Operational records may include:

```text
trigger kind/ref
scope id
initiative id/version/dedupe key hash
selected task class / review strategy
model run id / route decision id
policy version and disposition
latency, token/cost counters
stop/failure reason
linked workflow/outcome IDs
```

Logs do not contain raw private context by default.

V197 should expose Prime through existing semantic homes, not a new agent dashboard. Examples:

- Talk: “NUR noticed…” / next-move card with evidence and correction affordance;
- Insights: governed initiative derived from an epistemic change;
- Timeline: due/deferred initiative where time is central;
- Map: initiative attached to an existing entity/goal/workflow relation;
- approvals/workflows: existing Agency surfaces after handoff;
- WhyChanged: what new evidence or owner correction changed the initiative.

Owner dismissal/correction is durable evidence that affects future dedupe and ranking; Prime must not repeatedly resurrect a dismissed initiative without material new evidence.
## 18. Phase P1 — first implementation slice

P1 is deliberately proposal-first. It proves self-starting judgement and continuity before granting new actuator power.

The end-to-end acceptance scenario is:

```text
1. Strategy A exists with a persisted prediction.
2. No owner Talk prompt is sent.
3. A contradictory outcome is recorded.
4. Canonical Omega updates/version lineage.
5. Prime wakes from the durable trigger/scheduled pass.
6. It resolves the correct owner + scope and freezes UnifiedCognitiveState.
7. It detects the material falsification and creates one initiative.
8. The initiative cites claim-version, prediction and outcome evidence IDs.
9. Its decision proposes/surfaces Strategy B or asks for the missing owner decision.
10. A repeated pass creates no duplicate initiative.
11. Restart/retry preserves the same current initiative/version.
12. Later Talk sees the initiative and its WhyChanged receipt.
```

No external tool invocation is allowed in this scenario.

P1 also handles at least one stalled workflow signal and one owner-correction supersession signal so the detector is not hardcoded to predictions alone.

## 19. P1 release gates

P1 is not complete unless tests prove all of the following:
- repeated identical observation is idempotent and does not spam proposals;
- materially changed evidence versions/revises the existing initiative;
- owner correction can supersede or close it;
- restart/retry produces the same durable state;
- cross-owner and cross-scope reads/writes fail under the real app role;
- owner-confirmed authority cannot be forged;
- learning cannot widen Agency policy or capabilities;
- no Prime path calls a handler/broker/tool directly;
- no external action auto-starts in P1;
- quota, cooldown, quiet hours and budget are enforced from current AgentPolicy;
- failed provider/reviewer produces defer/block, never action;
- evidence refs are real and verifier-compatible;
- Talk projection and WhyChanged survive reload;
- no raw CoT/reasoning sentinel reaches persistence or DOM;
- all existing B00–B15 B+ gates remain green.

Tests use TDD: first prove the missing behavior RED, then implement the minimum architecture needed to make the invariant GREEN.

## 20. Development phases after P1

### P2 — Internal autonomy

Prime may automatically perform bounded cognition that has no external side effect: retrieve scoped evidence, run research planning with authorized read capability, compare alternatives, simulate plans, refresh predictions, and prepare private drafts. Every operation remains budgeted, traced and scope-bound.

P2 maps primarily to existing `SUGGEST` / `PREPARE` semantics. Read tools still require registered capabilities; “internal” does not mean bypassing the broker or privacy policy.

### P3 — Pre-authorized reversible action

Use the existing AgentPolicy + Agency auto-run path for explicitly permitted low-risk operations. Prime does not gain a new execution mechanism. Reversibility, verification receipts, rollback and risk ceilings are mandatory.
### P4 — Long-horizon operation

Prime may maintain multi-step objectives across interruptions and restarts. It uses persisted initiatives plus Agency workflows, not a hidden conversation transcript, to know what remains. Planning is periodically revalidated against current evidence, policy, cost and scope before continuing.

Required additions include explicit objective progress, interruption/resume reasons, replanning criteria, bounded specialist routing, stale-plan detection and stop conditions. A workflow outcome can change the initiative plan rather than forcing completion of an obsolete DAG.

### P5 — Adaptive autonomy

Hardness may evaluate improvements to retrieval weights, context recipes, prompt rules, planning heuristics and router policy using frozen replay/evaluation. Accepted changes may improve Prime judgement, but the learning plane still cannot grant tool capability, change owner policy, confirm owner truth, or raise risk ceilings.

Authority therefore remains orthogonal to intelligence: a smarter Prime is not automatically a more powerful Prime.

## 21. Recommended code boundaries

Prime should be a small Mind subsystem, not a giant package tree:

```text
app/mind/initiative_contracts.py   typed signal/candidate/decision projections
app/mind/initiative_detector.py    deterministic eligible-signal formation
app/mind/initiative_service.py     dedupe/version/review/decision orchestration
app/mind/initiative_tasks.py       Beat/event owner-ID dispatch and worker entry
app/models/initiative.py           minimal mind_initiatives ORM
```

Existing modules are called rather than copied: `scope`, `unified_state`, `review_strategy`, Brain cognition/specialists, Omega services, Hardness, AgentPolicy/Agency lifecycle, capability broker, WhyChanged and V197 bridge projections.

A forward migration adds only the initiative ledger/RLS/indexes required by P1. No speculative P2–P5 tables are created early.
## 22. Rejected architectures

### Separate always-on Prime daemon with its own memory/planner

Rejected because it duplicates Mind/Brain state, creates synchronization problems and makes authority ambiguous. Background execution is already available through Celery Beat/workers.

### Talk-only proactive planner

Rejected as the primary architecture because NUR would still sleep without an owner turn and proactive state would become chat-local. Interactive mode remains a projection of the shared initiative ledger instead.

### Direct Agency-first autonomous worker

Rejected for initial rollout because it couples judgement errors immediately to side effects and makes failures harder to localize. Agency remains the eventual actuator, but self-starting initiative is validated before new unattended execution paths are enabled.

### Model-only opportunity discovery

Rejected because a language model could manufacture obligations or urgency without a canonical trigger. Deterministic eligible signals anchor every P1 initiative; model cognition may evaluate/formulate but not invent the underlying event identity.

## 23. Success definition

Prime P1 succeeds when NUR can be idle, receive a material canonical state change, wake without a Talk prompt, create exactly one evidence-backed scoped initiative, preserve it across restart, revise it when evidence changes, expose it coherently in the next owner interaction, and remain unable to forge authority or execute an external side effect.

The architecture is considered wrong if achieving that behavior requires a second source of truth for cognition, memory, workflows, policy, predictions or execution.

## 24. Locked design decisions

- Prime is a Mind-owned initiative orchestrator, not a new architectural plane.
- Ambient, Interactive and Execution are modes of one runtime, not three systems.
- P1 is proposal-first and introduces no automatic external action.
- Existing AgentPolicy is the only owner autonomy/initiative policy.
- Existing Agency is the only durable execution authority.
- Existing UnifiedCognitiveState is the cognitive carrier; Prime does not assemble a shadow context stack.
- Existing Omega/WhyChanged/evidence lineage determines what changed and why.
- One minimal `mind_initiatives` ledger is allowed because initiative lifecycle/dedupe cannot be truthfully represented as a workflow or ephemeral model run.
- Initiative history is versioned through material evidence/policy change and existing WhyChanged lineage.
- P2–P5 extend the same runtime gradually; they do not replace P1 architecture.
- Capability or authority widening always requires explicit owner/policy governance, never learning output.
- V197 surfaces Prime through existing semantic homes rather than a new dashboard.

There are no unresolved design placeholders in this specification. Implementation planning must preserve these decisions unless repository inspection proves a direct contradiction; any such contradiction requires an explicit design amendment before code changes.

## 25. Acceptance gate topology

The existing `infra/scripts/nur-bplus-gate.sh` and its B00–B15 meanings are frozen historical acceptance for the completed B+ spine. Prime must not silently redefine those gates.

Phase 2 gets a separate fail-closed acceptance runner (recommended name: `infra/scripts/nur-prime-gate.sh`). Its P1 gate set must include the new initiative invariants and invoke the required B+ prerequisite gates, including full B+ acceptance before Prime is declared releasable.

A Prime gate cannot pass by marking unavailable integration evidence as skipped. Missing required proof is failure, consistent with B+ acceptance discipline.
