# NUR V197 Smoothness And Spectral Theme Evidence

## Candidate

- Branch: `codex/nur-v197-smooth-theme-20260829`
- Base handoff: `1bc1880c80da6000664b02e316790e5cfacbc869`
- Scope: canonical V197 frame pacing, spectral accent state, wordmark motion, galaxy wheel zoom, streamed Talk presentation, and runtime resource evidence
- Canonical V197 HTML, geometry, typography, intelligence behavior, authentication behavior, and privacy boundaries were not changed.

Implementation commits through the measured candidate:

- `7d82dad` refresh-rate-owned desktop celestial cadence with clamped delta time
- `c0d3fc6` one authoritative persisted spectral theme controller
- `15704ea` semantic theme uniforms without renderer or geometry recreation
- `41f77e2` accessible localized appearance controls and native click-count gestures
- `0ff45cf` animated seven-color wordmark film and bounded galaxy wheel zoom
- `59b6854` frame-coalesced Talk streaming and renderer lifecycle diagnostics

The delivery evidence and this report are committed after the implementation commits. The complete release command set is intentionally run after that evidence commit so every final gate refers to one exact candidate SHA.

## Measured Changes

### Celestial cadence

The old desktop scheduler skipped callbacks behind a fixed 20 ms gate. The new desktop scheduler paints on every browser `requestAnimationFrame` callback and integrates motion from a timestamp-derived delta clamped to 50 ms. The mobile path retains its explicit 33 ms bound.

Deterministic unit coverage proves:

- desktop 120 Hz and 60 Hz callback timestamps are accepted instead of hard-limited to 50 Hz;
- mobile remains deliberately bounded;
- long suspension gaps clamp to 50 ms;
- one renderer, one galaxy canvas, and one brain canvas remain authoritative.

The same local headless Chromium environment measured:

| Sequence | Entry FPS | Universe FPS | Entry p50 | Universe p50 |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 20.07 | 19.20 | 50.0 ms | 50.0 ms |
| Final live-stack trace | 30.70 | 30.40 | 33.3 ms | 33.3 ms |

These are headless measurements, not a claim of physical-display 60/120/144 Hz output. The contract-level fix is the removal of the desktop 20 ms gate; physical display cadence remains environment-dependent.

### Wordmark and galaxy interaction

Desktop Chromium evidence:

- visible reflected wordmark film moved from `7.05319% 50%` to `9.93654% 50%`;
- animation is `nurWordmarkSpectrumShift`, `5.2s`, linear, and running;
- wheel zoom changed camera Z from `5.15` to `4.899073525153837`;
- pointer drag changed the star-brain yaw/pitch and retained the existing reset behavior.

Mobile Chromium evidence:

- visible reflected wordmark film moved from `5.76923% 50%` to `8.97373% 50%`;
- wheel zoom changed camera Z from `5.15` to `4.919451526981837`.

### Route and lifecycle journey

The desktop and mobile journeys each exercised Systems, Universe, Map, Orbit, Timeline, Insights, Talk, Journal, Plan, Today, and Settings. They also exercised Map keyboard movement, galaxy zoom, brain drag, 100 mocked Talk stream deltas, 20 Talk/Systems transitions, 20 theme changes, double-click advance, and triple-click reset.

| Measurement | Desktop | Mobile |
| --- | ---: | ---: |
| Input next-frame latency during Talk stream | 10.9 ms | 8.5 ms |
| Talk text-node appends for 100 deltas | 1 | 1 |
| Elements before / after lifecycle | 1317 / 1317 | 1317 / 1317 |
| Style nodes before / after | 8 / 8 | 8 / 8 |
| Global listeners before / after | 42 / 42 | 42 / 42 |
| Active MutationObservers before / after | 5 / 5 | 5 / 5 |
| Active ResizeObservers before / after | 1 / 1 | 1 / 1 |
| Renderer geometries / textures / programs | 3 / 0 / 2 | 3 / 0 / 2 |
| Renderer particles | 2400 | 1400 |

No new long task or long animation frame appeared after the lifecycle baseline snapshot. Initial-load long tasks remain visible in the raw evidence and are not hidden.

### Spectral visual matrix

The visual matrix contains 60 screenshots: desktop and mobile, five states (`Original`, `Yellow`, `Green`, `Blue`, `Violet`), and six representative surfaces (`Today`, `Talk`, `Systems`, `Universe`, `Map`, `Settings`).

Across all 60 measurements:

- body background remained `rgb(0, 0, 0)`;
- panels remained black or transparent black with alpha from `0` through `0.84`;
- horizontal overflow was `0`;
- body typography remained `Crimson Pro`;
- heading typography remained `Bodoni Moda`;
- every representative panel was found;
- exact palette tokens, persistence, Settings state, and reset behavior matched assertions.

## Evidence Boundary

### MEASURED

- deterministic frame pacing and delta-time contracts;
- real API sign-in followed by Today, Systems, and Map performance trace;
- desktop and mobile Chromium route lifecycle;
- animated visible wordmark layer;
- bounded wheel zoom and star-brain pointer interaction;
- Talk stream coalescing and input responsiveness;
- theme persistence, double-click advance, triple-click reset, and Settings controls;
- five-state desktop/mobile visual matrix;
- canvas, listener, observer, element, stylesheet, renderer, and geometry stability.

### INFERRED

- physical high-refresh displays should receive every available desktop rAF callback because the fixed desktop gate is gone;
- semantic theme tokens propagate to routes covered by the CSS contract but not included in the 60-image representative matrix.

### NOT MEASURED

- a ten-minute soak in a headed physical 60/120/144 Hz browser;
- WebKit frame pacing for this targeted mission;
- live OpenAI response quality or provider latency, because the local proof intentionally used the disabled provider and did not fabricate a provider success;
- production network, production database, billing provider, or deployment behavior.

## Artifacts

- `proof/v5/performance/smooth-theme-baseline/performance-report.json`
- `proof/v5/performance/frame-pacing-fix/performance-report.json`
- `proof/v5/performance/smooth-theme-final/performance-report.json`
- `proof/v5/performance/smooth-theme-final/systems-map.png`
- `proof/v5/performance/smooth-theme-final/chromium-desktop/all-route-runtime.json`
- `proof/v5/performance/smooth-theme-final/chromium-mobile/all-route-runtime.json`
- `proof/v5/performance/smooth-theme-final/chromium-desktop/systems-after-lifecycle.png`
- `proof/v5/performance/smooth-theme-final/chromium-mobile/systems-after-lifecycle.png`
- `proof/v5/performance/smooth-theme-final/visual-matrix/`

The raw Chrome trace is generated locally as `chromium-performance-trace.json` and is intentionally excluded by the repository's existing trace ignore rule.
