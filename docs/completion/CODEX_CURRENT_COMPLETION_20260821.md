# NUR Current Completion — Correction-Pass Closure Ledger

**Evidence refreshed:** 2026-08-28 (user timezone)

This ledger is recomputed from the actual repository state on `codex/nur-final-closure-20260820`, not from the historical correction-pass prompt or stale candidate-era receipts.

## Source Truth

```text
repository: am-selenephos/NUR---Latest
base branch: main
completion branch: codex/nur-final-closure-20260820
latest green implementation head before this documentation synchronization: cb5ec5c93d1ded3be203b46eee9354074647f418
draft PR: #5
exact-head CI: SHA cb5ec5c93d1ded3be203b46eee9354074647f418, run 33072481729, SUCCESS
current PR state: OPEN, DRAFT, UNMERGED
```

The latest exact-head readiness run on the implementation head passed with both `api` and `web-and-security` successful. The web job executed the representative localization command and passed 9/9 tests. The full local API regression also passed 1115/1115 tests. The documentation synchronization is evidence-only; no merge or tag was performed.

## Scoring Law

`VERIFIED` means implemented and proven at the requirement-appropriate boundary. `PARTIAL` means meaningful implementation exists but a specific internal proof or product behavior remains. `EXTERNAL_BLOCKED` means the remaining gate requires an unavailable approved provider or an independent human actor; provider success or human review is never fabricated. `FOUNDER_DECISION` means protected release-state mutation requires founder action. `SUPERSEDED` means a stale literal path has a documented canonical equivalent.

Strict completion counts `VERIFIED + SUPERSEDED`. Weighted completion gives each `PARTIAL` one half point; external and founder rows receive zero.

## Exact 82-Task Reconciliation

The denominator remains the 82 top-level Addendum tasks:

```text
A=5, B=6, C=5, D=6, E=8, F=5, G=6, H=18, I=7, J=10, K=6
```

| Status | Exact task IDs | Count | Current proof or remaining boundary |
| --- | --- | ---: | --- |
| VERIFIED | A1, A2, A4, A5 | 4 | Current Git/PR/dependency/V197 truth and secret boundary |
| VERIFIED | B1-B6 | 6 | OpenAPI drift, gateway, retry, approval, Talk, and capability contracts |
| VERIFIED | C1-C5 | 5 | Deterministic server Talk answer/replay/cancel plus real Mind-to-Agency proposal, exact WorkflowRole projection, approval, worker, and durable result proof |
| VERIFIED | D1-D6 | 6 | Canonical durable Mind authority, owner scope, manifests, and budgets |
| VERIFIED | E1-E8 | 8 | Typed Brain, governed Research adapter, and independent frozen evaluation corpus |
| VERIFIED | F1-F5 | 5 | Hydration, DAG limits, safe reducer, proposal V2, Agency lifecycle, and role-preserving compiled/persisted steps |
| VERIFIED | G1-G6 | 6 | Canonical append-only learning, WhyChanged, memory effects, and held-out/shadow proof |
| VERIFIED | H: Today, Talk, Journal, Plan, Systems, Orbit, Map, Timeline, Insights, Agents, Memory, Projects, Capsules, Research, Community, Billing, Notifications | 17 | Production-origin two-owner lifecycle, reload, denial, error, mobile/a11y route matrix, and retired Plan direction placeholder absent from runtime and registry |
| EXTERNAL_BLOCKED | H: Localization | 1 | 35 locale IDs, 37 writing variants, 944 static UI keys, exact parity, strict no-English fallback, offline bundling, canonical persistence, RTL/Roman behavior, deterministic extraction, and Chromium route evidence are green; independent native-language review remains external |
| VERIFIED | I1-I7 | 7 | Forced RLS, mutation security, replay/injection defenses, Actions hardening, branch protection, and SHA-bound SBOM gates |
| VERIFIED | J1-J5, J7-J9 | 8 | Cold boot, DR, crash recovery, release gate, browser matrix, performance/a11y, soak, and fresh artifact |
| EXTERNAL_BLOCKED | J6 | 1 | Approved server-side live AI credential and eligible model, plus intended deployed provider receipts, remain unavailable |
| EXTERNAL_BLOCKED | J10 | 1 | Requires an independent reviewer; this implementation pass cannot self-approve |
| VERIFIED | K1, K2, K6 | 3 | Draft PR #5, green exact-head Actions proof, and repository rename/rollback runbook |
| FOUNDER_DECISION | K3, K4, K5 | 3 | Merge, main-branch CI, and annotated release tag are intentionally not performed here |
| SUPERSEDED | A3 | 1 | The dedicated closure worktree is the documented canonical equivalent |

### Recomputed arithmetic

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

The correction-pass P0 requirement is not an internal partial: `submit_workflow_proposal()` now forwards `WorkflowStepProposal.role.value` into `ProposedStep`, the compiler preserves it in `CompiledStep`, and persistence writes the compiled role into `AgentStep`. Targeted real-bridge tests cover executor/security-reviewer DAG persistence, mutating-verifier rejection, self-verification, verifier-without-subject, and dangling dependency rejection. The targeted Agency and locale-preference integration set passed 19/19; the complete API suite passed 1115/1115.

## Localization Evidence

The frontend has one typed, statically bundled catalog authority under `apps/web/src/i18n/`, with 35 supported locale IDs, 37 required locale-writing variants, and 944 canonical static UI keys. Supported locales do not silently resolve missing copy to English. The extraction gate scans 29 UI-producing bridge modules and reports zero raw visible-copy violations. Catalog parity reports 35 locales, 37 variants, 944 keys, zero errors, zero blank values, zero placeholder mismatches, zero protected-brand violations, and zero Roman Urdu/Hindi native-script violations.

All 35 locale IDs are covered by the deterministic Chromium release matrix. The full desktop matrix passed 74/74 tests, representative mobile localization passed 21/21, representative desktop localization passed 9/9, and route-surface checks for Map, Orbit, Timeline, and Insights passed on desktop and mobile. Urdu script is explicitly RTL; Roman Urdu is explicitly LTR; Hindi Roman and script are LTR; Arabic and Persian are RTL. Unsupported writing choices are not displayed. User-authored and model-generated content remains unchanged during static UI language changes.

All non-English catalogs remain `MACHINE_DRAFT / HUMAN_REVIEW_PENDING`. No non-English locale or variant is `HUMAN_REVIEWED`. The optional WebKit host-library limitation is an infrastructure evidence hold, not an internal product blocker.

## Exact-Head Release Evidence

| Evidence | Result |
| --- | --- |
| Final head | `cb5ec5c93d1ded3be203b46eee9354074647f418` |
| NUR Readiness run | `33072481729`, exact-head, SUCCESS |
| `web-and-security` | SUCCESS; representative localization executed and passed 9/9 |
| `api` | SUCCESS |
| Local full API pytest | 1115 passed |
| Web unit suite | 27 files, 135 tests passed |
| Web typecheck/build | Passed; build emitted only the known large-bundle advisory |
| Extraction/parity | PASS; 29 modules / 0 violations; 35 locales / 37 variants / 944 keys / 0 errors |
| npm audit | 0 vulnerabilities |
| PR state | #5 OPEN, DRAFT, UNMERGED |
| Merge/tag | Neither performed |

## Remaining Boundaries

There are no remaining internally solvable blockers in the 82-task ledger. The remaining external gates are independent native-language review for H Localization, approved live provider/deployment evidence for J6, and independent final review for J10. Founder-only actions remain merging PR #5, verifying merged-main CI, and creating an annotated release tag.

## Final Verdict

The recomputed implementation verdict is:

```text
NUR_INTERNAL_COMPLETE_EXTERNAL_BLOCKED
```

This is not `NUR_FULL_PASS` because the external and founder gates above remain intentionally open. It is not `NUR_PARTIAL` because all internally solvable rows are verified and no internal partial remains. The branch remains a draft and must stop before merge.
