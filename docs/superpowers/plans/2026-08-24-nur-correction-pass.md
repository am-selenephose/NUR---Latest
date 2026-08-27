# NUR Correction Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Mind-to-Agency workflow-role loss and replace partial/fallback localization with complete, strict, offline UI catalogs for all 35 declared languages.

**Architecture:** Preserve the canonical V197 document and celestial runtime while moving all product copy behind one typed key authority consumed at render time by every UI-producing bridge. Keep user-authored content separate from product copy, validate locale/writing variants against the backend authority, and make missing catalog coverage a build failure.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, SQLAlchemy, PostgreSQL RLS, TypeScript, Vite, Vitest, Playwright, TypeScript compiler API, GitHub Actions.

**Spec:** `/home/nur/.codex/attachments/8f337abe-99ed-4da1-b44f-31767fb41c69/pasted-text.txt`

## Global Constraints

- Continue `codex/nur-final-closure-20260820` from exact SHA `9a37a2ae40d0392aee44aa560a97c4c67a62e294`.
- Keep PR #5 open, draft, unmerged, untagged, and not ready for review.
- Preserve canonical V197 geometry, classes, dimensions, animations, stars, and brain rig.
- Never translate user-authored/source content automatically.
- Static UI copy must be bundled; it must not call OpenAI.
- Every behavior change follows a witnessed RED then GREEN test cycle.
- Final claims require local HEAD, origin branch SHA, and PR #5 head SHA equality plus exact-head GitHub Actions success.

---

### Task 1: Preserve Workflow Roles Through The Real Agency Bridge

**Files:**
- Modify: `apps/api/app/tests/test_agency_bridge_strict.py`
- Modify: `apps/api/app/mind/agency_bridge.py`

**Interfaces:**
- Consumes: `WorkflowStepProposal.role: WorkflowRole`, `ProposedStep.role: str`, `compile_plan()`, and `AgentStep.role`.
- Produces: exact role values from Brain proposal through compiled and persisted Agency rows.

- [ ] Add a real `submit_workflow_proposal()` test with an `implementer` draft step and dependent `security_reviewer` read-only step; assert compiled and persisted roles are exactly `implementer` and `security_reviewer`.
- [ ] Add real-bridge rejection tests for a mutating verifier, same-role self-verification, verifier without a subject, and invalid dependencies.
- [ ] Run the focused tests and witness role assertions/rejections fail because the bridge emits `SPECIALIST`.
- [ ] Replace the hardcoded role with `step.role.value`; do not introduce a fallback.
- [ ] Re-run focused tests, then the full API suite and Ruff.

### Task 2: Build Strict Locale And Writing-Variant Authorities

**Files:**
- Modify: `apps/api/app/i18n/catalog.py`
- Modify: `apps/api/app/api/v1/profile.py`
- Modify: backend localization/profile tests discovered during implementation
- Replace: `apps/web/src/lib/i18n.ts`
- Create: focused web catalog modules under `apps/web/src/lib/i18n/`
- Modify: `apps/web/src/lib/i18n.test.ts`

**Interfaces:**
- Consumes: the existing 35 locale identifiers and persisted profile preference contract.
- Produces: normalized locale and supported writing-variant validation on both API and web, plus exact catalog-key parity with no supported-locale English inheritance.

- [ ] Add failing backend tests for unsupported locale rejection, canonical normalization, and per-locale writing-preference rejection/acceptance.
- [ ] Add failing web tests proving exactly 35 locales, catalog object independence, complete key parity, Roman/script catalog requirements, and absence of implicit English fallback.
- [ ] Implement one canonical English key schema and complete locale/variant records for every supported option.
- [ ] Make lookup throw during development/tests for missing supported-locale keys; normalize only unknown browser locale input.
- [ ] Re-run focused API and web tests to GREEN.

### Task 3: Migrate Every V197 Product Surface To Catalog Copy

**Files:**
- Modify: `apps/web/src/bridge/v197I18n.ts`
- Modify: all UI-producing `apps/web/src/bridge/v197*.ts` files identified by the extraction inventory
- Modify: auth/onboarding/scope renderers identified by the same inventory
- Preserve byte-for-byte: `apps/web/public/v197/NUR_V197_CHECKBOX_TICK_RESTORED.html` unless its existing product literals cannot be owned nonvisually; any exception requires an explicit integrity-hash update and visual proof.

**Interfaces:**
- Consumes: `uiCopy(locale, variant)` and typed surface-specific catalog views.
- Produces: locale-aware rendering for Today, Talk, Journal, Plan, Systems, Orbit, Map, Timeline, Insights, Agents, Memory, Projects, Capsules, Research, Community, Billing, Notifications, language/settings, auth/onboarding, and every modal/state/accessibility string.

- [ ] Inventory product-copy literals separately from structural IDs, brand `NUR`, and user data.
- [ ] Add failing surface tests before each renderer migration.
- [ ] Inject catalog copy into render functions instead of post-render English string replacement.
- [ ] Ensure a locale change rerenders the active surface and persists across reload without changing geometry or behavior.
- [ ] Run focused tests after every surface slice.

### Task 4: Replace The Narrow Extraction Gate

**Files:**
- Modify: `infra/scripts/check-i18n-extraction.mjs`
- Modify: `infra/tests/i18n-extraction.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/readiness.yml`

**Interfaces:**
- Consumes: the TypeScript compiler API and the complete UI-producing source inventory.
- Produces: deterministic violations for raw visible literals in assignments, attributes, renderer helpers, HTML injection, templates, statuses, errors, tooltips, and accessibility copy.

- [ ] Add scanner-fixture tests for every required literal form and witness RED for currently unscanned helpers/files.
- [ ] Expand scan targets to every UI-producing bridge/runtime module.
- [ ] Add an explicit invariant allowlist for `NUR` and structural-only strings; do not blanket-ignore whole files or helpers.
- [ ] Wire catalog parity, no-fallback, extraction, and RTL unit checks into NUR Readiness.
- [ ] Run scanner tests and the repository extraction command to GREEN with zero violations.

### Task 5: Prove All 35 Locales In The Browser

**Files:**
- Create: `apps/web/e2e/v197-localization-matrix.spec.ts`
- Modify: `apps/web/playwright.config.ts` only if deterministic project configuration is required

**Interfaces:**
- Consumes: persisted locale/variant preferences and typed expected catalog values.
- Produces: route/dialog/state assertions for every locale plus targeted overflow and RTL evidence.

- [ ] Write a failing locale-persistence and route-matrix E2E against the current partial implementation.
- [ ] For each of 35 locales, select/save/reload, traverse applicable routes, open major dialogs, assert expected catalog provenance, accessible names, direction, and absence of raw source copy.
- [ ] Add layout checks for German/French, CJK, Thai, Indic scripts, Urdu script, Arabic, Persian, and Roman Urdu.
- [ ] Run desktop matrix serially; run a representative mobile/RTL matrix without arbitrary sleeps, force clicks, or weakened assertions.

### Task 6: Recompute Evidence And Verify The Exact Head

**Files:**
- Modify: `docs/completion/CODEX_CURRENT_COMPLETION_20260821.md`
- Modify: related machine-readable/current-state and evidence ledgers referenced by that document

**Interfaces:**
- Consumes: actual test outputs, catalog counts, extraction violations, route-matrix results, and external dependencies.
- Produces: an 82-row evidence-backed ledger, strict/weighted percentages, and an honest final verdict.

- [ ] Reclassify Localization and any role-dependent row from actual evidence; do not preserve 92.7 by continuity.
- [ ] Run focused tests, full API regression, web tests/build/typecheck, security gates, V197 integrity, and full readiness.
- [ ] Commit scoped changes, push normally, and wait for exact-head GitHub Actions.
- [ ] Verify local HEAD equals origin branch SHA equals PR #5 head SHA; verify PR #5 remains OPEN and DRAFT.
- [ ] Report every metric required by the correction directive and stop before merge.
