# NUR Internal Remainder Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every internally solvable row in the 82-task Addendum ledger without changing canonical V197 geometry or fabricating external-provider, independent-review, merge, or release evidence.

**Architecture:** Keep the frozen V197 document as the presentation authority and make its existing locale mutation layer consume centralized catalog copy after durable hydration. Add an AST-based extraction gate for locale-sensitive bridge code, then reconcile Plan, Localization, and K2 against actual runtime and exact-head CI evidence.

**Tech Stack:** TypeScript, Vitest, Node.js TypeScript compiler API, Playwright, Bash release gates, Markdown/JSON evidence ledgers.

**Spec:** `/home/nur/Downloads/NUR_FULLSTACK_AGENTEND_MASTER_ADDENDUM_20260814.md`

## Global Constraints

- Preserve `apps/web/public/v197/NUR_V197_CHECKBOX_TICK_RESTORED.html` byte-for-byte.
- Do not redesign or replace the founder-approved later UI before it is supplied.
- Do not expose provider keys or fabricate provider, independent-review, merge, main-CI, or release-tag success.
- Use test-first red/green cycles for every behavior change.
- Commit and push only after the exact candidate passes the complete local release gates.

---

### Task 1: Reconcile The Stale Plan Boundary

**Files:**
- Modify: `apps/web/e2e/button-registry.spec.ts`
- Modify: `docs/interaction-registry.json`

**Interfaces:**
- Consumes: existing durable Plan controls and `web-closure.spec.ts` proof.
- Produces: a registry that rejects selectors which match no canonical control.

- [x] **Step 1: Add a failing registry assertion**

Add a source-level assertion that every non-deferred registry selector exists in the canonical runtime or is explicitly mounted by the bridge, and specifically reject the retired `plan.direction.disabled` row.

- [x] **Step 2: Run the registry test and verify RED**

Run: `npm --workspace apps/web run e2e -- e2e/button-registry.spec.ts --project=chromium-desktop --workers=1`

Expected: FAIL because `plan.direction.disabled` names a control already removed from the DOM.

- [x] **Step 3: Remove only the stale registry row**

Delete `plan.direction.disabled`; keep durable `plan.step` and `plan.actions`.
The hardened runtime test also proved ritual and voice were already absent, so
their stale registry rows and unreachable hydration/CSS branches were removed.

- [x] **Step 4: Run the registry and Plan closure tests**

Run: `npm --workspace apps/web run e2e -- e2e/button-registry.spec.ts e2e/web-closure.spec.ts --project=chromium-desktop --workers=1`

Expected: PASS.

### Task 2: Enforce Locale Copy Extraction

**Files:**
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/lib/i18n.test.ts`
- Modify: `apps/web/src/bridge/v197I18n.ts`
- Modify: `apps/web/src/bridge/v197Hydration.ts`
- Modify: `apps/web/src/v197/track-a-hydration.test.ts`
- Create: `infra/scripts/check-i18n-extraction.mjs`
- Create: `infra/tests/i18n-extraction.test.mjs`
- Modify: `package.json`
- Modify: `infra/scripts/nur-gate.sh`
- Modify: `.github/workflows/readiness.yml`

**Interfaces:**
- Consumes: `resolveLocale()`, `CRITICAL_COPY`, the frozen V197 DOM selectors, and the existing G11 gate.
- Produces: `criticalCopyFor(locale)`, catalog-backed language-control copy, post-hydration locale application, and `npm run web:i18n-extraction`.

- [x] **Step 1: Write failing locale behavior tests**

Assert that Roman Urdu hydration renders catalog-backed Talk/System critical copy after durable state rendering and that unknown locales use the English catalog.

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- --run src/lib/i18n.test.ts src/v197/track-a-hydration.test.ts`

Expected: FAIL because critical catalog copy is not currently consumed after hydration.

- [x] **Step 3: Implement catalog-backed critical copy**

Export `criticalCopyFor(locale)` and a centralized language-control catalog from `i18n.ts`. Apply localized copy after dynamic hydration so English-only render functions cannot overwrite it.

- [x] **Step 4: Verify focused GREEN**

Run the focused Vitest command from Step 2.

Expected: PASS.

- [x] **Step 5: Write the extraction-gate test first**

The test must prove the scanner rejects direct user-visible string literals assigned to `textContent`, `placeholder`, `title`, or locale-sensitive ARIA labels in `v197I18n.ts`.

- [x] **Step 6: Verify extraction RED**

Run: `node --test infra/tests/i18n-extraction.test.mjs`

Expected: FAIL before the scanner exists or while raw locale-sensitive literals remain.

- [x] **Step 7: Implement and wire the scanner**

Use the installed TypeScript parser, not regex-only source rewriting. Add `web:i18n-extraction`, replace the G11 skip with a real gate invocation, and enforce the same scanner in NUR Readiness.

- [x] **Step 8: Verify extraction GREEN**

Run: `node --test infra/tests/i18n-extraction.test.mjs && npm run web:i18n-extraction`

Expected: PASS with zero unextracted locale-sensitive copy literals.

### Task 3: Reconcile Exact Completion Evidence

**Files:**
- Modify: `docs/completion/CODEX_CURRENT_COMPLETION_20260821.md`
- Modify: `docs/completion/CODEX_CURRENT_STATE.json`
- Modify: `docs/completion/CODEX_ADDENDUM_COMPLETION_ASSESSMENT_20260821.md`
- Modify: `docs/completion/CODEX_TEST_EVIDENCE_20260821.md`
- Modify: `docs/completion/CODEX_FINAL_CLOSURE_LEDGER_20260821.md`
- Modify: `docs/completion/INDEPENDENT_REVIEW_PACKET.md`

**Interfaces:**
- Consumes: GitHub Actions run `32644405657`, Plan/runtime tests, and G11 extraction evidence.
- Produces: one non-conflicting authoritative verdict and exact arithmetic.

- [x] **Step 1: Update K2 to VERIFIED**

Record exact SHA `34902deb90ff8bb07ba8a16ba50e8b4c4e27f06f` and successful API plus web/security checks.

- [x] **Step 2: Promote Plan to VERIFIED**

Record that durable Plan mutation/reload/denial proof is green and the retired direction placeholder does not exist.

- [x] **Step 3: Reclassify Localization**

After deterministic extraction is green, classify the remaining native-language review as `EXTERNAL_BLOCKED`, not an internal partial.

- [x] **Step 4: Validate arithmetic and JSON**

Expected ledger: `VERIFIED=75`, `SUPERSEDED=1`, `EXTERNAL_BLOCKED=3`, `FOUNDER_DECISION=3`, strict and weighted completion `92.7%`, zero internal partial rows.

### Task 4: Exact-Head Verification, Commit, And Push

**Files:**
- Verify all modified files above.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a clean pushed commit and exact-head CI evidence.

- [x] **Step 1: Run focused and G11 gates**

Run unit, registry/Plan browser proof, `npm run web:i18n-extraction`, and `bash infra/scripts/nur-gate.sh G11_LANGUAGE`.

- [x] **Step 2: Run complete static and real-stack gates**

Run `bash infra/scripts/nur-gate.sh G01_STATIC` and the full real-stack release gate against one candidate.

- [x] **Step 3: Review diff and commit**

Use a scoped commit; do not stage generated runtime evidence.

- [ ] **Step 4: Push and verify exact-head GitHub CI**

Wait for both `api` and `web-and-security` on the exact pushed SHA. Do not claim success from local tests alone.
