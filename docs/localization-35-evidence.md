# NUR Localization 35-Locale Evidence Report

**Evidence date:** 2026-08-27

**Current verdict:** `TECHNICAL_35_LANGUAGE_COMPLETE`

**Human-review status:** `MACHINE_DRAFT / HUMAN_REVIEW_PENDING`

All non-English and writing-variant catalogs remain `MACHINE_DRAFT`. English is `TECHNICALLY_COMPLETE`. No catalog is labeled `HUMAN_REVIEWED`; native-speaker review remains a separate release activity.

## Contract and static authority

| Measure | Result |
|---|---:|
| Exact supported locale IDs | 35 |
| Locale-writing catalog variants | 37 |
| Canonical typed static UI keys | 944 |
| Catalogs with complete key parity | 37 / 37 |
| Blank values | 0 |
| Placeholder mismatches | 0 |
| Protected NUR-brand violations | 0 |
| Roman Urdu/Hindi native-script violations | 0 |
| Render-time translation API/LLM dependency | None |

The single bundled authority is `apps/web/src/i18n/schema.ts`, `apps/web/src/i18n/catalog.ts`, and `apps/web/src/i18n/catalogs/*.json`. The compatibility facade in `apps/web/src/lib/i18n.ts` does not provide a second copy source. Static copy in V197 hydration, bridge, auth-adjacent, settings/adjunct, Insights, Map, Orbit, and Timeline producers is routed through strict `v197Copy` lookup. User-authored, model-generated, URL, technical-ID, and persisted database content remains outside catalog translation.

The visual reconciliation also made locale writing preference an end-to-end concern. V197 locale application now passes the selected writing variant into core, navigation, language-control, and critical copy lookup. Urdu Roman is LTR, Urdu script is RTL, Hindi Roman and script are LTR, and Arabic/Persian are RTL.

## Deterministic local gates

| Gate | Result |
|---|---|
| `npm run web:typecheck` | Passed |
| `npm run web:test` | 27 files, 135 tests passed |
| `npm run web:i18n-extraction` | `PASS`, 29 bridge modules scanned, 0 violations |
| `npm run web:i18n-catalog-parity` | `PASS`, 35 locales, 37 variants, 944 keys, 0 errors |
| `npm run web:build` | Passed; only the existing large-bundle advisory was emitted |
| `npm run mobile:typecheck` | Passed |
| `npm audit` | 0 vulnerabilities |
| Node extraction/parity tests | 4 passed, 0 failed |
| Backend compile | Passed |
| Full backend pytest suite | **1115 passed** |

## Exact-head GitHub Actions

The corrected commit is `389691656d977a0a256ef86cc6d7bfc626e8eb0a`. Exact-head NUR Readiness run **33070264599** completed successfully with both required jobs green:

| Job | Result |
|---|---|
| `web-and-security` | SUCCESS |
| `api` | SUCCESS |

The `web-and-security` job executed, rather than skipped, the representative localization command. It passed typecheck, unit tests, extraction, catalog parity, build, mocked E2E, representative localization E2E, mobile typecheck, and high-severity npm audit. The API job executed the full PostgreSQL/Redis-backed suite and passed all 1115 tests.

## Browser evidence

| Browser/profile | Coverage | Result |
|---|---:|---|
| Chromium desktop all-35 release matrix | 74 tests, including 35 locale IDs, 37 variants, persistence, preservation, overflow, and route surfaces | 74 passed |
| Chromium mobile representative localization | 21 tests | 21 passed |
| Chromium desktop representative localization | 9 tests | 9 passed |
| Chromium route surfaces | Map, Orbit, Timeline, and Insights across German, Arabic, Roman Urdu, and Simplified Chinese | 16 desktop passed; 16 mobile passed |
| Mocked web E2E | Talk, visual readiness, RTL script, Roman Urdu LTR, and localized metric checks | 21 passed, 1 intentional desktop-only skip |
| Focused RTL/Roman/localized-metric reconciliation | Chromium desktop/mobile | 5 passed, 1 intentional mobile-only skip |
| User/model content preservation | Persisted user-authored and model-authored text across language changes | Passed |

The previously observed `02nty'j` value was traced to broken machine translation in `ur-roman.json`, specifically the catalog value for canonical source key `ui.0747` (`outcomes returned`). The catalog was repaired to a readable Roman Urdu value, the adjacent `ui.0748` value was repaired as well, and the visual test now asserts the exact selected-catalog value rather than accepting English or arbitrary output.

The RTL fixture now explicitly sets `writing_preference: "script"`; a separate visual test proves `locale=ur` with `writing_preference: "roman"` remains LTR. No obsolete bare-Urdu RTL assumption remains in the reconciled visual tests.

## Optional WebKit boundary

A WebKit representative attempt was made but could not launch because the sandbox host lacked WebKit libraries including `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libatomic.so.1`, `libevent-2.1.so.7`, `libavif.so.16`, `libwayland-server.so.0`, `libmanette-0.2.so.0`, `libenchant-2.so.2`, `libsecret-1.so.0`, and `libwoff2dec.so.1.0.2`. This remains an infrastructure evidence hold, not a product assertion failure. Chromium desktop and mobile evidence is green.

## Review boundary

The machine-generated catalogs were prepared at build time with local Argos Translate and cached NLLB-200 assets. No translation runtime or OpenAI dependency was added to the product. Technical completeness is now supported by the deterministic gates, full backend suite, exact-head CI, and representative/all-35 Chromium evidence. Human promotion still requires documented native-speaker review of terminology, grammar, mixed-script behavior, RTL reading order, and long-copy layout for each locale and variant.

## Repository and PR state

The final branch is `codex/nur-final-closure-20260820`. Local HEAD equals the remote branch HEAD and PR #5 HEAD at `389691656d977a0a256ef86cc6d7bfc626e8eb0a`. PR #5 remains **OPEN / DRAFT**. No merge and no tag were performed.
