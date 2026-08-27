# NUR Localization 35-Locale Evidence Report

**Evidence date:** 2026-08-27

**Current verdict:** `LOCALIZATION_PARTIAL`

**Catalog quality:** All non-English and writing-variant catalogs remain `MACHINE_DRAFT`. The implementation has technical evidence for the checked-in gates, but native-speaker review has not occurred; no catalog is labeled `HUMAN_REVIEWED`.

## Contract and static authority

| Measure | Result |
|---|---:|
| Exact supported locale IDs | 35 |
| Locale-writing catalog variants | 37 |
| Canonical typed UI keys | 944 |
| Catalogs with complete key parity | 37 / 37 |
| Blank values | 0 |
| Placeholder mismatches | 0 |
| Protected NUR-brand violations | 0 |
| Roman Urdu/Hindi native-script violations | 0 |
| Render-time translation API/LLM dependency | None |

The bundled authority is `apps/web/src/i18n/schema.ts`, `apps/web/src/i18n/catalog.ts`, and `apps/web/src/i18n/catalogs/*.json`. The compatibility facade in `apps/web/src/lib/i18n.ts` does not provide a second copy source. Static copy in V197 hydration, bridge, auth-adjacent, settings/adjunct, Insights, Map, Orbit, and Timeline producers is routed through strict `v197Copy` calls. User-authored, model-generated, URL, technical-ID, and persisted database content remains outside catalog translation.

## Deterministic gates

| Gate | Result |
|---|---|
| `node infra/scripts/check-i18n-catalog-parity.mjs` | `PASS`, 35 locales, 37 variants, 944 keys, 0 errors |
| `node infra/scripts/check-i18n-extraction.mjs` | `PASS`, 29 bridge modules scanned, 0 violations |
| Node extraction/parity tests | 4 passed, 0 failed |
| Web typecheck | Passed |
| Web production build | Passed; Vite emitted only the existing large-bundle advisory |
| Full web unit suite | 27 files, 135 tests passed |
| Backend compile | Passed |
| Standalone backend locale catalog tests | 4 passed |

The root scripts are `web:i18n-catalog-parity`, `web:i18n-extraction`, `web:e2e:localization-representative`, and `web:e2e:localization-35`. Readiness CI runs parity, extraction, typecheck, unit tests, build, and the bounded representative Chromium localization gate. The full matrix remains an explicit release command.

## Browser evidence

| Browser/profile | Coverage | Result |
|---|---:|---|
| Chromium desktop | 74 tests | 74 passed |
| Chromium mobile | 21 representative tests | 21 passed |
| Chromium desktop all-locale persistence | 37 writing-variant cases | Included in the 74 passed |
| Chromium route surfaces | Map, Orbit, Timeline, Insights across German, Arabic, Roman Urdu, and Simplified Chinese | 16 passed on desktop and 16 passed on mobile |
| User/model content preservation | Persisted user-authored and model-authored text across language changes | Passed on desktop and mobile representative runs |
| WebKit desktop attempt | 21 attempted | Held by sandbox host dependencies, not a product assertion failure |

The WebKit attempt could not launch because the host lacked `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libatomic.so.1`, `libevent-2.1.so.7`, `libavif.so.16`, `libwayland-server.so.0`, `libmanette-0.2.so.0`, `libenchant-2.so.2`, `libsecret-1.so.0`, and `libwoff2dec.so.1.0.2`. This is recorded as an environment hold rather than a browser-product failure.

## Backend execution limitation

The standalone backend locale metadata and normalization tests pass. The authenticated database-backed profile preference and translation endpoint suites were not executable in this sandbox: the system Python environment lacks `pydantic_settings`, no project virtual environment is present, and `psql` is unavailable for the fixture invoked by the integration suite. The readiness workflow provisions PostgreSQL and Redis and will exercise those tests in CI. This unexecuted local integration path is the reason the current verdict remains `LOCALIZATION_PARTIAL` rather than `TECHNICAL_35_LANGUAGE_COMPLETE`.

## Review boundary

The machine-generated catalogs were prepared at build time with local Argos Translate and cached NLLB-200 assets. They are not human-reviewed translations. Promotion to `TECHNICALLY_COMPLETE` requires the integration environment gate to execute successfully; promotion of any locale or variant to `HUMAN_REVIEWED` additionally requires documented native-speaker review of terminology, grammar, mixed-script behavior, RTL reading order, and long-copy layout.
