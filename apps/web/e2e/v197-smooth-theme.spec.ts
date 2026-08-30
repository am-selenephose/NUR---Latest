import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type FrameLocator, type Page, type Route } from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

const proofRoot = join(process.cwd(), "../../proof/v5/performance/smooth-theme-final");
const accentColors = {
  yellow: "#ffdc5c",
  green: "#48ebaf",
  blue: "#4fccff",
  violet: "#c16bff",
} as const;
const themes = ["original", "yellow", "green", "blue", "violet"] as const;
const surfaces = [
  { name: "today", path: "/today", root: "#page-today", panel: ".today-grid > article" },
  { name: "talk", path: "/talk", root: "#page-talk", panel: ".talk-chamber" },
  { name: "systems", path: "/systems", root: "#page-systems", panel: ".universe-map-panel" },
  { name: "universe", path: "/universe", root: "#page-systems", panel: ".universe-map-panel" },
  { name: "map", path: "/universe/map", root: "#nur-map-root", panel: ".nur-map-pane.nur-map-workspace" },
  { name: "settings", path: "/settings", root: "#nur-v197-adjunct-root", panel: ".nur-adjunct-panel" },
] as const;

type AuditSnapshot = {
  elements: number;
  styles: number;
  canvases: string[];
  globalListeners: { added: number; removed: number; active: number };
  mutation: { created: number; disconnected: number; active: number; callbacks: number; records: number; durationMs: number; maxDurationMs: number };
  resize: { created: number; disconnected: number; active: number; callbacks: number; records: number; durationMs: number; maxDurationMs: number };
  streamTextAppends: number;
  longTasks: Array<{ startTime: number; duration: number }>;
  longAnimationFrames: Array<{ startTime: number; duration: number }>;
  galaxyIdentity: boolean;
  renderer: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number | null;
  } | null;
};

async function installRuntimeAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type ObserverCounters = {
      created: number;
      disconnected: number;
      active: number;
      callbacks: number;
      records: number;
      durationMs: number;
      maxDurationMs: number;
    };
    type Audit = {
      globalListeners: { added: number; removed: number; active: number };
      mutation: ObserverCounters;
      resize: ObserverCounters;
      streamTextAppends: number;
      longTasks: Array<{ startTime: number; duration: number }>;
      longAnimationFrames: Array<{ startTime: number; duration: number }>;
    };
    type AuditedWindow = typeof window & {
      __nurSmoothAudit?: Audit;
      __nurSmoothGalaxyOwner?: unknown;
      nurGalaxy?: unknown;
    };
    const auditedWindow = window as AuditedWindow;
    if (auditedWindow.__nurSmoothAudit) return;

    const observerCounters = (): ObserverCounters => ({
      created: 0,
      disconnected: 0,
      active: 0,
      callbacks: 0,
      records: 0,
      durationMs: 0,
      maxDurationMs: 0,
    });
    const audit: Audit = {
      globalListeners: { added: 0, removed: 0, active: 0 },
      mutation: observerCounters(),
      resize: observerCounters(),
      streamTextAppends: 0,
      longTasks: [],
      longAnimationFrames: [],
    };
    auditedWindow.__nurSmoothAudit = audit;

    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    type GlobalListener = {
      target: EventTarget;
      type: string;
      listener: EventListenerOrEventListenerObject;
      wrapped: EventListenerOrEventListenerObject;
      capture: boolean;
      active: boolean;
    };
    const globalListeners: GlobalListener[] = [];
    const captureOf = (options?: boolean | AddEventListenerOptions): boolean => (
      typeof options === "boolean" ? options : Boolean(options?.capture)
    );
    const deactivate = (entry: GlobalListener) => {
      if (!entry.active) return;
      entry.active = false;
      audit.globalListeners.removed += 1;
      audit.globalListeners.active -= 1;
    };

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (!listener || (this !== window && this !== document)) {
        return nativeAdd.call(this, type, listener, options);
      }
      const capture = captureOf(options);
      const existing = globalListeners.find(entry => (
        entry.active && entry.target === this && entry.type === type
        && entry.listener === listener && entry.capture === capture
      ));
      if (existing) return nativeAdd.call(this, type, existing.wrapped, options);

      const once = typeof options === "object" && Boolean(options.once);
      const entry = {
        target: this,
        type,
        listener,
        wrapped: listener,
        capture,
        active: true,
      } satisfies GlobalListener;
      if (once) {
        entry.wrapped = function (this: EventTarget, event: Event) {
          deactivate(entry);
          if (typeof listener === "function") listener.call(this, event);
          else listener.handleEvent(event);
        };
      }
      globalListeners.push(entry);
      audit.globalListeners.added += 1;
      audit.globalListeners.active += 1;
      if (typeof options === "object" && options.signal) {
        nativeAdd.call(options.signal, "abort", () => deactivate(entry), { once: true });
      }
      return nativeAdd.call(this, type, entry.wrapped, options);
    };

    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (!listener || (this !== window && this !== document)) {
        return nativeRemove.call(this, type, listener, options);
      }
      const capture = captureOf(options);
      const entry = globalListeners.find(candidate => (
        candidate.active && candidate.target === this && candidate.type === type
        && candidate.listener === listener && candidate.capture === capture
      ));
      if (!entry) return nativeRemove.call(this, type, listener, options);
      deactivate(entry);
      return nativeRemove.call(this, type, entry.wrapped, options);
    };

    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeMutationObserver {
      private auditActive = false;

      constructor(callback: MutationCallback) {
        audit.mutation.created += 1;
        super((records, observer) => {
          const started = performance.now();
          try {
            callback(records, observer);
          } finally {
            const duration = performance.now() - started;
            audit.mutation.callbacks += 1;
            audit.mutation.records += records.length;
            audit.mutation.durationMs += duration;
            audit.mutation.maxDurationMs = Math.max(audit.mutation.maxDurationMs, duration);
          }
        });
      }

      override observe(target: Node, options?: MutationObserverInit): void {
        if (!this.auditActive) {
          this.auditActive = true;
          audit.mutation.active += 1;
        }
        super.observe(target, options);
      }

      override disconnect(): void {
        if (this.auditActive) {
          this.auditActive = false;
          audit.mutation.active -= 1;
          audit.mutation.disconnected += 1;
        }
        super.disconnect();
      }
    };

    const NativeResizeObserver = window.ResizeObserver;
    if (NativeResizeObserver) {
      window.ResizeObserver = class extends NativeResizeObserver {
        private auditActive = false;

        constructor(callback: ResizeObserverCallback) {
          audit.resize.created += 1;
          super((records, observer) => {
            const started = performance.now();
            try {
              callback(records, observer);
            } finally {
              const duration = performance.now() - started;
              audit.resize.callbacks += 1;
              audit.resize.records += records.length;
              audit.resize.durationMs += duration;
              audit.resize.maxDurationMs = Math.max(audit.resize.maxDurationMs, duration);
            }
          });
        }

        override observe(target: Element, options?: ResizeObserverOptions): void {
          if (!this.auditActive) {
            this.auditActive = true;
            audit.resize.active += 1;
          }
          super.observe(target, options);
        }

        override disconnect(): void {
          if (this.auditActive) {
            this.auditActive = false;
            audit.resize.active -= 1;
            audit.resize.disconnected += 1;
          }
          super.disconnect();
        }
      };
    }

    const nativeAppend = Element.prototype.append;
    Element.prototype.append = function (...nodes: Array<Node | string>) {
      if (this instanceof HTMLElement && this.dataset.nurStreamText) {
        audit.streamTextAppends += 1;
      }
      return nativeAppend.call(this, ...nodes);
    };

    const NativePerformanceObserver = window.PerformanceObserver;
    for (const [entryType, target] of [
      ["longtask", audit.longTasks],
      ["long-animation-frame", audit.longAnimationFrames],
    ] as const) {
      if (!NativePerformanceObserver?.supportedEntryTypes?.includes(entryType)) continue;
      const observer = new NativePerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          target.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ type: entryType, buffered: true } as PerformanceObserverInit);
    }
  });
}

async function fulfillSse(route: Route, rows: Array<{ id: number; event: string; data: unknown }>): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: {
      "cache-control": "no-cache",
      "content-type": "text/event-stream; charset=utf-8",
    },
    body: rows.map(row => `id: ${row.id}\nevent: ${row.event}\ndata: ${JSON.stringify(row.data)}\n\n`).join(""),
  });
}

async function snapshot(universe: FrameLocator): Promise<AuditSnapshot> {
  return universe.locator("body").evaluate(() => {
    type DiagnosticWindow = typeof window & {
      __nurSmoothAudit?: Omit<AuditSnapshot, "elements" | "styles" | "canvases" | "galaxyIdentity" | "renderer">;
      __nurSmoothGalaxyOwner?: unknown;
      nurGalaxy?: {
        getParticleDiagnostics?: () => { renderer?: AuditSnapshot["renderer"] };
      };
    };
    const global = window as DiagnosticWindow;
    const audit = global.__nurSmoothAudit;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    return {
      elements: document.querySelectorAll("*").length,
      styles: document.querySelectorAll("style").length,
      canvases: [...document.querySelectorAll<HTMLCanvasElement>("canvas")]
        .map(canvas => canvas.id || canvas.className || "anonymous-canvas")
        .sort(),
      globalListeners: copy(audit?.globalListeners ?? { added: 0, removed: 0, active: 0 }),
      mutation: copy(audit?.mutation ?? { created: 0, disconnected: 0, active: 0, callbacks: 0, records: 0, durationMs: 0, maxDurationMs: 0 }),
      resize: copy(audit?.resize ?? { created: 0, disconnected: 0, active: 0, callbacks: 0, records: 0, durationMs: 0, maxDurationMs: 0 }),
      streamTextAppends: audit?.streamTextAppends ?? 0,
      longTasks: copy(audit?.longTasks ?? []),
      longAnimationFrames: copy(audit?.longAnimationFrames ?? []),
      galaxyIdentity: global.__nurSmoothGalaxyOwner === global.nurGalaxy,
      renderer: copy(global.nurGalaxy?.getParticleDiagnostics?.().renderer ?? null),
    };
  });
}

async function clickRoute(
  page: Page,
  universe: FrameLocator,
  selector: string,
  path: RegExp,
  root: string,
): Promise<void> {
  await universe.locator(`${selector}:visible`).first().click();
  await expect(page).toHaveURL(path);
  await expect(universe.locator(root)).toBeVisible({ timeout: 15_000 });
}

test("all-route V197 runtime stays responsive and resource-stable", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await installRuntimeAudit(page);
  const state = await installNurMocks(page);
  const mapWrites: Array<Record<string, unknown>> = [];
  await page.route("**/api/v1/map/views/*/layout", async route => {
    mapWrites.push(JSON.parse(route.request().postData() || "{}") as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/map/views/mock-map-view/graph", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nodes: [
          { id: "nur", kind: "MASTER_STAR", label: "NUR", parent_id: null, status: "ACTIVE", data: { layout: { x: 600, y: 370 } } },
          { id: "system:ambition", kind: "SYSTEM", label: "Ambition", parent_id: "nur", status: "ACTIVE", data: { system_slug: "ambition", layout: { x: 360, y: 250 } } },
          { id: "goal:smooth-goal", kind: "GOAL", label: "Keep NUR smooth", parent_id: "system:ambition", status: "ACTIVE", data: { system_slug: "ambition", layout: { x: 455, y: 330 } } },
        ],
        edges: [
          { id: "edge:ambition", source: "nur", target: "system:ambition", kind: "MASTER_TO_SYSTEM", semantic: false, user_confirmed: true },
          { id: "edge:smooth-goal", source: "system:ambition", target: "goal:smooth-goal", kind: "CONTAINS", semantic: false, user_confirmed: true },
        ],
        system_regions: [{
          slug: "ambition",
          title: "Ambition",
          node_id: "system:ambition",
          state: "ACTIVE",
          state_reason: "Measured owner goal.",
          progress_percent: 0,
          active_goal_count: 1,
          blocker_count: 0,
          next_move: "Keep NUR smooth.",
          layout: { x: 360, y: 250, radius: 132 },
        }],
        counts: { systems: 1, nodes: 3, edges: 2 },
        suggested_changes: { candidate_edges: [], suggestions: [] },
        staleness: {},
        permissions: { can_move: true, can_accept_suggestions: true },
        future_paths: [],
      }),
    });
  });

  const answer = Array.from({ length: 100 }, (_, index) => String(index % 10)).join("");
  await page.route("**/api/v1/cognition/talk/stream", async route => {
    const request = JSON.parse(route.request().postData() || "{}") as { message: string };
    const createdAt = new Date().toISOString();
    const result = {
      turn_event_id: "smooth-turn",
      response_event_id: "smooth-response",
      model_run_id: "smooth-model-run",
      provider: "openai",
      provider_available: true,
      provider_reason: null,
      output: {
        direct_response: answer,
        observed: ["The owner submitted one measured Talk turn."],
        inferred: [],
        hypotheses: [],
        uncertainty: [],
        next_move: "Keep the interaction responsive.",
        memory_candidates: [],
        source_refs: [],
      },
      evidence: { retrieval: [], withheld: [] },
      verification: { verdict: "PASS", checks: {} },
    };
    const thread = state.thread as Array<{
      id: string;
      who: string;
      text: string;
      structured_payload: Record<string, unknown>;
      created_at: string;
    }>;
    thread.push(
      { id: result.turn_event_id, who: "user", text: request.message, structured_payload: {}, created_at: createdAt },
      {
        id: result.response_event_id,
        who: "nur",
        text: answer,
        structured_payload: { provider_available: true, talk_output: result.output },
        created_at: createdAt,
      },
    );
    await new Promise(resolve => setTimeout(resolve, 240));
    await fulfillSse(route, [
      { id: 1, event: "stream.open", data: { request_id: "smooth-request" } },
      { id: 2, event: "talk.accepted", data: { model_run_id: result.model_run_id } },
      ...[...answer].map((delta, index) => ({ id: index + 3, event: "response.text.delta", data: { delta } })),
      { id: 103, event: "talk.completed", data: { durable: true, result } },
    ]);
  });

  await page.goto("/systems", { waitUntil: "load" });
  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible({ timeout: 15_000 });
  const galaxy = universe.locator("#space3d");
  const brain = universe.locator("#nur-brain-canvas");
  await expect(galaxy).toBeVisible();
  await expect(brain).toBeVisible();

  const wordmarkMotion = await universe.locator(".nur-v197-stable-wordmark").evaluate(async element => {
    const initialStyle = getComputedStyle(element);
    const before = initialStyle.backgroundPosition;
    const reflectedBefore = getComputedStyle(element, "::after").backgroundPosition;
    const animation = element.getAnimations().find(candidate => (
      (candidate as CSSAnimation).animationName === "nurWordmarkSpectrumShift"
    ));
    const animationBefore = animation?.currentTime ?? null;
    await new Promise(resolve => setTimeout(resolve, 180));
    const style = getComputedStyle(element);
    const reflectedStyle = getComputedStyle(element, "::after");
    return {
      before,
      after: style.backgroundPosition,
      reflectedBefore,
      reflectedAfter: reflectedStyle.backgroundPosition,
      reflectedAnimationName: reflectedStyle.animationName,
      reflectedAnimationPlayState: reflectedStyle.animationPlayState,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationPlayState: style.animationPlayState,
      animationBefore,
      animationAfter: animation?.currentTime ?? null,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      rootClasses: document.documentElement.className,
      systemsClasses: document.querySelector("#page-systems")?.className ?? "missing",
      inlineStyle: element.getAttribute("style"),
      keyframes: animation?.effect instanceof KeyframeEffect
        ? animation.effect.getKeyframes().map(frame => ({
          offset: frame.offset,
          backgroundPosition: frame.backgroundPosition,
        }))
        : [],
    };
  });
  expect(wordmarkMotion.animationName).toContain("nurWordmarkSpectrumShift");
  expect(wordmarkMotion.animationPlayState, JSON.stringify(wordmarkMotion)).toBe("running");
  expect(Number(wordmarkMotion.animationAfter), JSON.stringify(wordmarkMotion))
    .toBeGreaterThan(Number(wordmarkMotion.animationBefore));
  expect(wordmarkMotion.reflectedAnimationName, JSON.stringify(wordmarkMotion))
    .toContain("nurWordmarkSpectrumShift");
  expect(wordmarkMotion.reflectedAnimationPlayState, JSON.stringify(wordmarkMotion)).toBe("running");
  expect(wordmarkMotion.reflectedAfter, JSON.stringify(wordmarkMotion))
    .not.toBe(wordmarkMotion.reflectedBefore);

  const zoomBefore = await galaxy.evaluate(() => (
    (window as unknown as { nurGalaxy: { getParticleDiagnostics: () => { cameraZ: number } } })
      .nurGalaxy.getParticleDiagnostics().cameraZ
  ));
  await universe.locator(".universe-map-panel").evaluate(element => {
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -180 }));
  });
  await expect.poll(async () => galaxy.evaluate(() => (
    (window as unknown as { nurGalaxy: { getParticleDiagnostics: () => { cameraZ: number } } })
      .nurGalaxy.getParticleDiagnostics().cameraZ
  ))).toBeLessThan(zoomBefore - .08);
  const zoomAfter = await galaxy.evaluate(() => (
    (window as unknown as { nurGalaxy: { getParticleDiagnostics: () => { cameraZ: number } } })
      .nurGalaxy.getParticleDiagnostics().cameraZ
  ));

  const brainBefore = await brain.evaluate(() => (
    (window as unknown as { nurStarBrain: { getDiagnostics: () => { yaw: number; pitch: number } } })
      .nurStarBrain.getDiagnostics()
  ));
  await brain.evaluate((element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const pointer = { bubbles: true, cancelable: true, pointerId: 509, pointerType: "mouse", isPrimary: true, button: 0 };
    element.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1, clientX: rect.left + rect.width * .35, clientY: rect.top + rect.height * .58 }));
    element.dispatchEvent(new PointerEvent("pointermove", { ...pointer, buttons: 1, clientX: rect.left + rect.width * .68, clientY: rect.top + rect.height * .34 }));
    element.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0, clientX: rect.left + rect.width * .68, clientY: rect.top + rect.height * .34 }));
  });
  await expect.poll(async () => brain.evaluate((_element, previous) => {
    const current = (window as unknown as { nurStarBrain: { getDiagnostics: () => { yaw: number; pitch: number } } })
      .nurStarBrain.getDiagnostics();
    return Math.hypot(current.yaw - previous.yaw, current.pitch - previous.pitch);
  }, brainBefore)).toBeGreaterThan(.03);

  await clickRoute(page, universe, "[data-world-tab='map']", /\/universe\/map$/, "#nur-map-root");
  const mapRoot = universe.locator("#nur-map-root");
  await expect(mapRoot).toHaveAttribute("data-map-loaded", "true", { timeout: 15_000 });
  if (testInfo.project.name.includes("mobile")) {
    await mapRoot.locator('[data-map-mode="universe"]').click();
    await expect(mapRoot.locator('[data-map-mode="universe"]')).toHaveAttribute("aria-selected", "true");
  }
  await expect.poll(() => mapRoot.locator(".nur-map-node").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  const mapNode = mapRoot.locator('[data-map-node="goal:smooth-goal"]');
  await expect(mapNode).toBeVisible({ timeout: 15_000 });
  await mapNode.focus();
  await mapNode.press("ArrowRight");
  await expect.poll(() => mapWrites.length).toBe(1);
  expect(mapWrites[0]).toMatchObject({
    nodes: [{ node_ref_type: "goal", node_ref_id: "smooth-goal" }],
  });
  await clickRoute(page, universe, "[data-world-tab='orbits']", /\/universe\/orbits$/, "#nur-orbit-root");
  await clickRoute(page, universe, "[data-world-tab='timeline']", /\/universe\/timeline$/, "#nur-timeline-root");
  await clickRoute(page, universe, "[data-world-tab='insights']", /\/universe\/insights$/, "#nur-insights-root");
  await clickRoute(page, universe, "[data-world-tab='universe']", /\/universe$/, "#page-systems");

  await clickRoute(page, universe, "[data-page='talk']", /\/talk$/, "#page-talk");
  const talkInput = universe.locator("#talk-input");
  await talkInput.fill("Measure this streamed response.");
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  const inputFrameLatency = await talkInput.evaluate(async (input: HTMLTextAreaElement) => {
    const started = performance.now();
    input.focus();
    input.value = "Typing remains responsive while NUR is answering.";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return { durationMs: performance.now() - started, value: input.value, disabled: input.disabled };
  });
  expect(inputFrameLatency.disabled).toBe(false);
  expect(inputFrameLatency.value).toBe("Typing remains responsive while NUR is answering.");
  expect(inputFrameLatency.durationMs).toBeLessThan(100);
  await expect(universe.locator("#talk-stream .talk-message.nur[data-event-id='smooth-response']")).toContainText(answer);

  await clickRoute(page, universe, "[data-page='journal']", /\/journal$/, "#page-journal");
  await clickRoute(page, universe, "[data-page='plan']", /\/plan$/, "#page-plan");
  await clickRoute(page, universe, "[data-page='today']", /\/today$/, "#page-today");
  await universe.locator(".nur-user").click();
  await universe.locator('[data-owner-route="/settings"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(universe.locator("#nur-v197-adjunct-root")).toBeVisible();
  await universe.locator('[data-adjunct-route="/systems"]').click();
  await expect(page).toHaveURL(/\/systems$/);
  await expect(universe.locator("#page-systems")).toBeVisible();

  await galaxy.evaluate(() => {
    const global = window as unknown as { __nurSmoothGalaxyOwner?: unknown; nurGalaxy?: unknown };
    global.__nurSmoothGalaxyOwner = global.nurGalaxy;
  });
  await page.waitForTimeout(400);
  const before = await snapshot(universe);

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await clickRoute(page, universe, "[data-page='talk']", /\/talk$/, "#page-talk");
    await clickRoute(page, universe, "[data-page='systems']", /\/systems$/, "#page-systems");
  }

  const world = universe.locator(".universe-map-panel");
  for (let change = 0; change < 20; change += 1) {
    await world.evaluate(element => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 2 }));
    });
    await page.waitForTimeout(300);
  }
  await expect(universe.locator("html")).toHaveAttribute("data-nur-theme-accent", "violet");
  await world.evaluate(element => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 3 }));
  });
  await expect(universe.locator("html")).not.toHaveAttribute("data-nur-theme-accent", /.+/);
  await page.waitForTimeout(400);

  const after = await snapshot(universe);
  const report = {
    project: testInfo.project.name,
    generatedAt: new Date().toISOString(),
    wordmarkMotion,
    zoom: { before: zoomBefore, after: zoomAfter },
    mapWrites,
    inputFrameLatency,
    before,
    after,
  };
  const projectDir = join(proofRoot, testInfo.project.name);
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "all-route-runtime.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await page.screenshot({ path: join(projectDir, "systems-after-lifecycle.png"), animations: "allow" });

  expect(before.canvases).toEqual(["nur-brain-canvas", "space3d"]);
  expect(after.canvases).toEqual(before.canvases);
  expect(after.styles).toBe(before.styles);
  expect(Math.abs(after.elements - before.elements)).toBeLessThanOrEqual(4);
  expect(after.globalListeners.active).toBe(before.globalListeners.active);
  expect(after.mutation.active).toBe(before.mutation.active);
  expect(after.resize.active).toBe(before.resize.active);
  expect(after.galaxyIdentity).toBe(true);
  expect(after.renderer).toMatchObject({
    geometries: before.renderer?.geometries,
    textures: before.renderer?.textures,
    programs: before.renderer?.programs,
  });
  expect(after.renderer?.points ?? 0).toBeGreaterThan(0);
  expect(after.streamTextAppends).toBe(before.streamTextAppends);
  expect(before.streamTextAppends).toBe(1);
});

test("spectral visual matrix preserves black glass and exact accents", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await installNurMocks(page);
  const projectDir = join(proofRoot, "visual-matrix", testInfo.project.name);
  const measurements: Array<Record<string, unknown>> = [];
  const originalPanelAlpha = new Map<string, number>();

  for (const theme of themes) {
    await page.goto("/settings", { waitUntil: "load" });
    const universe = page.frameLocator("#nur-universe-stage");
    const select = universe.locator('[data-adjunct-control="theme-accent"]');
    await expect(select).toBeVisible({ timeout: 15_000 });
    await select.selectOption(theme);
    const storedAfterSelection = await page.evaluate(() => localStorage.getItem("nur:v197-theme-accent"));
    expect(storedAfterSelection).toBe(theme === "original" ? null : theme);

    for (const surface of surfaces) {
      await page.goto(surface.path, { waitUntil: "load" });
      await expect(universe.locator(surface.root)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("html")).toHaveAttribute("data-nur-universe-polished", "true", { timeout: 15_000 });
      if (theme === "original") {
        await expect(universe.locator("html")).not.toHaveAttribute("data-nur-theme-accent", /.+/);
      } else {
        await expect(universe.locator("html")).toHaveAttribute("data-nur-theme-accent", theme, { timeout: 15_000 });
      }
      const storedAccent = await page.evaluate(() => localStorage.getItem("nur:v197-theme-accent"));
      const measurement = await universe.locator(surface.root).evaluate((root, expected) => {
        const panel = root.querySelector<HTMLElement>(expected.panelSelector) ?? root as HTMLElement;
        const heading = root.querySelector<HTMLElement>("h1, h2, .page-title, .panel-title") ?? root as HTMLElement;
        const bodyColor = getComputedStyle(document.body).backgroundColor;
        const panelColor = getComputedStyle(panel).backgroundColor;
        const panelChannels = panelColor.match(/[\d.]+/g)?.map(Number) ?? [];
        const alpha = panelChannels[3] ?? 1;
        return {
          theme: expected.theme,
          panelFound: panel !== root,
          themeAttribute: document.documentElement.dataset.nurThemeAccent ?? "original",
          inlineAccent: document.documentElement.style.getPropertyValue("--nur-theme-accent").trim(),
          bodyColor,
          panelColor,
          panelChannels: panelChannels.slice(0, 3),
          panelAlpha: alpha,
          bodyFont: getComputedStyle(document.body).fontFamily,
          headingFont: getComputedStyle(heading).fontFamily,
          horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        };
      }, { theme, panelSelector: surface.panel });
      measurements.push({ surface: surface.name, storedAccent, ...measurement });
      expect(measurement.bodyColor).toBe("rgb(0, 0, 0)");
      expect(measurement.panelFound).toBe(true);
      expect(measurement.panelChannels.every(channel => channel <= 10)).toBe(true);
      expect(measurement.panelAlpha).toBeLessThan(1);
      expect(measurement.bodyFont).toContain("Crimson Pro");
      expect(measurement.headingFont).toContain("Bodoni Moda");
      expect(measurement.horizontalOverflow).toBe(0);
      if (theme === "original") {
        originalPanelAlpha.set(surface.name, measurement.panelAlpha);
        expect(measurement.themeAttribute).toBe("original");
        expect(measurement.inlineAccent).toBe("");
      } else {
        expect(measurement.panelAlpha).toBeCloseTo(originalPanelAlpha.get(surface.name) ?? -1, 3);
        expect(
          measurement.themeAttribute,
          JSON.stringify({ surface: surface.name, theme, storedAccent, measurement }),
        ).toBe(theme);
        expect(measurement.inlineAccent).toBe(accentColors[theme]);
      }
      const screenshotDir = join(projectDir, theme);
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({
        path: join(screenshotDir, `${surface.name}.png`),
        animations: "allow",
        fullPage: false,
      });
    }
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`, "utf8");
  expect(measurements).toHaveLength(themes.length * surfaces.length);
});
