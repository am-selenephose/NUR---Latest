import { expect, test, type FrameLocator, type Page } from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

const exactBrainSha256 = "3c0b36f9d9732ed8fd0013e924754bbf3fe1f9c932a3498342af2df0084538b0";

async function assertExactBrain(frame: FrameLocator, surface: "entry" | "today" | "universe") {
  const host = frame.locator("#front-nur-star");
  const artifactFrame = host.locator("#nur-exact-brain-frame");
  const artifact = frame.frameLocator("#nur-exact-brain-frame");
  const canvas = artifact.locator("#nur-brain-canvas-v197");

  await expect(host).toBeVisible();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toBeInViewport();
  await expect(host).toHaveAttribute("data-nur-surface", surface);
  await expect(host).toHaveAttribute("data-nur-exact-brain-state", "ready");
  await expect(host).toHaveAttribute("data-nur-model", "exact-galaxy-stars-radiant-outer-anatomy");
  await expect(host).toHaveAttribute("data-nur-variant", "softer-path-rainbow-click-double-shatter");
  await expect(host).toHaveAttribute("data-nur-artifact-sha256", exactBrainSha256);
  await expect(host).toHaveAttribute("data-nur-engine", "canvas2d-exact-artifact-v1");
  await expect(host).toHaveAttribute("data-nur-spectrum-band-count", "7");
  await expect(host).toHaveAttribute(
    "data-nur-spectrum-bands",
    "red,orange,yellow,green,blue,indigo,violet",
  );
  await expect(host).toHaveAttribute(
    "data-nur-interaction-contract",
    "pointer-drag-wheel-single-rainbow-double-shatter-keyboard-shatter",
  );
  await expect(artifactFrame).toHaveCount(1);
  await expect(artifactFrame).toHaveAttribute("data-nur-artifact-sha256", exactBrainSha256);
  await expect(artifactFrame).toHaveAttribute("data-nur-exact-brain-state", "ready");
  await expect(frame.locator("#nur-brain-canvas")).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-nur-parent-bridge-state", "ready");
  await expect(artifact.locator("#front-nur-star")).toHaveAttribute(
    "title",
    /click: cycle rainbow color.+double-click: dissolve\/spread.+scroll to zoom/,
  );
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width < 2 || element.height < 2) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let painted = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 8_000 / 4) * 4);
    for (let index = 3; index < pixels.length; index += stride) {
      if ((pixels[index] ?? 0) > 8) painted += 1;
    }
    return painted;
  })).toBeGreaterThan(100);

  return { host, artifact, canvas };
}

async function openSystems(page: Page, session: string): Promise<FrameLocator> {
  await installNurMocks(page);
  await page.context().addCookies([
    { name: "nur_session", value: `${session}-session`, url: "http://localhost:4173", httpOnly: true, sameSite: "Lax" },
    { name: "nur_csrf", value: `${session}-csrf`, url: "http://localhost:4173", httpOnly: false, sameSite: "Lax" },
  ]);
  await page.goto("/systems", { waitUntil: "load" });
  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible({ timeout: 15_000 });
  return universe;
}

const dedicatedRoutes = [
  { focus: "map", route: "/universe/map", root: "#nur-map-root" },
  { focus: "orbits", route: "/universe/orbits", root: "#nur-orbit-root" },
  { focus: "timeline", route: "/universe/timeline", root: "#nur-timeline-root" },
  { focus: "insights", route: "/universe/insights", root: "#nur-insights-root" },
];

test("founder exact brain artifact owns one nested runtime and exact geometry", async ({ page }, testInfo) => {
  const universe = await openSystems(page, "runtime-lifecycle");
  const { host, canvas } = await assertExactBrain(universe, "universe");
  await expect(universe.locator("#v197-sparkfield")).toHaveCount(0);
  const parentGeometry = await host.evaluate(element => {
    const frame = element.querySelector<HTMLIFrameElement>("#nur-exact-brain-frame")!;
    const hostRect = element.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const hostStyle = getComputedStyle(element);
    const frameStyle = getComputedStyle(frame);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      host: { x: hostRect.x, y: hostRect.y, width: hostRect.width, height: hostRect.height },
      frame: { width: frameRect.width, height: frameRect.height },
      hostStyle: { opacity: hostStyle.opacity, filter: hostStyle.filter, maskImage: hostStyle.maskImage },
      frameStyle: {
        opacity: frameStyle.opacity,
        filter: frameStyle.filter,
        mixBlendMode: frameStyle.mixBlendMode,
        backgroundColor: frameStyle.backgroundColor,
      },
    };
  });
  const childGeometry = await canvas.evaluate(node => {
    const element = node as HTMLCanvasElement;
    const host = element.closest<HTMLElement>("#front-nur-star")!;
    const hostRect = host.getBoundingClientRect();
    const canvasRect = element.getBoundingClientRect();
    const context = element.getContext("2d")!;
    const pixel = [...context.getImageData(
      Math.floor(element.width / 2),
      Math.floor(element.height / 2),
      1,
      1,
    ).data];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      host: { width: hostRect.width, height: hostRect.height },
      canvas: { width: canvasRect.width, height: canvasRect.height },
      backing: { width: element.width, height: element.height },
      hostCenterDelta: {
        x: Math.abs(hostRect.left + hostRect.width / 2 - innerWidth / 2),
        y: Math.abs(hostRect.top + hostRect.height / 2 - innerHeight / 2),
      },
      centerPixel: pixel,
    };
  });
  expect(parentGeometry.frameStyle).toMatchObject({
    opacity: "1",
    filter: "none",
    mixBlendMode: "normal",
    backgroundColor: "rgb(0, 0, 0)",
  });
  if (testInfo.project.name.includes("mobile")) {
    expect(parentGeometry.host.width).toBeCloseTo(
      Math.min(parentGeometry.viewport.width * .98, 470),
      0,
    );
  } else {
    expect(parentGeometry.host.width).toBeCloseTo(
      Math.min(parentGeometry.viewport.width * .56, 700),
      0,
    );
  }
  expect(parentGeometry.host.height).toBeCloseTo(parentGeometry.host.width, 0);
  expect(parentGeometry.frame.width).toBeCloseTo(parentGeometry.host.width, 0);
  expect(parentGeometry.frame.height).toBeCloseTo(parentGeometry.host.height, 0);
  expect(childGeometry.host.width).toBeCloseTo(parentGeometry.frame.width, 0);
  expect(childGeometry.host.height).toBeCloseTo(parentGeometry.frame.height, 0);
  expect(childGeometry.hostCenterDelta.x).toBeLessThanOrEqual(1);
  expect(childGeometry.hostCenterDelta.y).toBeLessThanOrEqual(1);
  expect(childGeometry.centerPixel[3]).toBeGreaterThan(0);

  const controller = await universe.locator("body").evaluate(() => {
    const api = (window as unknown as {
      nurStarBrain?: { shatter?: unknown; getDiagnostics?: () => Record<string, unknown> };
    }).nurStarBrain;
    return {
      shatter: typeof api?.shatter,
      diagnostics: api?.getDiagnostics?.() ?? null,
    };
  });
  expect(controller.shatter).toBe("function");
  expect(controller.diagnostics).toMatchObject({
    artifactSha256: exactBrainSha256,
    surface: "universe",
    connected: true,
  });
});

test("founder exact brain keeps wheel, click, double-click, and keyboard mechanics", async ({ page }) => {
  const universe = await openSystems(page, "runtime-interactions");
  const host = universe.locator("#front-nur-star");
  const artifact = universe.frameLocator("#nur-exact-brain-frame");
  const canvas = artifact.locator("#nur-brain-canvas-v197");
  await expect(host).toHaveAttribute("data-nur-exact-brain-state", "ready");
  await expect(canvas).toBeVisible();

  const wheelContract = await canvas.evaluate(element => {
    const ordinary = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    element.dispatchEvent(ordinary);
    return { ordinaryPrevented: ordinary.defaultPrevented };
  });
  expect(wheelContract.ordinaryPrevented).toBe(true);
  await expect(host).toHaveAttribute("data-nur-last-interaction", "wheel-zoom");

  await host.scrollIntoViewIfNeeded();
  await expect(host).toBeInViewport();
  const stageInteractionPoint = await host.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  const stageBox = await page.locator("#nur-universe-stage").boundingBox();
  expect(stageBox).not.toBeNull();
  const physicalInteractionPoint = {
    x: stageBox!.x + stageInteractionPoint.x,
    y: stageBox!.y + stageInteractionPoint.y,
  };
  await page.mouse.click(physicalInteractionPoint.x, physicalInteractionPoint.y);
  await expect(host).toHaveAttribute("data-nur-last-interaction", "rainbow-cycle");
  await expect(universe.locator("body")).toHaveAttribute("data-nur-page", "systems");
  await page.mouse.dblclick(physicalInteractionPoint.x, physicalInteractionPoint.y);
  await expect(host).toHaveAttribute("data-nur-last-interaction", "original-palette-shatter");
  await expect(universe.locator("body")).toHaveAttribute("data-nur-page", "systems");
  await artifact.locator("#front-nur-star").press("Enter");
  await expect(host).toHaveAttribute("data-nur-last-interaction", "keyboard-shatter");
});

test("Entry mounts the same exact founder artifact", async ({ page }, testInfo) => {
  await installNurMocks(page);
  await page.route("**/api/v1/auth/me", route => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Not authenticated" }),
  }));
  await page.goto("/", { waitUntil: "load" });
  const entry = page.frameLocator("#nur-entry-stage");
  await expect.poll(() => entry.locator("body").evaluate(() => (
    typeof (window as unknown as { nurShowFront?: unknown }).nurShowFront
  ))).toBe("function");
  await entry.locator("body").evaluate(() => {
    (window as unknown as { nurShowFront: () => void }).nurShowFront();
  });
  await assertExactBrain(entry, "entry");
  await page.screenshot({ path: testInfo.outputPath("founder-exact-entry-brain.png") });
});

for (const { focus, route, root } of dedicatedRoutes) {
  test(`${route} stops the exact brain runtime and Systems restores it`, async ({ page }) => {
    const universe = await openSystems(page, `runtime-route-${focus}`);
    await expect(universe.locator("#front-nur-star")).toHaveAttribute(
      "data-nur-artifact-sha256",
      exactBrainSha256,
    );
    await universe.locator(`[data-world-tab="${focus}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(universe.locator(root)).toBeVisible();
    await expect(universe.locator("#front-nur-star:visible"), `${route} has no visible brain`).toHaveCount(0);
    await expect(universe.locator("#nur-exact-brain-frame"), `${route} stops the exact brain runtime`).toHaveCount(0);
    const controllerState = await universe.locator("body").evaluate(() => {
      const controller = (window as unknown as {
        nurStarBrain?: { getDiagnostics?: () => { connected?: boolean } };
      }).nurStarBrain;
      const descriptor = Object.getOwnPropertyDescriptor(window, "nurStarBrain");
      return {
        type: typeof controller,
        own: Object.prototype.hasOwnProperty.call(window, "nurStarBrain"),
        configurable: descriptor?.configurable ?? null,
        connected: controller?.getDiagnostics?.().connected ?? null,
      };
    });
    expect(controllerState).toEqual({
      type: "undefined",
      own: false,
      configurable: null,
      connected: null,
    });

    await universe.locator('[data-world-tab="universe"]:visible').first().click();
    await expect(page).toHaveURL(/\/universe$/);
    await expect(universe.locator("#page-systems")).toBeVisible();
    await expect(universe.locator("#front-nur-star")).toHaveAttribute(
      "data-nur-artifact-sha256",
      exactBrainSha256,
    );
    await expect(universe.locator("#nur-exact-brain-frame"))
      .toHaveAttribute("data-nur-exact-brain-state", "ready");
  });
}
