# NUR Current Completion - Final Closure Candidate

Refreshed 2026-08-23 from the actual `am-selenephos/NUR---Latest`
completion worktree. This supersedes the pre-closure 46.3% strict / 70.1%
weighted snapshot previously stored at this path.

## Source Truth

```text
repository: am-selenephos/NUR---Latest
base branch: main
completion branch: codex/nur-final-closure-20260820
pre-closure branch SHA: 5ac83100a4cd4cc52cea9af81fc938d1b308003f
draft PR: #5
pre-closure exact-head CI: run 32608012219, SUCCESS
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
| VERIFIED | H: Today, Talk, Journal, Systems, Orbit, Map, Timeline, Insights, Agents, Memory, Projects, Capsules, Research, Community, Billing, Notifications | 16 | Production-origin two-owner lifecycle, reload, denial, error and mobile/a11y route matrix |
| PARTIAL | H: Plan | 1 | Durable Plan lifecycle is real-stack green; one founder-visible `plan.direction` control remains honestly disabled pending the later approved UI integration |
| PARTIAL | H: Localization | 1 | Locale persistence, fallback and RTL behavior are implemented; zero-raw-string extraction enforcement and independent human language review remain |
| VERIFIED | I1-I7 | 7 | Forced RLS, mutation security, replay/injection defenses, Actions hardening, branch protection and SHA-bound SBOM gates |
| VERIFIED | J1-J5, J7-J9 | 8 | Cold boot, DR, crash recovery, release gate, browser matrix, performance/a11y, soak and fresh artifact |
| EXTERNAL_BLOCKED | J6 | 1 | Approved server-side live AI credential and eligible model are unavailable; deterministic mode is explicitly non-production |
| EXTERNAL_BLOCKED | J10 | 1 | Requires an independent reviewer; this implementation pass cannot self-approve |
| VERIFIED | K1, K6 | 2 | Draft PR #5 and repository rename/rollback runbook |
| PARTIAL | K2 | 1 | Becomes verified only after GitHub Actions succeeds on the exact pushed candidate commit |
| FOUNDER_DECISION | K3, K4, K5 | 3 | Merge, main-branch CI and annotated release tag are intentionally not performed here |
| SUPERSEDED | A3 | 1 | The dedicated closure worktree is the documented canonical equivalent |

Audit arithmetic before exact-head CI:

```text
TOTAL=82
VERIFIED=73
PARTIAL=3
EXTERNAL_BLOCKED=2
FOUNDER_DECISION=3
SUPERSEDED=1
STRICT=(73+1)/82=90.2%
WEIGHTED=(73+1+(3*0.5))/82=92.1%
NOT_FULLY_CLOSED=8/82
```

When K2 is green on the exact pushed commit, without changing any other row:

```text
VERIFIED=74
PARTIAL=2
EXTERNAL_BLOCKED=2
FOUNDER_DECISION=3
SUPERSEDED=1
STRICT=(74+1)/82=91.5%
WEIGHTED=(74+1+(2*0.5))/82=92.7%
NOT_FULLY_CLOSED=7/82
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

## Remaining Product Work

Internally solvable before a literal `NUR_FULL_PASS`:

1. Integrate the founder-approved replacement UI later and resolve the three
   currently honest-disabled visible controls: `plan.direction`,
   `ritual.control`, and `voice.composer`, without redesigning canonical V197
   during this backend closure.
2. Add and enforce zero-raw-string localization extraction, then obtain human
   locale review for supported languages.

Externally gated release evidence:

1. Approved live OpenAI credential/model and real provider smoke.
2. Transactional email sender/bounce callback, merchant billing sandbox,
   push/email provider, lawful research provider/licence, and production-like
   staging/object-storage receipts where those deployments are intended.
3. Independent reviewer decision.

Founder-only promotion:

1. Merge PR #5.
2. Verify the merged `main` SHA.
3. Create an annotated release tag when approved.

Current candidate verdict: `NUR_PARTIAL`. After the two internal partials are
closed, the honest pre-provider verdict can become
`NUR_INTERNAL_COMPLETE_EXTERNAL_BLOCKED`; it cannot become `NUR_FULL_PASS`
without the external and founder gates above.
