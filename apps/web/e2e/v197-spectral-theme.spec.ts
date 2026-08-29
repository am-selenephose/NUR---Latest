import { expect, test, type FrameLocator, type Locator } from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

type ThemeDiagnostics = {
  frameCount: number;
  themeColor: string;
  themeStrength: number;
};

async function directHitPoint(locator: Locator, label: string): Promise<{ x: number; y: number }> {
  return locator.evaluate((element, targetLabel) => {
    const rect = element.getBoundingClientRect();
    const left = Math.max(rect.left + 4, 0);
    const right = Math.min(rect.right - 4, innerWidth);
    const top = Math.max(rect.top + 4, 0);
    const bottom = Math.min(rect.bottom - 4, innerHeight);
    const diagnostics: string[] = [];
    for (const yRatio of [.5, .7, .3, .85, .15]) {
      for (const xRatio of [.5, .7, .3, .85, .15]) {
        const x = left + ((right - left) * xRatio);
        const y = top + ((bottom - top) * yRatio);
        const target = document.elementFromPoint(x, y) as Element | null;
        if (target === element) {
          return { x: x - rect.left, y: y - rect.top };
        }
        diagnostics.push(
          `${Math.round(x)},${Math.round(y)}=${target?.tagName ?? "none"}`
          + `${target?.id ? `#${target.id}` : ""}`
          + `${target?.classList.length ? `.${[...target.classList].join(".")}` : ""}`,
        );
      }
    }
    throw new Error(`No direct ${targetLabel} hit point was visible. ${diagnostics.join(" | ")}`);
  }, label);
}

async function diagnostics(frame: FrameLocator): Promise<ThemeDiagnostics> {
  return frame.locator("#space3d").evaluate(() => (
    (window as unknown as {
      nurGalaxy: { getParticleDiagnostics: () => ThemeDiagnostics };
    }).nurGalaxy.getParticleDiagnostics()
  ));
}

test("spectral theme is accessible, persisted, gesture-safe, and shader-backed", async ({ page }, testInfo) => {
  await installNurMocks(page);
  await page.goto("/settings", { waitUntil: "load" });
  const universe = page.frameLocator("#nur-universe-stage");
  const settings = universe.locator("#nur-v197-adjunct-root");
  const theme = settings.locator('[data-adjunct-control="theme-accent"]');

  await expect(settings).toBeVisible({ timeout: 15_000 });
  await expect(theme).toHaveValue("original");
  await expect(theme).toHaveAccessibleName("Appearance");
  await theme.selectOption("blue");
  await expect(universe.locator("html")).toHaveAttribute("data-nur-theme-accent", "blue");
  expect(await page.evaluate(() => localStorage.getItem("nur:v197-theme-accent"))).toBe("blue");
  await page.screenshot({
    path: testInfo.outputPath(`settings-blue-${testInfo.project.name}.png`),
    fullPage: false,
    animations: "allow",
  });

  await page.reload({ waitUntil: "load" });
  await expect(universe.locator("#nur-v197-adjunct-root")).toBeVisible({ timeout: 15_000 });
  await expect(universe.locator('[data-adjunct-control="theme-accent"]')).toHaveValue("blue");

  await page.goto("/systems", { waitUntil: "load" });
  await expect(universe.locator("#page-systems")).toBeVisible({ timeout: 15_000 });
  const world = universe.locator(".universe-map-panel");
  if (testInfo.project.name.includes("mobile")) await world.scrollIntoViewIfNeeded();
  const worldPoint = await directHitPoint(world, "empty V197 world");
  await world.evaluate(() => {
    const records: Array<{ detail: number; target: string; x: number; y: number }> = [];
    (window as unknown as { __nurThemeClickDiagnostics: typeof records }).__nurThemeClickDiagnostics = records;
    document.addEventListener("click", event => {
      const target = event.target as Element | null;
      records.push({
        detail: event.detail,
        target: `${target?.tagName ?? "none"}${target?.id ? `#${target.id}` : ""}`
          + `${target?.classList.length ? `.${[...target.classList].join(".")}` : ""}`,
        x: event.clientX,
        y: event.clientY,
      });
    }, true);
  });
  await world.click({ position: worldPoint, clickCount: 2, delay: 45 });
  await page.waitForTimeout(320);
  const worldClickDiagnostics = await world.evaluate(() => (
    (window as unknown as {
      __nurThemeClickDiagnostics: Array<{ detail: number; target: string; x: number; y: number }>;
    }).__nurThemeClickDiagnostics
  ));
  expect(
    await universe.locator("html").getAttribute("data-nur-theme-accent"),
    `Native double-click sequence: ${JSON.stringify(worldClickDiagnostics)}`,
  ).toBe("violet");
  await expect.poll(async () => (await diagnostics(universe)).themeColor).toBe("#c16bff");
  expect((await diagnostics(universe)).themeStrength).toBe(1);

  const beforeBrain = await diagnostics(universe);
  const brain = universe.locator("#nur-brain-canvas");
  if (testInfo.project.name.includes("mobile")) await brain.scrollIntoViewIfNeeded();
  const brainPoint = await directHitPoint(brain, "star-brain canvas");
  await brain.dblclick({ position: brainPoint });
  await expect(universe.locator("html")).toHaveAttribute("data-nur-theme-accent", "violet");
  await expect.poll(async () => (await diagnostics(universe)).frameCount).toBeGreaterThan(beforeBrain.frameCount);

  const blockedControl = universe.locator("button").filter({ hasText: "Universe" }).first();
  await blockedControl.evaluate(element => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
  });
  await page.waitForTimeout(320);
  await expect(universe.locator("html")).toHaveAttribute("data-nur-theme-accent", "violet");

  if (testInfo.project.name.includes("mobile")) await world.scrollIntoViewIfNeeded();
  const resetPoint = await directHitPoint(world, "empty V197 world");
  await world.click({ position: resetPoint, clickCount: 3, delay: 45 });
  await expect(universe.locator("html")).not.toHaveAttribute("data-nur-theme-accent", /.+/);
  await expect.poll(async () => (await diagnostics(universe)).themeStrength).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("nur:v197-theme-accent"))).toBeNull();
  await page.screenshot({
    path: testInfo.outputPath(`systems-original-reset-${testInfo.project.name}.png`),
    fullPage: false,
    animations: "allow",
  });
});
