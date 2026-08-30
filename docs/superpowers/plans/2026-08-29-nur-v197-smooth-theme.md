# NUR V197 Smoothness And Spectral Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the measured V197 desktop frame-pacing defect and add one persisted, accessible, exact-palette spectral accent system without changing canonical V197 geometry, typography, semantic colors, intelligence behavior, or privacy boundaries.

**Architecture:** `v197CelestialRuntime.ts` remains the sole Three.js owner and receives delta-time helpers plus theme-uniform setters. A new bridge-owned `v197Theme.ts` owns accent state, local persistence, click-count gesture semantics, disposal, root CSS tokens, and celestial synchronization. Existing Settings rendering exposes the same controller through localized native controls; route CSS aliases generic accents to root semantic tokens while preserving data-semantic colors.

**Tech Stack:** TypeScript, Three.js, Vitest, Playwright, Vite, canonical V197 iframe bridge, CSS custom properties, localStorage.

**Spec:** `/home/nur/.codex/attachments/11ab0514-570c-4e2e-823a-a278a8f8e65b/pasted-text.txt`

## Global Constraints

- Base source is PR #5 head `1bc1880c80da6000664b02e316790e5cfacbc869`.
- Work only on `codex/nur-v197-smooth-theme-20260829`; do not modify main or merge PR #5.
- Preserve canonical V197 HTML hashes, black world, brain/galaxy geometry, Bodoni/Crimson typography, transparent glass, semantic colors, intelligence behavior, and security boundaries.
- Exact accents are `#ff4656`, `#ff9148`, `#ffdc5c`, `#48ebaf`, `#4fccff`, `#5a70ff`, and `#c16bff`.
- Desktop cadence belongs to rAF; mobile may retain a deliberate 33ms bound. Physics must use clamped timestamp delta.
- Do not overwrite the dirty `aziz/nur-global-language-runtime-20260829` worktree.

---

### Task 1: Lock Cadence And Delta-Time Contracts

**Files:**
- Create: `apps/web/src/v197/celestial-frame-pacing.test.ts`
- Modify: `apps/web/src/bridge/v197CelestialRuntime.ts`

**Interfaces:**
- Produces: `celestialDeltaSeconds(now: number, previous: number): number`
- Produces: `shouldPaintCelestialFrame(viewportWidth: number, now: number, lastPaintAt: number): boolean`

- [x] **Step 1: Write failing deterministic tests**

```ts
expect(shouldPaintCelestialFrame(1440, 8.33, 0)).toBe(true);
expect(shouldPaintCelestialFrame(1440, 16.67, 8.33)).toBe(true);
expect(shouldPaintCelestialFrame(390, 16.67, 0)).toBe(false);
expect(celestialDeltaSeconds(1016.67, 1000)).toBeCloseTo(.01667, 4);
expect(celestialDeltaSeconds(10_000, 1000)).toBe(.05);
```

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/celestial-frame-pacing.test.ts --run`

Expected: FAIL because the exported helpers do not exist and desktop still has a 20ms gate.

- [x] **Step 3: Implement the minimum cadence helpers and use them in the sole scheduler**

Desktop returns `true` for every rAF callback. Mobile paints when at least 33ms elapsed. Delta is seconds clamped to `.05`; all velocity, damping, ease, and depth updates consume it through a 60Hz-normalized scale where needed.

- [x] **Step 4: Verify GREEN and existing celestial contracts**

Run: `npm --workspace apps/web run test -- src/v197/celestial-frame-pacing.test.ts src/v197/adaptive-performance.test.ts src/v197/v43-star-brain-source.test.ts --run`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/bridge/v197CelestialRuntime.ts apps/web/src/v197/celestial-frame-pacing.test.ts
git commit -m "perf(v197): restore refresh-rate-owned celestial cadence"
```

### Task 2: Build One Authoritative Theme Controller

**Files:**
- Create: `apps/web/src/bridge/v197Theme.ts`
- Create: `apps/web/src/v197/theme-controller.test.ts`
- Modify: `apps/web/src/bridge/v197Bridge.ts`

**Interfaces:**
- Produces: `V197ThemeAccent`
- Produces: `createV197ThemeController(hostDocument, entryDocument, universeDocument): V197ThemeController`
- Produces controller methods `get`, `set`, `advance`, `reset`, `attachDocument`, and `dispose`.
- Persists only `nur:v197-theme-accent`.

- [x] **Step 1: Write failing tests for exact palette, authoritative cycle, restore, reset, and disposal**

```ts
expect(V197_THEME_COLORS.red).toBe("#ff4656");
expect(V197_THEME_CYCLE).toEqual(["original", "yellow", "green", "blue", "violet", "red", "orange", "indigo"]);
controller.set("green");
expect(document.documentElement.dataset.nurThemeAccent).toBe("green");
expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBe("green");
controller.reset();
expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBeNull();
```

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts --run`

- [x] **Step 3: Implement state without querying or rerendering component trees**

Each state change updates root datasets and attached celestial APIs only. `original` removes the dataset and persisted key so existing V197 values remain authoritative.

- [x] **Step 4: Integrate one controller into bridge startup and route document lifecycle**

The controller is created once, attaches Entry and Universe documents when available, and is disposed with bridge teardown. Rehydration reuses the same instance.

- [x] **Step 5: Verify GREEN and stable controller count**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts --run`

- [x] **Step 6: Commit**

```bash
git add apps/web/src/bridge/v197Theme.ts apps/web/src/bridge/v197Bridge.ts apps/web/src/v197/theme-controller.test.ts
git commit -m "feat(v197): add authoritative spectral theme state"
```

### Task 3: Synchronize Three.js Through Uniforms

**Files:**
- Modify: `apps/web/src/bridge/v197CelestialRuntime.ts`
- Modify: `apps/web/src/v197/theme-controller.test.ts`

**Interfaces:**
- Extends `GalaxyApi` and `StarBrainApi` with `setTheme(accent, color, strength)`.
- Adds shader uniforms `uThemeColor` and `uThemeStrength` without recreating renderer, material, geometry, or points.

- [x] **Step 1: Add failing identity tests**

Record renderer, galaxy geometry, and brain geometry references; apply yellow, green, and original; assert reference identity and exact uniform values remain stable.

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts --run`

- [x] **Step 3: Add uniform mixing with stellar-white core preserved**

`original` sets strength `0`; custom accents set `uThemeColor` from exact palette and a bounded strength. Theme updates invalidate one frame only and never construct Three resources.

- [x] **Step 4: Verify GREEN**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts src/v197/v43-star-brain-source.test.ts --run`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/bridge/v197CelestialRuntime.ts apps/web/src/v197/theme-controller.test.ts
git commit -m "feat(v197): synchronize spectral accent through shader uniforms"
```

### Task 4: Add Native Multi-Click Gesture Semantics

**Files:**
- Modify: `apps/web/src/bridge/v197Theme.ts`
- Modify: `apps/web/src/v197/theme-controller.test.ts`

**Interfaces:**
- One click listener per attached world document using native `MouseEvent.detail`.
- Uses existing blocker semantics and suppresses completed drags and brain canvas targets.

- [x] **Step 1: Write failing tests**

Cover single click no-op, detail `2` advance, detail `3` reset, button/input/panel/brain suppression, drag suppression, rapid double/triple behavior, and listener removal after disposal.

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts --run`

- [x] **Step 3: Implement one disposable gesture controller**

Use native detail, one pending double-click application canceled by click `3`, no global double-tap prevention, and no separate `dblclick` listener.

- [x] **Step 4: Verify GREEN and brain double-click source contract**

Run: `npm --workspace apps/web run test -- src/v197/theme-controller.test.ts src/v197/v43-star-brain-source.test.ts --run`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/bridge/v197Theme.ts apps/web/src/v197/theme-controller.test.ts
git commit -m "feat(v197): add disposable galaxy theme gestures"
```

### Task 5: Propagate Semantic CSS Tokens

**Files:**
- Create: `apps/web/src/styles/v197-theme.css`
- Modify: `apps/web/src/main.ts`
- Modify: `apps/web/src/styles/v197-cosmic-skin.css`
- Modify: `apps/web/src/styles/v197-map.css`
- Modify: `apps/web/src/styles/v197-orbit.css`
- Modify: `apps/web/src/styles/v197-timeline.css`
- Modify: `apps/web/src/styles/v197-insights.css`
- Create: `apps/web/src/v197/theme-css-contract.test.ts`

**Interfaces:**
- Root variables include `--nur-theme-accent`, RGB, soft, faint, strong, contrast, rim, control border, control glow, focus, and heading.

- [x] **Step 1: Write failing CSS contract tests**

Assert all exact accent selectors exist, original does not override canonical variables, route generic aliases use root theme tokens, semantic success/danger/relationship colors remain independent, panel backgrounds remain transparent black, and there is no `hue-rotate`, `transition: all`, or full-tree mutation.

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/theme-css-contract.test.ts --run`

- [x] **Step 3: Implement tokens and limited aliases**

Only active controls, selected tabs/cards, focus rings, headings, icons, and small rims use the active accent. World black, body ivory, panels, semantic statuses, and data colors remain unchanged.

- [x] **Step 4: Verify GREEN plus holographic and adaptive contracts**

Run: `npm --workspace apps/web run test -- src/v197/theme-css-contract.test.ts src/v197/holographic-film.test.ts src/v197/adaptive-performance.test.ts --run`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/main.ts apps/web/src/styles apps/web/src/v197/theme-css-contract.test.ts
git commit -m "feat(v197): propagate semantic spectral theme tokens"
```

### Task 6: Add Localized Accessible Appearance Control

**Files:**
- Modify: `apps/web/src/bridge/v197Adjuncts.ts`
- Modify: `apps/web/src/i18n/source-manifest.json`
- Modify: `apps/web/src/i18n/catalogs/*.json`
- Modify: `apps/web/src/i18n/schema.ts`
- Create: `apps/web/src/v197/theme-settings.test.ts`

**Interfaces:**
- Settings select uses `data-adjunct-control="theme-accent"` and calls the authoritative controller.
- Labels cover Theme, Original, Red, Orange, Yellow, Green, Blue, Indigo, Violet, and Reset theme through `v197Copy`.

- [x] **Step 1: Write failing Settings and catalog tests**

Assert keyboard-selectable options, localized labels, visible focus, immediate application, and parity across every existing catalog without modifying the separate localization worktree.

- [x] **Step 2: Verify RED**

Run: `npm --workspace apps/web run test -- src/v197/theme-settings.test.ts --run`

- [x] **Step 3: Implement control and append source keys to current catalogs**

Use locale-native color labels where available; preserve existing catalog content byte-for-byte outside added keys. Theme remains device-local and is not included in owner API preference mutations.

- [x] **Step 4: Verify GREEN and full extraction/parity**

Run: `npm run web:i18n-extraction && npm run web:i18n-catalog-parity`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/bridge/v197Adjuncts.ts apps/web/src/i18n apps/web/src/v197/theme-settings.test.ts
git commit -m "feat(v197): expose localized appearance control"
```

### Task 7: Profile And Repair Only Proven Hotspots

**Files:**
- Modify only measured owners among `v197Bridge.ts`, `v197StreamClient.ts`, `v197Hydration.ts`, `v197Polish.ts`, and route renderers.
- Create: `apps/web/src/v197/runtime-lifecycle-performance.test.ts`
- Create: `apps/web/e2e/v197-smooth-theme.spec.ts`

**Interfaces:**
- Development diagnostics report observer callbacks, records, duration, controller count, renderer info, and long-animation-frame entries without production console noise.

- [x] **Step 1: Add failing lifecycle assertions from the baseline trace**

After 20 route and 20 theme changes, assert controller, listener, observer, and canvas counts are stable. During mocked Talk streaming, assert bounded DOM flushes and responsive typing.

- [x] **Step 2: Verify RED or record that an asserted owner is already stable**

Run: `npm --workspace apps/web run test -- src/v197/runtime-lifecycle-performance.test.ts --run`

- [x] **Step 3: Apply only the smallest trace-backed repairs**

Batch token presentation at one rAF flush, narrow or batch hot observers, abort stale route work, and preserve hidden-stage cancellation. Do not introduce polling or visual degradation.

- [x] **Step 4: Verify GREEN**

Run: `npm --workspace apps/web run test -- src/v197/runtime-lifecycle-performance.test.ts --run`

- [x] **Step 5: Commit**

```bash
git add apps/web/src/bridge apps/web/src/v197/runtime-lifecycle-performance.test.ts apps/web/e2e/v197-smooth-theme.spec.ts
git commit -m "perf(v197): remove measured lifecycle stalls"
```

### Task 8: Rendered Verification And Evidence

**Files:**
- Create: `docs/v197-smooth-theme-performance-report.md`
- Create generated evidence under: `proof/v5/performance/smooth-theme-final/`

**Interfaces:**
- Final report separates MEASURED, INFERRED, and NOT MEASURED for every requested route/action.

- [x] **Step 1: Run targeted desktop and mobile Playwright**

Run: `npm --workspace apps/web run e2e -- e2e/v197-smooth-theme.spec.ts --project=chromium-desktop --project=chromium-mobile --workers=1`

- [x] **Step 2: Capture Original, Yellow, Green, Blue, and Violet screenshots**

Capture Today, Talk, Systems, Universe, Map, and Settings. Assert black backgrounds, transparent panels, Bodoni/Crimson families, semantic colors, exact accents, brain energy double-click, drag behavior, and triple reset.

- [x] **Step 3: Capture final trace with the same baseline sequence**

Run: `NUR_PERF_LABEL=smooth-theme-final NUR_PERF_SOAK_MS=5000 NUR_PERF_PROOF_DIR=../../proof/v5/performance/smooth-theme-final npm --workspace apps/web run e2e -- e2e/v197-performance.spec.ts --project=chromium-desktop --workers=1`

- [ ] **Step 4: Run the complete mandated gate**

```bash
npm run web:typecheck
npm run web:test
npm run web:build
npm run v197:integrity
npm run web:i18n-extraction
npm run web:i18n-catalog-parity
npm run web:e2e:mocked
npm run secret-scan
npm audit --audit-level=high
git diff --check
```

- [x] **Step 5: Write measured report and final review commit**

```bash
git add docs/v197-smooth-theme-performance-report.md proof/v5/performance/smooth-theme-final
git commit -m "docs(v197): record smooth theme runtime evidence"
```

- [ ] **Step 6: Push isolated branch without merging**

Run: `git push -u origin codex/nur-v197-smooth-theme-20260829`

Expected: local HEAD equals remote branch HEAD and all required gates refer to that exact commit.
