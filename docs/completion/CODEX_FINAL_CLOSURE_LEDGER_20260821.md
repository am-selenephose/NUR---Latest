# NUR Final Closure Ledger - 2026-08-24 Candidate

The candidate identity is the commit containing this file. The pre-closure
branch SHA is `5ac83100a4cd4cc52cea9af81fc938d1b308003f`.

| Closure area | Root cause | Implementation | Executable proof | Candidate status |
| --- | --- | --- | --- | --- |
| Password recovery delivery | A reset token could be claimed for delivery without a durable lease, bounded retry receipt, stable Message-ID, or bounce classification. | Challenge delivery claims/attempts/failure/bounce columns, migration `0061`, lease expiry, retry/backoff, deterministic Message-ID and SMTP classification. | Recovery regression tests plus migration/DR/full API gates. | VERIFIED-CANDIDATE |
| Deterministic Talk provider | Browser E2E could prove only provider-disabled behavior or mock the network. | Server-only `deterministic` provider with production hard-fail, semantic event stream and optional deterministic delay. | Real browser -> Nginx -> FastAPI SSE -> provider -> PostgreSQL -> reload. | VERIFIED-CANDIDATE |
| Talk replay/cancel | No exact browser proof covered request replay, duplicate suppression and durable cancellation. | Real-stack answer/replay/cancel scenario using canonical V197 controls and persisted model-run state. | `talk-answer-real-stack.spec.ts`. | VERIFIED-CANDIDATE |
| Agency lifecycle | Mind created only `STEP_AWAITING_APPROVAL`, omitting the append-only workflow and compile events required by the UI contract. | Bridge emits `WORKFLOW_CREATED`, `PLAN_COMPILED`, then `STEP_AWAITING_APPROVAL`; EDIT invalidates old digest/call binding; REJECT is terminal. | Strict API regression plus Plan/Agency and EDIT/REJECT real-stack suites. | VERIFIED-CANDIDATE |
| Billing handoff | A successful popup could be misclassified as blocked because `window.open(...noopener...)` returned `null`; browser proof also needed the real backend handoff. | Pre-opened `about:blank` with `opener=null`, exact checkout location replacement and truthful blocked fallback. | Real checkout API, exact handoff URL, no entitlement before signed webhook, reload proof. | VERIFIED-CANDIDATE |
| Plan and dead-control registry closure | Deleted direction, ritual and voice placeholders still appeared in the machine-readable interaction registry or unreachable bridge/CSS branches, making the product look partially open after the durable lifecycle was green. | Registry tests now reject retired or missing honest-disabled controls; stale rows and unreachable bridge/CSS branches were removed. | Focused RED/GREEN registry test plus Plan mutation/reload/denial browser proof, 7/7 focused E2E. | VERIFIED-CANDIDATE |
| Localization extraction | Locale state, fallback and RTL existed, but locale-sensitive DOM copy in the bridge had no deterministic extraction enforcement and English hydration could overwrite localized critical copy. | Centralized navigation, language-control and critical-copy catalogs; post-hydration locale application preserving owner-ledger copy; TypeScript AST extraction scanner wired into G11. | 35-slot key completeness, focused Vitest 10/10, AST tests 2/2, API translation suite and V197 language/accessibility browser suite. | INTERNALLY VERIFIED; native-language review EXTERNAL_BLOCKED |
| Phase-H lifecycle | Route existence did not prove owner mutation, reload, denial and fail-closed state. | Two-owner real-stack fixtures across core lifecycle, adjuncts, Billing and Capsule durability. | Phase-H, core-product, Billing and ten-cycle Capsule specs. | VERIFIED-CANDIDATE; Localization awaits independent human review only |
| Runtime/release | The static gate did not orchestrate the full browser, process recovery, DR and soak evidence as one candidate. | Expanded `nur-gate.sh` and `real-stack-release-gate.sh`, including Chromium/WebKit mobile, performance, API/worker/Beat/Redis crash recovery, DR and optional 10-minute soak. | Shell contract tests plus full exact-candidate gate. | VERIFIED-CANDIDATE pending exact-head CI |

## Deliberately Unchanged

- Canonical V197 presentation, geometry, celestial assets, route assertions,
  RLS ownership model and server-side OpenAI boundary.
- Live provider success is not fabricated by deterministic mode.
- No merge, tag, repository rename, secret rotation or production deployment is
  performed by this candidate.

## Final Promotion Rule

The candidate may be pushed only after the full local gate succeeds. Final
reporting is prohibited until GitHub Actions succeeds on that exact pushed SHA;
PR #5's live status-check rollup is the authority.
