import {
  expect,
  test,
  type CDPSession,
  type FrameLocator,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

const GALAXY_FRAME_ID = "nur-v197-halo-free-galaxy-frame";
const GALAXY_SOURCE = "/v197/NUR_V197_HALO_FREE.html";
const GALAXY_SHA256 = "315071e23bd82cad1b68179f7efc3728b274ac5b7ffcae5941ceb919efa7773a";

type GalaxyDiagnostics = {
  version: string;
  sourceArtifact: string;
  artifactSha256: string;
  renderer: string;
  haloLayer: boolean;
  stars: number;
  ambientStars: number;
  particles: number;
  ambient: number;
  presentedHz: number;
  renderCostMs: number;
  zoom: number;
  targetZoom: number;
  minZoom: number;
  maxZoom: number;
  hyperspace: number;
  targetHyperspace: number;
  dim4: number;
  targetDim4: number;
  dim5: number;
  targetDim5: number;
  rig: {
    targetYaw: number;
  };
  activePointerCount: number;
  pinchActive: boolean;
};

type GalaxyHandle = {
  universe: FrameLocator;
  exactGalaxy: FrameLocator;
  canvas: Locator;
};

type FramePoint = { x: number; y: number };

type PinchOrigin = FramePoint & {
  axisX: number;
  axisY: number;
};

type PhysicalTouchPoint = FramePoint & {
  id: number;
  radiusX: number;
  radiusY: number;
  force: number;
};

type MotionProbe = {
  events: string[];
  downPointerId: number | null;
  lastPointerId: number | null;
  moveCount: number;
  shiftMoveCount: number;
  travelX: number;
  travelY: number;
  maxTargetYaw: number;
  maxTargetDim4: number;
  minTargetDim5: number;
  maxTargetHyperspace: number;
};

async function diagnostics(universe: FrameLocator): Promise<GalaxyDiagnostics> {
  return universe.locator("body").evaluate(() => {
    const snapshot = (window as unknown as {
      NURDiagnostics?: { snapshot: () => GalaxyDiagnostics };
    }).NURDiagnostics?.snapshot();
    if (!snapshot) throw new Error("Exact galaxy diagnostics are unavailable");
    return snapshot;
  });
}

async function openExactGalaxy(page: Page): Promise<GalaxyHandle> {
  await installNurMocks(page);
  await page.goto("/systems", { waitUntil: "load" });

  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible();

  const galaxyFrame = universe.locator(`#${GALAXY_FRAME_ID}`);
  await expect(galaxyFrame).toBeAttached();
  await expect(galaxyFrame).toHaveAttribute("src", GALAXY_SOURCE);
  await expect(galaxyFrame).toHaveAttribute("data-nur-artifact-sha256", GALAXY_SHA256);
  await expect(galaxyFrame).toHaveAttribute("data-nur-exact-galaxy-state", "ready");

  const exactGalaxy = universe.frameLocator(`#${GALAXY_FRAME_ID}`);
  const canvas = exactGalaxy.locator("canvas#galaxy");
  await expect(canvas).toBeVisible();
  const initial = await diagnostics(universe);
  expect(initial.stars).toBe(2662);
  expect(initial.presentedHz).toBeGreaterThan(0);

  return { universe, exactGalaxy, canvas };
}

async function resetRig(universe: FrameLocator): Promise<void> {
  await universe.locator("body").evaluate(() => {
    const runtime = (window as unknown as {
      __nurGalaxy?: { reset: () => void };
    }).__nurGalaxy;
    if (!runtime) throw new Error("Exact galaxy runtime is unavailable");
    runtime.reset();
  });
  await expect.poll(async () => (await diagnostics(universe)).targetZoom).toBeCloseTo(1, 3);
  await expect.poll(async () => (await diagnostics(universe)).zoom).toBeCloseTo(1, 2);
}

async function galaxyPanelBackgroundPoint(
  universe: FrameLocator,
  requiredHalfSpan = 0,
): Promise<FramePoint> {
  const panel = universe.locator("#page-systems .universe-map-panel");
  await panel.scrollIntoViewIfNeeded();
  return panel.evaluate((element, halfSpan) => {
    const panelElement = element as HTMLElement;
    const panelRect = panelElement.getBoundingClientRect();
    const blockedSelector = [
      "a", "button", "input", "textarea", "select", "label", "summary", "iframe",
      "[contenteditable]", "[role='button']", "[role='dialog']", "[data-action]",
      "[data-system]", "[data-system-slug]", ".universe-system-node", ".universe-add-system",
      "#front-nur-star", "#nur-exact-brain-frame",
    ].join(",");
    const left = Math.max(panelRect.left + 12, 12);
    const right = Math.min(panelRect.right - 12, innerWidth - 12);
    const top = Math.max(panelRect.top + 12, 12);
    const bottom = Math.min(panelRect.bottom - 12, innerHeight - 12);
    const usable = (x: number, y: number) => {
      if (x < left || x > right || y < top || y > bottom) return false;
      const target = document.elementFromPoint(x, y);
      return Boolean(
        target
        && target.closest(".universe-map-panel") === panelElement
        && !target.closest(blockedSelector),
      );
    };
    const fractions = [.5, .38, .62, .25, .75, .12, .88];
    for (const yFraction of fractions) {
      for (const xFraction of fractions) {
        const x = left + (right - left) * xFraction;
        const y = top + (bottom - top) * yFraction;
        if (
          usable(x, y)
          && usable(x - halfSpan, y)
          && usable(x + halfSpan, y)
        ) return { x, y };
      }
    }
    throw new Error(`No non-interactive Systems galaxy point has ${halfSpan}px horizontal clearance`);
  }, requiredHalfSpan);
}

async function galaxyDragOrigin(
  universe: FrameLocator,
  delta: FramePoint,
): Promise<FramePoint> {
  const panel = universe.locator("#page-systems .universe-map-panel");
  await panel.scrollIntoViewIfNeeded();
  return panel.evaluate((element, movement) => {
    const panelElement = element as HTMLElement;
    const panelRect = panelElement.getBoundingClientRect();
    const blockedSelector = [
      "a", "button", "input", "textarea", "select", "label", "summary", "iframe",
      "[contenteditable]", "[role='button']", "[role='dialog']", "[data-action]",
      "[data-system]", "[data-system-slug]", ".universe-system-node", ".universe-add-system",
      "#front-nur-star", "#nur-exact-brain-frame",
    ].join(",");
    const usable = (x: number, y: number) => {
      if (
        x < panelRect.left + 12
        || x > panelRect.right - 12
        || y < panelRect.top + 12
        || y > panelRect.bottom - 12
        || x < 12
        || x > innerWidth - 12
        || y < 12
        || y > innerHeight - 12
      ) return false;
      const target = document.elementFromPoint(x, y);
      return Boolean(
        target
        && target.closest(".universe-map-panel") === panelElement
        && !target.closest(blockedSelector),
      );
    };
    for (let yStep = 1; yStep <= 9; yStep += 1) {
      for (let xStep = 1; xStep <= 9; xStep += 1) {
        const x = panelRect.left + panelRect.width * xStep / 10;
        const y = panelRect.top + panelRect.height * yStep / 10;
        const pathIsClear = Array.from({ length: 9 }, (_, index) => index / 8)
          .every(progress => usable(
            x + movement.x * progress,
            y + movement.y * progress,
          ));
        if (pathIsClear) return { x, y };
      }
    }
    throw new Error(
      `No non-interactive Systems galaxy path fits ${movement.x}px by ${movement.y}px`,
    );
  }, delta);
}

async function pinchOrigin(
  universe: FrameLocator,
  maxHalfDistance: number,
): Promise<PinchOrigin> {
  const panel = universe.locator("#page-systems .universe-map-panel");
  await panel.scrollIntoViewIfNeeded();
  return panel.evaluate((element, halfDistance) => {
    const panelElement = element as HTMLElement;
    const panelRect = panelElement.getBoundingClientRect();
    const blockedSelector = [
      "a", "button", "input", "textarea", "select", "label", "summary", "iframe",
      "[contenteditable]", "[role='button']", "[role='dialog']", "[data-action]",
      "[data-system]", "[data-system-slug]", ".universe-system-node", ".universe-add-system",
      "#front-nur-star", "#nur-exact-brain-frame",
    ].join(",");
    const left = Math.max(panelRect.left + 10, 10);
    const right = Math.min(panelRect.right - 10, innerWidth - 10);
    const top = Math.max(panelRect.top + 10, 10);
    const bottom = Math.min(panelRect.bottom - 10, innerHeight - 10);
    const usable = (x: number, y: number) => {
      if (x < left || x > right || y < top || y > bottom) return false;
      const target = document.elementFromPoint(x, y);
      return Boolean(
        target
        && target.closest(".universe-map-panel") === panelElement
        && !target.closest(blockedSelector),
      );
    };
    const axes = [
      { axisX: 1, axisY: 0 },
      { axisX: 0, axisY: 1 },
      { axisX: Math.SQRT1_2, axisY: Math.SQRT1_2 },
      { axisX: Math.SQRT1_2, axisY: -Math.SQRT1_2 },
    ];
    for (let yStep = 1; yStep <= 9; yStep += 1) {
      for (let xStep = 1; xStep <= 9; xStep += 1) {
        const x = left + (right - left) * xStep / 10;
        const y = top + (bottom - top) * yStep / 10;
        for (const axis of axes) {
          const dx = axis.axisX * halfDistance;
          const dy = axis.axisY * halfDistance;
          if (usable(x - dx, y - dy) && usable(x + dx, y + dy)) {
            return { x, y, ...axis };
          }
        }
      }
    }
    throw new Error(`No non-interactive Systems galaxy pinch origin fits ${halfDistance}px`);
  }, maxHalfDistance);
}

async function pagePoint(
  page: Page,
  universe: FrameLocator,
  point: FramePoint,
): Promise<FramePoint> {
  const stage = await page.locator("#nur-universe-stage").boundingBox();
  expect(stage).not.toBeNull();
  const viewport = await universe.locator("html").evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  return {
    x: stage!.x + point.x * stage!.width / viewport.width,
    y: stage!.y + point.y * stage!.height / viewport.height,
  };
}

async function moveMouseToFramePoint(
  page: Page,
  universe: FrameLocator,
  point: FramePoint,
): Promise<FramePoint> {
  const target = await pagePoint(page, universe, point);
  await page.mouse.move(target.x, target.y);
  return target;
}

async function screenshotCanvas(canvas: Locator, testInfo: TestInfo, name: string): Promise<void> {
  await canvas.screenshot({
    path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`),
    animations: "allow",
  });
}

async function armMotionProbe(
  exactGalaxy: FrameLocator,
  baseline: GalaxyDiagnostics,
): Promise<void> {
  await exactGalaxy.locator("canvas#galaxy").evaluate((canvas, initial) => {
    type Probe = MotionProbe & { startX: number | null; startY: number | null };
    type ProbeWindow = Window & typeof globalThis & {
      __NUR__?: { getStats: () => { rig: GalaxyDiagnostics["rig"] & {
        targetDim4: number;
        targetDim5: number;
        targetHyperspace: number;
      } } };
      __nurMotionProbe?: Probe;
      __nurMotionProbeInstalled?: boolean;
    };
    const frameWindow = window as ProbeWindow;
    const galaxyCanvas = canvas as HTMLCanvasElement;
    frameWindow.__nurMotionProbe = {
      startX: null,
      startY: null,
      events: [],
      downPointerId: null,
      lastPointerId: null,
      moveCount: 0,
      shiftMoveCount: 0,
      travelX: 0,
      travelY: 0,
      maxTargetYaw: initial.targetYaw,
      maxTargetDim4: initial.targetDim4,
      minTargetDim5: initial.targetDim5,
      maxTargetHyperspace: initial.targetHyperspace,
    };
    if (frameWindow.__nurMotionProbeInstalled) return;
    frameWindow.__nurMotionProbeInstalled = true;
    galaxyCanvas.addEventListener("pointerdown", event => {
      const probe = frameWindow.__nurMotionProbe;
      if (!probe) return;
      probe.events.push(`pointerdown:${event.pointerId}`);
      probe.startX = event.clientX;
      probe.startY = event.clientY;
      probe.downPointerId = event.pointerId;
    });
    galaxyCanvas.addEventListener("pointermove", event => {
      const clientX = event.clientX;
      const clientY = event.clientY;
      const shiftKey = event.shiftKey;
      queueMicrotask(() => {
        const probe = frameWindow.__nurMotionProbe;
        const rig = frameWindow.__NUR__?.getStats().rig;
        if (!probe || !rig || probe.startX === null || probe.startY === null) return;
        probe.moveCount += 1;
        probe.lastPointerId = event.pointerId;
        if (shiftKey) probe.shiftMoveCount += 1;
        probe.travelX = Math.max(probe.travelX, Math.abs(clientX - probe.startX));
        probe.travelY = Math.max(probe.travelY, Math.abs(clientY - probe.startY));
        probe.maxTargetYaw = Math.max(probe.maxTargetYaw, rig.targetYaw);
        probe.maxTargetDim4 = Math.max(probe.maxTargetDim4, rig.targetDim4);
        probe.minTargetDim5 = Math.min(probe.minTargetDim5, rig.targetDim5);
        probe.maxTargetHyperspace = Math.max(probe.maxTargetHyperspace, rig.targetHyperspace);
      });
    });
    galaxyCanvas.addEventListener("pointercancel", event => {
      frameWindow.__nurMotionProbe?.events.push(`pointercancel:${event.pointerId}`);
    });
    galaxyCanvas.addEventListener("lostpointercapture", event => {
      frameWindow.__nurMotionProbe?.events.push(`lostpointercapture:${event.pointerId}`);
    });
    frameWindow.addEventListener("blur", () => {
      frameWindow.__nurMotionProbe?.events.push("window-blur");
    });
  }, {
    targetYaw: baseline.rig.targetYaw,
    targetDim4: baseline.targetDim4,
    targetDim5: baseline.targetDim5,
    targetHyperspace: baseline.targetHyperspace,
  });
}

async function motionProbe(exactGalaxy: FrameLocator): Promise<MotionProbe> {
  return exactGalaxy.locator("body").evaluate(() => {
    const probe = (window as unknown as { __nurMotionProbe?: MotionProbe }).__nurMotionProbe;
    if (!probe) throw new Error("Exact galaxy motion probe is unavailable");
    return probe;
  });
}

function touchPoints(origin: PinchOrigin, halfDistance: number): PhysicalTouchPoint[] {
  const dx = origin.axisX * halfDistance;
  const dy = origin.axisY * halfDistance;
  return [
    { id: 41, x: origin.x - dx, y: origin.y - dy, radiusX: 6, radiusY: 6, force: .7 },
    { id: 42, x: origin.x + dx, y: origin.y + dy, radiusX: 6, radiusY: 6, force: .7 },
  ];
}

async function dispatchPhysicalPinch(
  cdp: CDPSession,
  origin: PinchOrigin,
  startHalfDistance: number,
  endHalfDistance: number,
): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touchPoints(origin, startHalfDistance),
  });
  const steps = 4;
  for (let step = 1; step <= steps; step += 1) {
    const distance = startHalfDistance
      + (endHalfDistance - startHalfDistance) * step / steps;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: touchPoints(origin, distance),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("canonical galaxy exposes the exact halo-free source and bounded diagnostics", async ({ page }, testInfo) => {
  const { universe, canvas } = await openExactGalaxy(page);
  const initial = await diagnostics(universe);

  expect(initial).toMatchObject({
    version: "V197-halo-free-2026.08",
    sourceArtifact: "NUR_V197_HALO_FREE.html",
    artifactSha256: GALAXY_SHA256,
    renderer: "exact-halo-free-iframe",
    haloLayer: false,
    stars: 2662,
    ambientStars: 222,
    particles: 2662,
    ambient: 222,
    minZoom: .72,
    maxZoom: 1.7,
    activePointerCount: 0,
    pinchActive: false,
  });
  for (const value of [
    initial.zoom,
    initial.targetZoom,
    initial.hyperspace,
    initial.dim4,
    initial.dim5,
    initial.presentedHz,
    initial.renderCostMs,
  ]) expect(Number.isFinite(value)).toBe(true);

  await expect(universe.locator("canvas#space3d")).toHaveCount(0);
  await screenshotCanvas(canvas, testInfo, "exact-galaxy-baseline");
});

test("physical wheel zooms the exact galaxy, respects bounds, and ignores controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Mouse wheel coverage runs on desktop");
  const { universe, canvas } = await openExactGalaxy(page);
  const framePoint = await galaxyPanelBackgroundPoint(universe);
  await resetRig(universe);
  const initial = await diagnostics(universe);
  await moveMouseToFramePoint(page, universe, framePoint);

  await page.mouse.wheel(0, -480);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeGreaterThan(initial.targetZoom + .1);
  await expect.poll(async () => (await diagnostics(universe)).zoom)
    .toBeGreaterThan(initial.zoom + .08);
  await screenshotCanvas(canvas, testInfo, "exact-galaxy-wheel-in");

  await resetRig(universe);
  await moveMouseToFramePoint(page, universe, framePoint);
  await page.mouse.wheel(0, 480);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeLessThan(initial.targetZoom - .1);
  await expect.poll(async () => (await diagnostics(universe)).zoom)
    .toBeLessThan(initial.zoom - .08);
  await screenshotCanvas(canvas, testInfo, "exact-galaxy-wheel-out");

  await resetRig(universe);
  await moveMouseToFramePoint(page, universe, framePoint);
  for (let index = 0; index < 10; index += 1) await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeCloseTo(initial.maxZoom, 6);
  for (let index = 0; index < 12; index += 1) await page.mouse.wheel(0, 240);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeCloseTo(initial.minZoom, 6);

  await resetRig(universe);
  const control = universe.locator("#page-systems .universe-system-node").first();
  await expect(control).toBeVisible();
  const controlPoint = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await moveMouseToFramePoint(page, universe, controlPoint);
  const beforeControlWheel = await diagnostics(universe);
  await page.mouse.wheel(0, -480);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeCloseTo(beforeControlWheel.targetZoom, 6);
});

test("physical drag and keyboard input control every exact galaxy motion plane", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Mouse and keyboard coverage runs on desktop");
  const { universe, exactGalaxy } = await openExactGalaxy(page);
  const origin = await galaxyDragOrigin(universe, { x: 96, y: 24 });

  await resetRig(universe);
  await moveMouseToFramePoint(page, universe, origin);
  const dragMidpoint = await pagePoint(page, universe, {
    x: origin.x + 48,
    y: origin.y + 12,
  });
  const dragEnd = await pagePoint(page, universe, {
    x: origin.x + 96,
    y: origin.y + 24,
  });
  const beforeDrag = await diagnostics(universe);
  await armMotionProbe(exactGalaxy, beforeDrag);
  await page.mouse.down();
  await expect(exactGalaxy.locator("body")).toHaveClass(/dragging/);
  await page.mouse.move(dragMidpoint.x, dragMidpoint.y);
  await page.mouse.move(dragEnd.x, dragEnd.y);
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(1);
  const dragProbe = await motionProbe(exactGalaxy);
  expect(dragProbe.lastPointerId).toBe(dragProbe.downPointerId);
  expect(dragProbe.moveCount).toBeGreaterThanOrEqual(2);
  expect(dragProbe.travelX).toBeGreaterThan(90);
  expect(dragProbe.maxTargetYaw).toBeGreaterThan(beforeDrag.rig.targetYaw + .06);
  await page.mouse.up();
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(0);

  await resetRig(universe);
  const shiftOrigin = await galaxyDragOrigin(universe, { x: 88, y: -72 });
  await moveMouseToFramePoint(page, universe, shiftOrigin);
  const shiftMidpoint = await pagePoint(page, universe, {
    x: shiftOrigin.x + 44,
    y: shiftOrigin.y - 36,
  });
  const shiftEnd = await pagePoint(page, universe, {
    x: shiftOrigin.x + 88,
    y: shiftOrigin.y - 72,
  });
  const beforeShiftDrag = await diagnostics(universe);
  await armMotionProbe(exactGalaxy, beforeShiftDrag);
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(shiftMidpoint.x, shiftMidpoint.y);
  await page.mouse.move(shiftEnd.x, shiftEnd.y);
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(1);
  const shiftProbe = await motionProbe(exactGalaxy);
  expect(shiftProbe.moveCount).toBeGreaterThanOrEqual(2);
  expect(shiftProbe.shiftMoveCount).toBe(shiftProbe.moveCount);
  expect(shiftProbe.travelX).toBeGreaterThan(80);
  expect(shiftProbe.travelY).toBeGreaterThan(65);
  expect(shiftProbe.maxTargetDim4).toBeGreaterThan(beforeShiftDrag.targetDim4 + .05);
  expect(shiftProbe.minTargetDim5).toBeLessThan(beforeShiftDrag.targetDim5 - .04);
  expect(shiftProbe.maxTargetHyperspace)
    .toBeGreaterThan(beforeShiftDrag.targetHyperspace + .04);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(0);

  await resetRig(universe);
  await universe.locator("body").evaluate(element => {
    element.tabIndex = -1;
    element.focus();
  });
  const keyboardInitial = await diagnostics(universe);
  await page.keyboard.press("=");
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeGreaterThan(keyboardInitial.targetZoom + .07);
  await page.keyboard.press("-");
  await expect.poll(async () => (await diagnostics(universe)).targetZoom).toBeCloseTo(1, 2);
  await page.keyboard.press("x");
  await expect.poll(async () => (await diagnostics(universe)).targetHyperspace)
    .toBeGreaterThan(keyboardInitial.targetHyperspace + .07);
  await page.keyboard.press("c");
  await expect.poll(async () => (await diagnostics(universe)).targetDim4)
    .toBeLessThan(keyboardInitial.targetDim4 - .1);
  await page.keyboard.press("n");
  await expect.poll(async () => (await diagnostics(universe)).targetDim5)
    .toBeGreaterThan(keyboardInitial.targetDim5 + .1);
});

test("physical Chromium touch pinch-out drives exact mobile depth", async ({ page, browserName }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Touch pinch coverage runs on mobile");
  test.skip(browserName !== "chromium", "Browser-level multi-touch proof uses Chromium CDP");
  const { universe, canvas } = await openExactGalaxy(page);
  const cdp = await page.context().newCDPSession(page);

  const initial = await diagnostics(universe);
  expect(initial.targetZoom).toBeCloseTo(1, 3);
  const frameOrigin = await pinchOrigin(universe, 74);
  const originOnPage = await pagePoint(page, universe, frameOrigin);
  const origin: PinchOrigin = { ...originOnPage, axisX: frameOrigin.axisX, axisY: frameOrigin.axisY };

  await dispatchPhysicalPinch(cdp, origin, 22, 74);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeGreaterThan(initial.targetZoom + .25);
  await expect.poll(async () => (await diagnostics(universe)).zoom)
    .toBeGreaterThan(initial.zoom + .18);
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(0);
  expect(await diagnostics(universe)).toMatchObject({ pinchActive: false });
  await screenshotCanvas(canvas, testInfo, "exact-galaxy-pinch-out");
});

test("physical Chromium touch pinch-in drives exact mobile depth", async ({ page, browserName }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Touch pinch coverage runs on mobile");
  test.skip(browserName !== "chromium", "Browser-level multi-touch proof uses Chromium CDP");
  const { universe, canvas } = await openExactGalaxy(page);
  const cdp = await page.context().newCDPSession(page);

  const initial = await diagnostics(universe);
  expect(initial.targetZoom).toBeCloseTo(1, 3);
  const frameOrigin = await pinchOrigin(universe, 74);
  const originOnPage = await pagePoint(page, universe, frameOrigin);
  const origin: PinchOrigin = { ...originOnPage, axisX: frameOrigin.axisX, axisY: frameOrigin.axisY };
  await dispatchPhysicalPinch(cdp, origin, 74, 22);
  await expect.poll(async () => (await diagnostics(universe)).targetZoom)
    .toBeCloseTo(initial.minZoom, 6);
  await expect.poll(async () => (await diagnostics(universe)).zoom).toBeLessThan(.82);
  await expect.poll(async () => (await diagnostics(universe)).activePointerCount).toBe(0);
  expect(await diagnostics(universe)).toMatchObject({ pinchActive: false });
  await screenshotCanvas(canvas, testInfo, "exact-galaxy-pinch-in");
});
