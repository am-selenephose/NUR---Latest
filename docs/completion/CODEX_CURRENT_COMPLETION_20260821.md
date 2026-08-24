# NUR Current Completion - Final Closure Candidate

Refreshed 2026-08-24 from the actual `am-selenephos/NUR---Latest`
completion worktree. This supersedes the pre-closure 46.3% strict / 70.1%
weighted snapshot previously stored at this path.

## Source Truth

```text
repository: am-selenephos/NUR---Latest
base branch: main
completion branch: codex/nur-final-closure-20260820
pre-closure branch SHA: 5ac83100a4cd4cc52cea9af81fc938d1b308003f
draft PR: #5
last exact-head CI before this closure commit: SHA 34902deb90ff8bb07ba8a16ba50e8b4c4e27f06f, run 32644405657, SUCCESS
candidate identity: the commit containing this ledger
canonical V197 SHA-256: 397c302579472e60f5bd667546a96b6e3f262aa40bd932d10c1946e13b046dd2
migration head: 0061_pw_delivery_resilience
```

No final percentage is inferred from files, mocked browser responses, stale
receipts, or an earlier SHA. The final candidate must pass the complete local
gate and GitHub Actions on the exact pushed commit.

## Scoring Law

- `VERIFIED`: implemented and proven at the requirement-appropriate boundary.
- `PARTIAL`: meaningful implementation exists, but a specific internal proof or
  product behavior remains.
- `EXTERNAL_BLOCKED`: requires an unavailable approved provider or independent
  actor; provider success is never fabricated.
- `FOUNDER_DECISION`: protected release-state mutation requires founder action.
- `SUPERSEDED`: a stale literal path has a documented canonical equivalent.

Strict completion counts `VERIFIED + SUPERSEDED`. Weighted completion also
gives each `PARTIAL` one half point. External and founder rows receive zero.

## Exact 82-Task Reconciliation

The denominator remains the 82 top-level Addendum tasks:

```text
A=5, B=6, C=5, D=6, E=8, F=5, G=6, H=18, I=7, J=10, K=6
```

| Status | Exact task IDs | Count | Current proof or remaining boundary |
| --- | --- | ---: | --- |
| VERIFIED | A1, A2, A4, A5 | 4 | Current Git/PR/dependency/V197 truth and secret boundary |
| VERIFIED | B1-B6 | 6 | OpenAPI drift, gateway, retry, approval, Talk and capability contracts |
| VERIFIED | C1-C5 | 5 | Deterministic server Talk answer/replay/cancel plus real Agency proposal/approval/worker result |
| VERIFIED | D1-D6 | 6 | Canonical durable Mind authority, owner scope, manifests and budgets |
| VERIFIED | E1-E8 | 8 | Typed Brain, governed Research adapter and independent frozen evaluation corpus |
| VERIFIED | F1-F5 | 5 | Hydration, DAG limits, safe reducer, proposal V2 and UI-driven Plan/Agency lifecycle |
| VERIFIED | G1-G6 | 6 | Canonical append-only learning, WhyChanged, memory effects and held-out/shadow proof |
| VERIFIED | H: Today, Talk, Journal, Plan, Systems, Orbit, Map, Timeline, Insights, Agents, Memory, Projects, Capsules, Research, Community, Billing, Notifications | 17 | Production-origin two-owner lifecycle, reload, denial, error and mobile/a11y route matrix; the retired Plan direction placeholder is absent from runtime and registry |
| EXTERNAL_BLOCKED | H: Localization | 1 | Locale persistence, 35 complete fallback slots, RTL/Roman Urdu behavior, critical-copy post-hydration and AST extraction enforcement are green; native-language review requires independent human reviewers |
| VERIFIED | I1-I7 | 7 | Forced RLS, mutation security, replay/injection defenses, Actions hardening, branch protection and SHA-bound SBOM gates |
| VERIFIED | J1-J5, J7-J9 | 8 | Cold boot, DR, crash recovery, release gate, browser matrix, performance/a11y, soak and fresh artifact |
| EXTERNAL_BLOCKED | J6 | 1 | Approved server-side live AI credential and eligible model are unavailable; deterministic mode is explicitly non-production |
| EXTERNAL_BLOCKED | J10 | 1 | Requires an independent reviewer; this implementation pass cannot self-approve |
| VERIFIED | K1, K2, K6 | 3 | Draft PR #5, exact-head Actions proof and repository rename/rollback runbook; the commit containing this ledger must retain a green PR status-check rollup before final reporting |
| FOUNDER_DECISION | K3, K4, K5 | 3 | Merge, main-branch CI and annotated release tag are intentionally not performed here |
| SUPERSEDED | A3 | 1 | The dedicated closure worktree is the documented canonical equivalent |

Audit arithmetic after internally solvable closure:

```text
TOTAL=82
VERIFIED=75
PARTIAL=0
EXTERNAL_BLOCKED=3
FOUNDER_DECISION=3
SUPERSEDED=1
STRICT=(75+1)/82=92.7%
WEIGHTED=(75+1)/82=92.7%
NOT_FULLY_CLOSED=6/82
INTERNALLY_SOLVABLE_PARTIALS=0
```

## Closure Delivered In This Candidate

- Password-recovery delivery claims, lease expiry, bounded retries/backoff,
  deterministic Message-ID, failure/bounce receipts, migration `0061`, and
  regression coverage.
- A server-only deterministic AI provider for truthful non-production E2E,
  with a production hard-fail and optional deterministic delay fixture.
- V197 Talk proof through real SSE and persistence: answer, request replay,
  cancellation, reload and no duplicate thread/model run.
- Agency `APPROVE`, `EDIT` and `REJECT` real-stack proof, digest invalidation,
  append-only `WORKFLOW_CREATED -> PLAN_COMPILED -> STEP_AWAITING_APPROVAL`,
  worker execution and durable verified result.
- Billing checkout handoff through the real backend, no premature entitlement,
  webhook boundary proof, reload persistence and opener isolation.
- Capsule ten-cycle durability, Phase-H lifecycle, performance/accessibility,
  Chromium/WebKit mobile, worker/Beat/Redis crash recovery, DR restore and
  exact release-gate orchestration.
- Durable Plan mutation/reload/denial proof with the stale, removed direction
  placeholder purged from the machine-readable interaction registry.
- Centralized V197 navigation, language-control and critical-copy catalogs;
  post-hydration Roman Urdu/RTL application; complete fallback keys for all 35
  declared locale slots; and an AST extraction gate wired into G11.

## Remaining Product Work

Internally solvable rows in the exact 82-task closure ledger: **none**.

The founder-approved replacement UI remains an explicitly later integration,
not a hidden blocker in this backend/full-stack closure. The retired voice,
ritual and Plan direction placeholders are absent from runtime and registry.
This candidate does not invent behavior or redesign canonical V197 to make
them appear complete.

Externally gated release evidence, grouped by the three ledger rows:

1. `H: Localization`: independent native-language review for the polished
   locale tier.
2. `J6`: approved live OpenAI credential/model and real provider smoke, plus
   transactional email sender/bounce callback, merchant billing sandbox,
   push/email provider, lawful research provider/licence, and production-like
   staging/object-storage receipts where those deployments are intended.
3. `J10`: independent reviewer decision.

Founder-only promotion:

1. Merge PR #5.
2. Verify the merged `main` SHA.
3. Create an annotated release tag when approved.

Current candidate verdict: `NUR_INTERNAL_COMPLETE_EXTERNAL_BLOCKED`. It cannot
become `NUR_FULL_PASS` without the external and founder gates above, and this
implementation pass does not fabricate those receipts.
