# NUR Test Evidence — Correction-Pass Closure

**Evidence refreshed:** 2026-08-28 (user timezone)

The evidence below is anchored to the actual branch `codex/nur-final-closure-20260820` at final head `cb5ec5c93d1ded3be203b46eee9354074647f418`. The branch remains PR #5, OPEN and DRAFT. No merge or tag was performed.

## Static and contract evidence

| Command or gate | Result |
| --- | --- |
| API Ruff, full tree | PASS |
| API pytest, full suite | **PASS: 1115 passed** |
| Agency bridge and locale-preference integration tests | **PASS: 19 passed** |
| OpenAPI/client drift | PASS |
| Migration graph/head | PASS |
| Secret scan | PASS |
| Web TypeScript | PASS |
| Web unit tests | **PASS: 27 files, 135 tests** |
| Web production build | PASS; Vite emitted only the known large-bundle advisory |
| Mocked Playwright readiness | **PASS: 21 passed, 1 intentional desktop-only skip, 0 failed** |
| Mobile TypeScript | PASS |
| npm audit high | **PASS: 0 vulnerabilities** |
| Locale catalog/key completeness | **PASS: 35 locale IDs, 37 variants, 944 keys; exact parity** |
| Locale extraction | **PASS: 29 UI-producing bridge modules scanned, 0 raw-copy violations** |
| Locale behavior | PASS: strict offline bundled lookup, no supported-locale English fallback, writing-variant validation, RTL/Roman behavior |

## Agency role-projection evidence

The real `submit_workflow_proposal()` bridge forwards `WorkflowStepProposal.role.value` into `ProposedStep`. The compiler preserves the role in `CompiledStep`, and persistence writes the compiled role into `AgentStep` without inventing a fallback role.

The targeted integration suite proves an implementer-to-security-reviewer DAG preserves both roles in compiled and persisted rows. It also proves, through the real bridge, that a mutating security reviewer is rejected, same-role self-verification is rejected, a verifier without a subject is rejected, and dangling/cyclic dependencies are rejected. The targeted Agency and locale-preference set passed 19/19, followed by the full API regression pass of 1115/1115.

## Browser and localization evidence

The deterministic Chromium desktop all-35 release matrix passed 74/74 tests, including locale persistence, writing-variant behavior, preservation of user/model content, overflow checks, and Map/Orbit/Timeline/Insights route surfaces. The representative mobile localization suite passed 21/21; the representative desktop localization command executed in CI and passed 9/9. Route-surface checks passed on desktop and mobile for German, Arabic, Roman Urdu, and Simplified Chinese.

Urdu script is explicitly RTL and Roman Urdu is explicitly LTR. Hindi Roman and script are LTR; Arabic and Persian are RTL. Unsupported writing choices are filtered out. Visual assertions read expected values from the precise active catalog rather than accepting English or using language-detection heuristics. User-authored and model-generated content is preserved during static UI language changes.

## Exact-head GitHub Actions

[NUR Readiness run 33072481729](https://github.com/am-selenephos/NUR---Latest/actions/runs/33072481729) completed successfully on the exact final head `cb5ec5c93d1ded3be203b46eee9354074647f418`.

| Job | Result |
| --- | --- |
| `web-and-security` | SUCCESS; representative localization step executed and passed 9/9 |
| `api` | SUCCESS |

The web job executed the required typecheck, unit, extraction, catalog parity, build, mocked E2E, representative localization E2E, mobile typecheck, and high-severity audit gates. The API job completed successfully with the PostgreSQL/Redis-backed suite.

## Human-review and infrastructure boundaries

All non-English catalogs remain `MACHINE_DRAFT / HUMAN_REVIEW_PENDING`; no non-English locale or variant is labeled `HUMAN_REVIEWED`. Native-speaker review is an external quality gate, not a fabricated internal pass.

A local WebKit attempt was infrastructure-limited by missing host libraries. Chromium desktop and mobile acceptance is green; the WebKit limitation is recorded as an environment hold rather than a product assertion failure.

## Final classification

All internally solvable correction-pass items are verified. The resulting implementation verdict is `NUR_INTERNAL_COMPLETE_EXTERNAL_BLOCKED`: external native-language review, live-provider/deployment evidence, and independent final review remain open, while founder-only merge/main-CI/tag actions remain intentionally unperformed.
