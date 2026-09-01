import { expect, test } from "@playwright/test";

import { installBundledFontPolicy, installNurMocks, json } from "./helpers/nurMocks";

test("Entry uses native-scale exact brain with zero external halos and the exact galaxy document", async ({ page }, testInfo) => {
  await installBundledFontPolicy(page);
  await page.route("**/api/v1/auth/me", route => json(route, { detail: "Not authenticated" }, 401));
  await page.goto("/", { waitUntil: "load" });

  const entry = page.frameLocator("#nur-entry-stage");
  await expect.poll(() => entry.locator("body").evaluate(() => (
    typeof (window as unknown as { nurShowFront?: unknown }).nurShowFront
  ))).toBe("function");
  await entry.locator("body").evaluate(() => {
    (window as unknown as { nurShowFront: () => void }).nurShowFront();
  });

  const brainHost = entry.locator("#front-nur-star");
  const brainFrame = entry.locator("#nur-exact-brain-frame");
  const exactBrain = entry.frameLocator("#nur-exact-brain-frame");
  const exactCanvas = exactBrain.locator("#nur-brain-canvas-v197");
  await expect(brainHost).toBeVisible();
  await expect(brainFrame).toBeVisible();
  await expect(exactCanvas).toBeVisible();

  const viewportWidth = page.viewportSize()!.width;
  const expectedNativeSize = testInfo.project.name.includes("mobile")
    ? Math.min(viewportWidth * .98, 470)
    : Math.min(viewportWidth * .56, 700);
  const geometry = await brainHost.evaluate(host => {
    const frame = host.querySelector<HTMLIFrameElement>("#nur-exact-brain-frame")!;
    const hostRect = host.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
    };
  });
  const innerGeometry = await exactBrain.locator("#front-nur-star").evaluate(host => {
    const canvas = host.querySelector<HTMLCanvasElement>("#nur-brain-canvas-v197")!;
    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
    };
  });
  for (const size of [
    geometry.hostWidth,
    geometry.hostHeight,
    geometry.frameWidth,
    geometry.frameHeight,
    innerGeometry.hostWidth,
    innerGeometry.hostHeight,
    innerGeometry.canvasWidth,
    innerGeometry.canvasHeight,
  ]) expect(size).toBeCloseTo(expectedNativeSize, 1);

  const visibleHalos = await entry.locator("#f4-orbit .f4-ring").evaluateAll(elements => (
    elements.filter(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden"
        && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    }).length
  ));
  expect(visibleHalos).toBe(0);

  const galaxyFrame = entry.locator("#nur-v197-halo-free-galaxy-frame");
  await expect(galaxyFrame).toBeAttached();
  await expect(galaxyFrame).toHaveAttribute("src", "/v197/NUR_V197_HALO_FREE.html");
  const exactGalaxy = entry.frameLocator("#nur-v197-halo-free-galaxy-frame");
  await expect(exactGalaxy.locator("#galaxy")).toBeVisible();
  await expect.poll(() => exactGalaxy.locator("body").evaluate(() => (
    (window as unknown as { __NUR__?: { getStats?: () => { particles: number } } })
      .__NUR__?.getStats?.().particles ?? 0
  ))).toBe(2662);
  await page.screenshot({
    path: testInfo.outputPath(`entry-exact-celestial-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("Today keeps the exact native-scale brain interactive with no external halo owner", async ({ page }, testInfo) => {
  await installNurMocks(page);
  await page.context().addCookies([
    {
      name: "nur_session",
      value: "exact-celestial-session",
      url: "http://localhost:4173",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "nur_csrf",
      value: "exact-celestial-csrf",
      url: "http://localhost:4173",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/today", { waitUntil: "load" });

  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-today")).toBeVisible({ timeout: 15_000 });
  const brainHost = universe.locator("#page-today #front-nur-star");
  const brainFrame = brainHost.locator("#nur-exact-brain-frame");
  const exactBrain = universe.frameLocator("#nur-exact-brain-frame");
  const exactCanvas = exactBrain.locator("#nur-brain-canvas-v197");
  await expect(brainHost).toBeVisible();
  await expect(brainFrame).toBeVisible();
  await expect(brainFrame).toHaveAttribute(
    "src",
    "/v197/NUR_V197_BRAIN_EXACT_GALAXY_STARS_RADIANT_OUTER_ANATOMY_SOFTER_PATH.html",
  );
  await expect(brainHost).toHaveAttribute("data-nur-surface", "today");
  await expect(brainHost).toHaveAttribute("data-nur-halo-contract", "halo-free");
  await expect(exactCanvas).toBeVisible();

  const geometry = await brainHost.evaluate(host => {
    const rect = host.getBoundingClientRect();
    const expectedNativeSize = innerWidth <= 600
      ? Math.min(innerWidth * .98, 470)
      : Math.min(innerWidth * .56, 700);
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    ) as HTMLElement | null;
    return {
      expectedNativeSize,
      width: rect.width,
      height: rect.height,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      centerTarget: target?.id ?? null,
    };
  });
  expect(geometry.width).toBeCloseTo(geometry.expectedNativeSize, 1);
  expect(geometry.height).toBeCloseTo(geometry.expectedNativeSize, 1);
  expect(geometry.centerTarget).toBe("nur-exact-brain-frame");
  await expect(universe.locator(
    "#page-today .orbit-star-zone .f4-ring, #page-today .nur-v197-brain-orbit-halo",
  )).toHaveCount(0);

  const galaxyFrame = universe.locator("#nur-v197-halo-free-galaxy-frame");
  await expect(galaxyFrame).toHaveAttribute("src", "/v197/NUR_V197_HALO_FREE.html");
  const exactGalaxy = universe.frameLocator("#nur-v197-halo-free-galaxy-frame");
  await expect(exactGalaxy.locator("#galaxy")).toBeVisible();
  await expect.poll(() => exactGalaxy.locator("body").evaluate(() => (
    (window as unknown as { __NUR__?: { getStats?: () => { particles: number } } })
      .__NUR__?.getStats?.().particles ?? 0
  ))).toBe(2662);
  await page.screenshot({
    path: testInfo.outputPath(`today-exact-celestial-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await exactCanvas.evaluate(canvas => {
    canvas.addEventListener("click", () => {
      document.body.dataset.nurPhysicalClickProbe = "click";
    }, { capture: true, once: true });
  });
  const universeStageBox = await page.locator("#nur-universe-stage").boundingBox();
  expect(universeStageBox).not.toBeNull();
  await page.mouse.click(
    universeStageBox!.x + geometry.center.x,
    universeStageBox!.y + geometry.center.y,
  );
  await expect(exactBrain.locator("body"))
    .toHaveAttribute("data-nur-physical-click-probe", "click");
  await expect(brainHost).toHaveAttribute("data-nur-last-interaction", "rainbow-cycle");
  await page.screenshot({
    path: testInfo.outputPath(`today-exact-celestial-color-cycle-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("Systems uses the same native-scale exact brain and halo-free galaxy without changing shell geometry", async ({ page }, testInfo) => {
  await installNurMocks(page);
  await page.context().addCookies([
    {
      name: "nur_session",
      value: "exact-celestial-session",
      url: "http://localhost:4173",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "nur_csrf",
      value: "exact-celestial-csrf",
      url: "http://localhost:4173",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/systems", { waitUntil: "load" });

  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible({ timeout: 15_000 });
  const brainHost = universe.locator(
    "#page-systems .universe-master-star > #front-nur-star",
  );
  const brainFrame = brainHost.locator("#nur-exact-brain-frame");
  const exactBrain = universe.frameLocator("#nur-exact-brain-frame");
  const exactCanvas = exactBrain.locator("#nur-brain-canvas-v197");
  await expect(brainHost).toBeVisible();
  await expect(brainFrame).toBeVisible();
  await expect(exactCanvas).toBeVisible();
  await brainHost.scrollIntoViewIfNeeded();

  const geometry = await brainHost.evaluate(host => {
    const frame = host.querySelector<HTMLIFrameElement>("#nur-exact-brain-frame")!;
    const hostRect = host.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const masterRect = host.parentElement!.getBoundingClientRect();
    const panelRect = host.closest<HTMLElement>(".universe-map-panel")!.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.getElementById("nur-front-v61")!);
    const hostStyle = getComputedStyle(host);
    const frameStyle = getComputedStyle(frame);
    const centerX = hostRect.left + hostRect.width / 2;
    const centerY = hostRect.top + hostRect.height / 2;
    const centerTarget = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
    const expectedNativeSize = innerWidth <= 600
      ? Math.min(innerWidth * .98, 470)
      : Math.min(innerWidth * .56, 700);
    return {
      expectedNativeSize,
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      shellPosition: rootStyle.position,
      shellInset: [rootStyle.top, rootStyle.right, rootStyle.bottom, rootStyle.left],
      hostRect: { x: hostRect.x, y: hostRect.y, width: hostRect.width, height: hostRect.height },
      masterRect: { x: masterRect.x, y: masterRect.y, width: masterRect.width, height: masterRect.height },
      panelRect: { x: panelRect.x, y: panelRect.y, width: panelRect.width, height: panelRect.height },
      viewport: { width: innerWidth, height: innerHeight },
      center: { x: centerX, y: centerY },
      centerTarget: centerTarget
        ? `${centerTarget.tagName.toLowerCase()}#${centerTarget.id}.${centerTarget.className}`
        : null,
      hostZIndex: hostStyle.zIndex,
      hostPointerEvents: hostStyle.pointerEvents,
      frameZIndex: frameStyle.zIndex,
      framePointerEvents: frameStyle.pointerEvents,
      hostBackground: hostStyle.backgroundColor,
      frameBackground: frameStyle.backgroundColor,
      frameBlendMode: frameStyle.mixBlendMode,
    };
  });
  const innerGeometry = await exactBrain.locator("#front-nur-star").evaluate(host => {
    const canvas = host.querySelector<HTMLCanvasElement>("#nur-brain-canvas-v197")!;
    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const welcome = document.getElementById("welcome")!;
    const orbit = document.querySelector<HTMLElement>(".front-orbit")!;
    return {
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
      backgrounds: {
        html: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        welcome: getComputedStyle(welcome).backgroundColor,
        orbit: getComputedStyle(orbit).backgroundColor,
        host: getComputedStyle(host).backgroundColor,
        canvas: getComputedStyle(canvas).backgroundColor,
      },
      centerTarget: (() => {
        const target = document.elementFromPoint(
          canvasRect.left + canvasRect.width / 2,
          canvasRect.top + canvasRect.height / 2,
        ) as HTMLElement | null;
        return target ? `${target.tagName.toLowerCase()}#${target.id}.${target.className}` : null;
      })(),
    };
  });
  for (const size of [
    geometry.hostWidth,
    geometry.hostHeight,
    geometry.frameWidth,
    geometry.frameHeight,
    innerGeometry.hostWidth,
    innerGeometry.hostHeight,
    innerGeometry.canvasWidth,
    innerGeometry.canvasHeight,
  ]) expect(size).toBeCloseTo(geometry.expectedNativeSize, 1);
  expect(geometry.shellPosition).toBe("fixed");
  expect(geometry.shellInset).toEqual(["0px", "0px", "0px", "0px"]);

  await expect(universe.locator(
    ".universe-master-star > .nur-v197-brain-orbit-halo, #f4-orbit > .f4-ring",
  )).toHaveCount(0);
  await expect(brainHost).toHaveAttribute("data-nur-halo-contract", "halo-free");

  const galaxyFrame = universe.locator("#nur-v197-halo-free-galaxy-frame");
  await expect(galaxyFrame).toBeAttached();
  await expect(galaxyFrame).toHaveAttribute("src", "/v197/NUR_V197_HALO_FREE.html");
  const exactGalaxy = universe.frameLocator("#nur-v197-halo-free-galaxy-frame");
  await expect.poll(() => exactGalaxy.locator("body").evaluate(() => (
    (window as unknown as { __NUR__?: { getStats?: () => { particles: number } } })
      .__NUR__?.getStats?.().particles ?? 0
  ))).toBe(2662);
  await page.screenshot({
    path: testInfo.outputPath(`systems-exact-celestial-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await exactCanvas.evaluate(canvas => {
    const events: string[] = [];
    for (const type of ["pointerdown", "pointerup", "click"] as const) {
      canvas.addEventListener(type, () => {
        events.push(type);
        document.body.dataset.nurPhysicalClickProbe = events.join(",");
        const frame = window.frameElement as HTMLIFrameElement | null;
        const outerHost = frame?.parentElement as HTMLElement | null;
        if (outerHost) {
          outerHost.dataset.nurPhysicalClickProbe = events.join(",");
          outerHost.dataset.nurPhysicalClickParentIdentity =
            String(outerHost === window.parent.document.getElementById("front-nur-star"));
        }
      }, { capture: true });
    }
  });
  const universeStageBox = await page.locator("#nur-universe-stage").boundingBox();
  expect(universeStageBox).not.toBeNull();
  await page.mouse.click(
    universeStageBox!.x + geometry.center.x,
    universeStageBox!.y + geometry.center.y,
  );
  await expect(exactBrain.locator("body")).toHaveAttribute(
    "data-nur-physical-click-probe",
    "pointerdown,pointerup,click",
  );
  await expect(brainHost).toHaveAttribute(
    "data-nur-physical-click-parent-identity",
    "true",
  );
  await expect(brainHost).toHaveAttribute("data-nur-last-interaction", "rainbow-cycle");
});
